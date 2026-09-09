import { ConvexError, v } from "convex/values";
import { createThread, listMessages, saveMessage } from "@convex-dev/agent";
import { AgentMail } from "@agentmail/convex";
import { RateLimiter, DAY } from "@convex-dev/rate-limiter";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { liveUserId } from "./liveIdentity";
import { storyFor } from "../server/story.mjs";
import { MODEL, mayConsult, mayReadSources, guidedQuestion, serviceStatus, sharedContext, sourceEvidence } from "./servicePolicy";
import { phase } from "./validators";

const limits = new RateLimiter(components.rateLimiter, {
  sourceDay: { kind: "fixed window", rate: 10, period: DAY }, // Two fixed URLs per job.
  aiDay: { kind: "fixed window", rate: 40, period: DAY },
  caseMailDay: { kind: "fixed window", rate: 10, period: DAY },
});
const mail = new AgentMail(components.agentmail, { retryAttempts: 1 });
const requestResult = v.object({ ok: v.boolean(), message: v.string() });
const empty = { sourceStatus: "idle" as const, sourceAttempts: 0, sources: [], aiStatus: "idle" as const, aiAttempts: 0 };
async function member(ctx: QueryCtx | MutationCtx, roomId: Id<"rooms">) {
  const userId = await liveUserId(ctx);
  const room = await ctx.db.get(roomId);
  if (!userId || !room?.state || (room.hostId !== userId && room.guestId !== userId))
    throw new ConvexError("This case is not available to this player.");
  return { userId, room, state: room.state };
}
async function services(ctx: QueryCtx | MutationCtx, roomId: Id<"rooms">) {
  return ctx.db.query("caseServices").withIndex("by_roomId", q => q.eq("roomId", roomId)).unique();
}

export const get = query({
  args: { roomId: v.id("rooms") },
  returns: v.object({ sourceStatus: serviceStatus, sourceAttempts: v.number(), sources: v.array(sourceEvidence), sourceError: v.union(v.string(), v.null()),
    aiStatus: serviceStatus, aiAttempts: v.number(), aiError: v.union(v.string(), v.null()), model: v.string(),
    phase, canConsult: v.boolean(), canReadSources: v.boolean(), aiConfigured: v.boolean(),
    messages: v.array(v.object({ id: v.string(), role: v.string(), text: v.string() })),
    mailStatus: v.union(v.string(), v.null()), canEmail: v.boolean() }),
  handler: async (ctx, { roomId }) => {
    const { state, userId } = await member(ctx, roomId);
    const row = await services(ctx, roomId);
    const readable = mayReadSources(state);
    const history = row?.threadId ? await listMessages(ctx, components.agent, { threadId: row.threadId,
      paginationOpts: { numItems: 24, cursor: null }, excludeToolMessages: true, statuses: ["success"] }) : null;
    const messages = history?.page.slice().reverse().flatMap(m => m.text && (m.message?.role === "user" || (m.message?.role === "assistant" && row?.visibleAIIds?.includes(m._id)))
      ? [{ id: m._id, role: m.message.role, text: m.text }] : []) ?? [];
    const receipt = await ctx.db.query("caseMail").withIndex("by_roomId_and_userId", q => q.eq("roomId", roomId).eq("userId", userId)).unique();
    const delivery = receipt ? await mail.status(ctx, receipt.outboundId) : null;
    const recovery = await ctx.db.query("recovery").withIndex("by_userId", q => q.eq("userId", userId)).unique();
    return { sourceStatus: row?.sourceStatus ?? "idle", sourceAttempts: row?.sourceAttempts ?? 0,
      sources: readable ? row?.sources ?? [] : [], sourceError: row?.sourceError ?? null,
      aiStatus: row?.aiStatus ?? "idle", aiAttempts: row?.aiAttempts ?? 0, aiError: row?.aiError ?? null,
      phase: state.phase, model: MODEL, canConsult: mayConsult(state), canReadSources: readable,
      aiConfigured: Boolean(process.env.AI_GATEWAY_API_KEY), messages,
      mailStatus: delivery?.status ?? (receipt ? "status-unavailable" : null),
      canEmail: state.phase === "resolved" && Boolean(recovery?.email && process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_INBOX_ID) };
  },
});

export const checkSources = mutation({
  args: { roomId: v.id("rooms") }, returns: requestResult,
  handler: async (ctx, { roomId }) => {
    const { state } = await member(ctx, roomId);
    if (!mayReadSources(state)) throw new ConvexError("Share both dispatch clues first.");
    let row = await services(ctx, roomId);
    if (row?.sourceStatus === "ready") return { ok: true, message: "The source evidence is already pinned to this case." };
    if (row?.sourceStatus === "working") return { ok: true, message: "The source check is already running." };
    if ((row?.sourceAttempts ?? 0) >= 2) return { ok: false, message: "This case has used its two source-check attempts." };
    if (!process.env.FIRECRAWL_API_KEY) return { ok: false, message: "Firecrawl is not configured." };
    if (!(await limits.limit(ctx, "sourceDay")).ok) return { ok: false, message: "Today's shared source-check budget is used. The cited puzzle still works; try a live check tomorrow." };
    if (!row) { const id = await ctx.db.insert("caseServices", { roomId, ...empty }); row = (await ctx.db.get(id))!; }
    const attempt = row.sourceAttempts + 1;
    await ctx.db.patch(row._id, { sourceStatus: "working", sourceAttempts: attempt, sourceError: undefined });
    await ctx.scheduler.runAfter(0, internal.caseWorkers.checkSources, { id: row._id, attempt });
    await ctx.scheduler.runAfter(150_000, internal.caseServices.finishSources, { id: row._id, attempt, error: "The source check timed out. No live evidence was recorded." });
    return { ok: true, message: "Checking two NASA mission pages with Firecrawl…" };
  },
});
export const finishSources = internalMutation({
  args: { id: v.id("caseServices"), attempt: v.number(), sources: v.optional(v.array(sourceEvidence)), error: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.sourceAttempts !== args.attempt || row.sourceStatus !== "working") return null;
    await ctx.db.patch(row._id, { sourceStatus: args.sources?.length === 2 ? "ready" : "failed", sources: args.sources ?? [], sourceError: args.error });
    return null;
  },
});
export const ask = mutation({
  args: { roomId: v.id("rooms"), question: v.string(), mode: v.optional(v.union(v.literal("chat"), v.literal("hint"), v.literal("reflection"))) }, returns: requestResult,
  handler: async (ctx, { roomId, question, mode = "chat" }) => {
    const { state, room, userId } = await member(ctx, roomId);
    const publicContext = sharedContext(state);
    const text = guidedQuestion(state, mode, question);
    let row = await services(ctx, roomId);
    if (row?.aiStatus === "working") return { ok: false, message: "Mara is answering your partner. Wait for that response." };
    if ((row?.aiAttempts ?? 0) >= 6) return { ok: false, message: "This case has used its six AI turns, including failed attempts." };
    if (!process.env.AI_GATEWAY_API_KEY) return { ok: false, message: "The AI provider is not configured." };
    if (!(await limits.limit(ctx, "aiDay")).ok) return { ok: false, message: "Today's shared AI budget is used. No substitute model will be called." };
    if (!row) { const id = await ctx.db.insert("caseServices", { roomId, ...empty }); row = (await ctx.db.get(id))!; }
    const threadId = row.threadId ?? await createThread(ctx, components.agent, { title: "OFFSCRIPT case conversation" });
    const previous = await listMessages(ctx, components.agent, { threadId, paginationOpts: { numItems: 24, cursor: null }, statuses: ["success"], excludeToolMessages: true });
    const conversation = previous.page.slice().reverse().flatMap(m => m.text && (m.message?.role === "user" || row!.visibleAIIds?.includes(m._id))
      ? [{ role: m.message?.role, text: m.text }] : []);
    const context = JSON.stringify({ case: JSON.parse(publicContext), conversation, requestMode: mode });
    const { messageId } = await saveMessage(ctx, components.agent, { threadId,
      prompt: `${userId === room.hostId ? "Archivist" : "Operator"}: ${text}` });
    const attempt = row.aiAttempts + 1;
    await ctx.db.patch(row._id, { threadId, aiStatus: "working", aiAttempts: attempt, aiError: undefined });
    await ctx.scheduler.runAfter(0, internal.caseWorkers.answer, { id: row._id, attempt, threadId, messageId, context });
    await ctx.scheduler.runAfter(75_000, internal.caseServices.finishAI, { id: row._id, attempt, error: "Mara did not answer in time. This turn counts toward the limit." });
    return { ok: true, message: "Mara is reading the shared case notes…" };
  },
});
export const finishAI = internalMutation({
  args: { id: v.id("caseServices"), attempt: v.number(), error: v.optional(v.string()), messageIds: v.optional(v.array(v.string())) }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.aiAttempts !== args.attempt || row.aiStatus !== "working") return null;
    const accepted = !args.error && args.messageIds?.length === 1;
    await ctx.db.patch(row._id, { aiStatus: accepted ? "ready" : "failed",
      aiError: accepted ? undefined : args.error ?? "The reply was withheld. Consult the printed evidence instead.",
      visibleAIIds: accepted ? [...(row.visibleAIIds ?? []), ...args.messageIds!].slice(-6) : row.visibleAIIds ?? [] });
    return null;
  },
});

export const emailDebrief = mutation({
  args: { roomId: v.id("rooms"), consent: v.literal(true) }, returns: requestResult,
  handler: async (ctx, { roomId }) => {
    const { state, userId } = await member(ctx, roomId);
    if (state.phase !== "resolved") throw new ConvexError("Agree on an ending before sending a debrief.");
    const existing = await ctx.db.query("caseMail").withIndex("by_roomId_and_userId", q => q.eq("roomId", roomId).eq("userId", userId)).unique();
    if (existing) return { ok: true, message: "Your debrief is already in the send queue or was sent. It won't be sent twice." };
    const recovery = await ctx.db.query("recovery").withIndex("by_userId", q => q.eq("userId", userId)).unique();
    if (!recovery?.email) throw new ConvexError("Save your player and verify a recovery email in Players & friends first.");
    if (!process.env.AGENTMAIL_API_KEY || !process.env.AGENTMAIL_INBOX_ID) return { ok: false, message: "Case email is not configured." };
    if (!(await limits.limit(ctx, "caseMailDay")).ok) return { ok: false, message: "Today's shared debrief email budget is used. Try tomorrow." };
    const row = await services(ctx, roomId);
    const history = row?.threadId ? await listMessages(ctx, components.agent, { threadId: row.threadId,
      paginationOpts: { numItems: 24, cursor: null }, statuses: ["success"], excludeToolMessages: true }) : null;
    const lastReply = history?.page.find(m => m.message?.role === "assistant" && m.text && row?.visibleAIIds?.includes(m._id))?.text;
    const outcome = storyFor(state)?.outcome;
    const text = `OFFSCRIPT — fictional case debrief\n\nYou and your partner chose to ${state.ending === "broadcast" ? "broadcast the recording" : "preserve the archive"}.\nTeam score: ${Math.max(0, 100 - (state.challenge?.mistakes ?? 0) * 5 - (state.challenge?.hints.length ?? 0) * 10)}/100.\n\n${outcome ? `Recorded outcome (authored fiction):\n${outcome.title}\n${outcome.text}\n\n` : ""}${lastReply ? `Mara Vale's last note (AI-generated fiction):\n${lastReply.slice(0, 3000)}\n\n` : ""}Source evidence: ${row?.sourceStatus === "ready" ? "NASA mission dates checked through Firecrawl and pinned to your case." : "Manually reviewed NASA citations; no completed live source check for this case."}\n\nThis is a receipt of your completed game, not a message from NASA. You explicitly requested this email. No reply is required or processed to unlock gameplay.\n\nReturn to OFFSCRIPT: ${process.env.SITE_URL ?? "https://flexible-kiwi-480.convex.site"}`;
    const outboundId = await mail.sendMessage(ctx, process.env.AGENTMAIL_INBOX_ID, { to: recovery.email,
      subject: "OFFSCRIPT — your Last Transmission debrief", text, labels: ["offscript", "case-debrief"] });
    await ctx.db.insert("caseMail", { roomId, userId, outboundId, consentAt: Date.now() });
    return { ok: true, message: "Debrief queued for your verified email. Sent does not mean delivered." };
  },
});
