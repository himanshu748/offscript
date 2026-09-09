import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { createThread, saveMessage } from "@convex-dev/agent";
import { api, internal, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import { mayConsult, sharedContext, questionText, guidedQuestion, verifySource, validateCharacterReply } from "../convex/servicePolicy";
import { createCase, applyPlayerAction } from "../server/engine.mjs";

const modules = import.meta.glob("../convex/**/*.ts");
const modelFixture = vi.hoisted(() => ({ text: "Compare the dates on the printed manifest.", requests: [] as unknown[] }));
vi.mock("@ai-sdk/gateway", async () => {
  const { mockModel } = await import("@convex-dev/agent");
  return { createGateway: () => () => {
    const model = mockModel({ content: [{ type: "text", text: modelFixture.text }] });
    const generate = model.doGenerate.bind(model);
    model.doGenerate = options => { modelFixture.requests.push(options); return generate(options); };
    return model;
  } };
});
async function setup() {
  const t = convexTest(schema, modules);
  agentTest.register(t); rateLimiterTest.register(t);
  const users = await t.run(ctx => Promise.all([0, 1, 2].map(() => ctx.db.insert("users", { isAnonymous: true }))));
  const [host, guest, stranger] = users.map((id, i) => t.withIdentity({ subject: `${id}|session-${i}` }));
  const roomId = await host.mutation(api.rooms.create, { inviteToken: crypto.randomUUID(), createKey: crypto.randomUUID(), timed: false });
  const room = await t.run(ctx => ctx.db.get(roomId));
  await guest.mutation(api.rooms.join, { inviteToken: room!.inviteToken });
  const share = async () => { for (const actor of [host, guest]) await actor.mutation(api.rooms.play, { roomId, operationId: crypto.randomUUID(), action: { type: "contribute", challengeIndex: 0 } }); };
  const row = async (patch = {}) => t.run(ctx => ctx.db.insert("caseServices", { roomId,
    sourceStatus: "idle", sourceAttempts: 0, sources: [], aiStatus: "idle", aiAttempts: 0, ...patch }));
  return { t, host, guest, stranger, users, roomId, share, row };
}
describe("Bounded case services (no external providers called)", () => {
  test("guided AI modes are stage-gated and never trust a client-authored outcome", () => {
    const state = createCase({ archivist: "a", operator: "b" }, "secret-room");
    expect(guidedQuestion(state, "hint", "invented client instruction")).toContain("one small nudge");
    expect(guidedQuestion(state, "hint", "invented client instruction")).not.toContain("invented client instruction");
    expect(() => guidedQuestion(state, "reflection", "")).toThrow("Agree on an ending");
    state.phase = "resolved"; state.ending = "preserve";
    expect(guidedQuestion(state, "reflection", "broadcast instead")).toContain("saved ending");
    expect(() => guidedQuestion(state, "hint", "")).toThrow("active investigation");
  });
  test("only shared evidence reaches AI; no seed, identities or unrevealed clue", () => {
    let state = createCase({ archivist: "private-user-a", operator: "private-user-b" }, "private-seed");
    expect(mayConsult(state)).toBe(false);
    expect(() => sharedContext(state)).toThrow("Share both");
    state = applyPlayerAction(state, "private-user-a", "a", { type: "contribute", challengeIndex: 0 });
    expect(() => sharedContext(state)).toThrow();
    state = applyPlayerAction(state, "private-user-b", "b", { type: "contribute", challengeIndex: 0 });
    const context = sharedContext(state);
    expect(context).toContain("launch");
    expect(context).not.toContain("Voyager");
    expect(context).not.toContain("1977");
    expect(context).toContain("recoveredTestimony");
    expect(context).not.toContain("my initials");
    expect(context).not.toContain("do not broadcast my name");
    expect(context).not.toContain("private-seed"); expect(context).not.toContain("private-user"); expect(context).not.toContain("solution");
  });
  test("question input is bounded and nonempty", () => {
    expect(questionText("  What next? ")).toBe("What next?");
    expect(() => questionText(" ")).toThrow();
    expect(() => questionText("x".repeat(501))).toThrow();
  });
  test("known wrong historical assertion is withheld rather than published", () => {
    expect(() => validateCharacterReply("Voyager 2 launched after Voyager 1.")).toThrow();
    expect(() => validateCharacterReply("The date is August 20, 1977.")).toThrow();
    expect(validateCharacterReply("Compare the two dates on the printed manifest. Which is earlier?")).toContain("Compare");
  });
  test("source check fails on missing or changed facts and pins a hash only for matching evidence", async () => {
    await expect(verifySource(undefined, 0, 123)).rejects.toThrow();
    await expect(verifySource("Voyager 1 launched on September 6, 1977", 0, 123)).rejects.toThrow();
    const receipt = await verifySource("Voyager 1 launched on September 5, 1977", 0, 123);
    expect(receipt.hash).toMatch(/^[a-f0-9]{64}$/); expect(receipt.checkedAt).toBe(123); expect(receipt.launchDate).toBe("1977-09-05");
    expect(receipt.excerpt.length).toBeLessThan(80);
  });
  test("only the two room members can read or request services", async () => {
    const { host, stranger, roomId } = await setup();
    expect((await host.query(api.caseServices.get, { roomId })).messages).toEqual([]);
    await expect(stranger.query(api.caseServices.get, { roomId })).rejects.toThrow("not available");
    await expect(stranger.mutation(api.caseServices.ask, { roomId, question: "hello" })).rejects.toThrow("not available");
    await expect(stranger.mutation(api.caseServices.checkSources, { roomId })).rejects.toThrow("not available");
    await expect(stranger.mutation(api.caseServices.emailDebrief, { roomId, consent: true })).rejects.toThrow("not available");
  });
  test("source and AI requests stay sealed until both players contribute", async () => {
    const { host, roomId } = await setup();
    await expect(host.mutation(api.caseServices.ask, { roomId, question: "read my partner's clue" })).rejects.toThrow("Share both");
    await expect(host.mutation(api.caseServices.checkSources, { roomId })).rejects.toThrow("Share both");
  });
  test("room limits include failed attempts and reject duplicate in-flight AI", async () => {
    const { t, host, roomId, share, row } = await setup(); await share();
    const id = await row({ sourceAttempts: 2, aiAttempts: 6 });
    expect((await host.mutation(api.caseServices.checkSources, { roomId })).ok).toBe(false);
    expect((await host.mutation(api.caseServices.ask, { roomId, question: "help" })).ok).toBe(false);
    await t.run(ctx => ctx.db.patch(id, { aiAttempts: 1, aiStatus: "working" }));
    expect((await host.mutation(api.caseServices.ask, { roomId, question: "help" })).message).toContain("answering your partner");
  });
  test("source pins are immutable through public requests and late callbacks cannot replace them", async () => {
    const { t, host, roomId, share, row } = await setup(); await share();
    const id = await row({ sourceStatus: "working", sourceAttempts: 1 });
    const sources = await Promise.all([verifySource("Voyager 1 September 5, 1977", 0, 123), verifySource("Voyager 2 August 20, 1977", 1, 123)]);
    await t.mutation(internal.caseServices.finishSources, { id, attempt: 1, sources });
    await t.mutation(internal.caseServices.finishSources, { id, attempt: 1, error: "late timeout" });
    expect((await host.mutation(api.caseServices.checkSources, { roomId })).message).toContain("already pinned");
    expect((await host.query(api.caseServices.get, { roomId })).sources).toEqual(sources);
  });
  test("AI messages persist in the Agent component and are shared only within the room", async () => {
    const { t, host, guest, stranger, roomId, row } = await setup();
    const threadId = await t.run(ctx => createThread(ctx, components.agent, {}));
    const id = await row({ threadId, aiStatus: "working", aiAttempts: 1 });
    const saved = await t.run(ctx => saveMessage(ctx, components.agent, { threadId, message: { role: "assistant", content: "Fixture-only archivist response." } }));
    expect((await host.query(api.caseServices.get, { roomId })).messages).toEqual([]);
    await t.mutation(internal.caseServices.finishAI, { id, attempt: 1, messageIds: [saved.messageId] });
    const a = await host.query(api.caseServices.get, { roomId });
    const b = await guest.query(api.caseServices.get, { roomId });
    expect(a.messages[0].text).toBe("Fixture-only archivist response."); expect(a.messages).toEqual(b.messages);
    await expect(stranger.query(api.caseServices.get, { roomId })).rejects.toThrow();
  });
  test("email requires explicit consent, a resolved case and a verified address", async () => {
    const { t, host, roomId } = await setup();
    await expect(host.mutation(api.caseServices.emailDebrief, { roomId, consent: true })).rejects.toThrow("Agree on an ending");
    await t.run(async ctx => { const room = await ctx.db.get(roomId); await ctx.db.patch(roomId, { state: { ...room!.state!, phase: "resolved", ending: "preserve" } }); });
    await expect(host.mutation(api.caseServices.emailDebrief, { roomId, consent: true })).rejects.toThrow("verify a recovery email");
    expect((await host.query(api.caseServices.get, { roomId })).canEmail).toBe(false);
  });
  for (const publish of [true, false]) test(`AI worker with fixture model ${publish ? "publishes approved output and includes the current prompt" : "withholds a historical restatement"}`, async () => {
    const { t, host, roomId, row } = await setup();
    modelFixture.text = publish ? "Compare the dates on the printed manifest." : "Voyager 2 launched after Voyager 1.";
    modelFixture.requests = [];
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only-not-a-real-key");
    try {
      const threadId = await t.run(ctx => createThread(ctx, components.agent, {}));
      const id = await row({ threadId, aiStatus: "working", aiAttempts: 1 });
      await t.run(ctx => saveMessage(ctx, components.agent, { threadId, message: { role: "assistant", content: "UNAPPROVED_OLD_REPLY" } }));
      const { messageId } = await t.run(ctx => saveMessage(ctx, components.agent, { threadId, prompt: "How should we compare these dates?" }));
      await t.action(internal.caseWorkers.answer, { id, attempt: 1, threadId, messageId, context: "{}" });
      const view = await host.query(api.caseServices.get, { roomId });
      expect(view.aiStatus).toBe(publish ? "ready" : "failed");
      expect(view.messages.some(m => m.role === "assistant")).toBe(publish);
      expect(modelFixture.requests).toHaveLength(1);
      expect(JSON.stringify(modelFixture.requests)).toContain("How should we compare these dates?");
      expect(JSON.stringify(modelFixture.requests)).not.toContain("UNAPPROVED_OLD_REPLY");
    } finally { vi.unstubAllEnvs(); }
  });
});
