import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { liveUserId } from "./liveIdentity";
import { MODEL, NASA_SOURCES } from "./servicePolicy";
import { serviceLimits } from "./serviceLimits";

const RECEIPT_KEY = "nasa-launch-dates-v1";
const PACK_KEY = "voyager-later-v1";
const DAY = 86_400_000;
const result = v.object({ ok: v.boolean(), message: v.string() });
const reservation = v.union(
  v.object({ status: v.literal("ready"), sources: v.array(v.object({ title: v.string(), url: v.string(), launchDate: v.string() })) }),
  v.object({ status: v.literal("complete") }),
  v.object({ status: v.literal("needs-source") }),
  v.object({ status: v.literal("budget-used") }),
);

export const library = query({
  args: {},
  returns: v.object({
    total: v.number(),
    generated: v.number(),
    sourceReady: v.boolean(),
    checkedAt: v.union(v.number(), v.null()),
    packs: v.array(v.object({ title: v.string(), provenance: v.string() })),
  }),
  handler: async (ctx) => {
    const packs = await ctx.db.query("casePacks").withIndex("by_published", q => q.eq("published", true)).order("desc").take(6);
    const receipt = await ctx.db.query("publicSourceReceipts").withIndex("by_key", q => q.eq("key", RECEIPT_KEY)).unique();
    const sourceReady = Boolean(receipt && Date.now() - receipt.checkedAt < DAY && receipt.sources.length === 2);
    return {
      total: 1 + packs.length,
      generated: packs.length,
      sourceReady,
      checkedAt: sourceReady ? receipt!.checkedAt : null,
      packs: [
        { title: "First departure", provenance: "Authored baseline" },
        ...packs.map(pack => ({ title: pack.title, provenance: "Firecrawl facts · AI draft · Convex validated" })),
      ],
    };
  },
});

export const reserveGeneration = internalMutation({
  args: {},
  returns: reservation,
  handler: async (ctx) => {
    if (!(await liveUserId(ctx))) throw new ConvexError("Open a guest session before building a case brief.");
    const existing = await ctx.db.query("casePacks").withIndex("by_packKey", q => q.eq("packKey", PACK_KEY)).unique();
    if (existing?.published) return { status: "complete" as const };
    const receipt = await ctx.db.query("publicSourceReceipts").withIndex("by_key", q => q.eq("key", RECEIPT_KEY)).unique();
    if (!receipt || Date.now() - receipt.checkedAt >= DAY || receipt.sources.length !== 2) return { status: "needs-source" as const };
    if (!(await serviceLimits.limit(ctx, "aiDay")).ok) return { status: "budget-used" as const };
    return { status: "ready" as const, sources: receipt.sources.map(source => ({ title: source.title, url: source.url, launchDate: source.launchDate })) };
  },
});

function bounded(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string") throw new Error(`${field} is missing`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${field} is outside its allowed length`);
  return text;
}

function parseDraft(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The model did not return JSON");
  const raw = JSON.parse(match[0]) as Record<string, unknown>;
  const draft = {
    title: bounded(raw.title, "title", 4, 56),
    operatorTitle: bounded(raw.operatorTitle, "operatorTitle", 4, 64),
    operatorText: bounded(raw.operatorText, "operatorText", 35, 360),
    prompt: bounded(raw.prompt, "prompt", 20, 180),
    hint: bounded(raw.hint, "hint", 20, 180),
  };
  const combined = Object.values(draft).join(" ");
  // The model writes presentation only. It may describe the comparison, but
  // cannot publish either mission name, either date, or an answer-shaped line.
  if (/voyager|1977|august|september|\b08-20\b|\b09-05\b|answer\s*(?:is|:|=)/i.test(combined))
    throw new Error("The draft leaked a verified fact or answer");
  return draft;
}

export const publishGenerated = internalMutation({
  args: {
    draft: v.object({ title: v.string(), operatorTitle: v.string(), operatorText: v.string(), prompt: v.string(), hint: v.string() }),
    sources: v.array(v.object({ title: v.string(), url: v.string(), launchDate: v.string() })),
  },
  returns: result,
  handler: async (ctx, { draft, sources }) => {
    const receipt = await ctx.db.query("publicSourceReceipts").withIndex("by_key", q => q.eq("key", RECEIPT_KEY)).unique();
    if (!receipt || Date.now() - receipt.checkedAt >= DAY || receipt.sources.length !== 2)
      return { ok: false, message: "The source receipt expired before publication. Run the source check again." };
    const canonical = NASA_SOURCES.map(source => ({ title: source.title, url: source.url, launchDate: source.launchDate }));
    const matchesCanonical = (items: Array<{ title: string; url: string; launchDate: string }>) =>
      items.length === canonical.length && canonical.every((source, index) => items[index]?.title === source.title && items[index]?.url === source.url && items[index]?.launchDate === source.launchDate);
    if (!matchesCanonical(sources) || !matchesCanonical(receipt.sources))
      return { ok: false, message: "The verified facts changed before publication. No case was published." };
    const existing = await ctx.db.query("casePacks").withIndex("by_packKey", q => q.eq("packKey", PACK_KEY)).unique();
    if (existing?.published) return { ok: true, message: "The source-backed brief is already in the case library." };
    const later = canonical.reduce((best, source) => source.launchDate > best.launchDate ? source : best);
    const clues = {
      archivist: {
        id: `${PACK_KEY}-manifest`, title: "The verified launch manifest", kind: "historical-facts",
        text: `Voyager 1 launched on September 5, 1977. Voyager 2 launched on August 20, 1977. Match the dispatch to its mission and ISO launch date.`,
        sources: canonical,
      },
      operator: { id: `${PACK_KEY}-routing`, title: draft.operatorTitle, kind: "fictional-clue", text: draft.operatorText, sources: [] },
    };
    const value = {
      packKey: PACK_KEY, title: draft.title, criterion: "later" as const,
      prompt: draft.prompt, hint: draft.hint, clues,
      solution: { mission: later.title.replace("NASA: ", "").toLowerCase().replace(/[\s-]/g, ""), launchDate: later.launchDate },
      sourceReceiptKey: RECEIPT_KEY, createdAt: Date.now(), published: true,
    };
    if (existing) await ctx.db.patch(existing._id, value); else await ctx.db.insert("casePacks", value);
    return { ok: true, message: `Published “${draft.title}”. New rooms now open with the source-backed brief.` };
  },
});

export const generate = action({
  args: {},
  returns: result,
  handler: async (ctx): Promise<{ ok: boolean; message: string }> => {
    const reserved = await ctx.runMutation(internal.casePacks.reserveGeneration, {});
    if (reserved.status === "complete") return { ok: true, message: "The source-backed brief is already in the case library." };
    if (reserved.status === "needs-source") return { ok: false, message: "Finish an opening case and run its live Firecrawl source check first. A fresh verified receipt is required." };
    if (reserved.status === "budget-used") return { ok: false, message: "Today’s shared AI budget is used. The authored case remains available; try generation tomorrow." };
    if (!process.env.AI_GATEWAY_API_KEY) return { ok: false, message: "The configured AI model is unavailable. The authored case remains playable." };
    try {
      const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
      const facts = reserved.sources.map(source => ({ label: source.title.replace("NASA: ", ""), launchDate: source.launchDate }));
      const response = await generateText({
        model: gateway(MODEL), maxOutputTokens: 320, maxRetries: 0, abortSignal: AbortSignal.timeout(45_000),
        providerOptions: { gateway: { only: ["openai"] } },
        prompt: `Return one JSON object and nothing else for a two-player mystery opening. Verified facts: ${JSON.stringify(facts)}. Convex has already chosen the criterion LATER and will compute the answer itself. Draft only: title, operatorTitle, operatorText, prompt, hint. The archivist sees the verified dates. The operatorText must tell their partner to select the mission that left Earth later and submit its ISO launch date, without naming either mission, stating a date, year, answer, or solution. The prompt asks for mission and ISO date. The hint explains comparing dates, without facts or answer. Plain English, tense but not melodramatic. No markdown.`,
      });
      return await ctx.runMutation(internal.casePacks.publishGenerated, { draft: parseDraft(response.text), sources: reserved.sources });
    } catch {
      return { ok: false, message: "The configured OpenAI model did not return a safe case brief. Nothing was published and no fallback was called." };
    }
  },
});
