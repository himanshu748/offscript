import { generateKeyPairSync, randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { tokenHash } from "../convex/recoveryMail";
import { normalizeEmail } from "../convex/recovery";

const modules = import.meta.glob("../convex/**/*.ts");
const envNames = ["JWT_PRIVATE_KEY", "CONVEX_SITE_URL", "SITE_URL", "AGENTMAIL_API_KEY", "AGENTMAIL_INBOX_ID"] as const;
const oldEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
let sent: Array<{ to: string[]; subject: string; text: string }>;
beforeAll(() => {
  process.env.JWT_PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  process.env.CONVEX_SITE_URL = "https://auth-fixture.invalid";
  process.env.SITE_URL = "https://game-fixture.invalid";
});
beforeEach(() => {
  process.env.AGENTMAIL_API_KEY = "test-only-not-a-real-key";
  process.env.AGENTMAIL_INBOX_ID = "sender@example.invalid";
  sent = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ message_id: "fixture" }), { status: 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });
afterAll(() => { for (const name of envNames) { if (oldEnv[name] === undefined) delete process.env[name]; else process.env[name] = oldEnv[name]; } });
function authed(t: ReturnType<typeof convexTest>, token: string) {
  return t.withIdentity({ subject: JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub });
}
function code() { return sent.at(-1)!.text.match(/\n([a-f0-9]{32})\n/)![1]; }
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const guest = await t.action(api.auth.signIn, { provider: "anonymous" });
  const alice = authed(t, guest.tokens!.token);
  const player = await alice.mutation(api.players.ensure, {});
  const password = randomUUID();
  await alice.action(api.auth.signIn, { provider: "player-password", params: { flow: "save", playerId: player.playerId, password } });
  const run = (client: Pick<typeof t, "action">, flow: string, extra: Record<string, string> = {}) => client.action(api.auth.signIn, {
    provider: "player-password", params: { flow, playerId: player.playerId, ...extra },
  });
  const verify = async () => {
    await run(alice, "recovery-email", { password, email: "owner@example.invalid" });
    await run(alice, "recovery-email-verify", { code: code() });
  };
  return { t, alice, player, password, run, verify };
}
describe("Verified-email recovery (email transport mocked)", () => {
  test("reset restores the same ID, friends, case and clues; old password and sessions stop working", async () => {
    const { t, alice, player, password, run, verify } = await setup();
    const guest = await t.action(api.auth.signIn, { provider: "anonymous" });
    const bob = authed(t, guest.tokens!.token);
    const other = await bob.mutation(api.players.ensure, {});
    await alice.mutation(api.players.request, { playerId: other.playerId });
    const [friend] = await bob.query(api.players.list, {});
    await bob.mutation(api.players.respond, { id: friend.id, action: "accept" });
    const inviteToken = randomUUID();
    const roomId = await alice.mutation(api.rooms.create, { inviteToken, createKey: randomUUID(), timed: false });
    await bob.mutation(api.rooms.join, { inviteToken });
    await alice.mutation(api.rooms.play, { roomId, operationId: randomUUID(), action: { type: "contribute", challengeIndex: 0 } });
    const before = await alice.query(api.rooms.get, { roomId });
    await verify();
    await run(t, "reset", { email: "owner@example.invalid" });
    const resetCode = code();
    const newPassword = randomUUID();
    const result = await run(t, "reset-verification", { code: resetCode, newPassword });
    const restored = authed(t, result.tokens!.token);
    expect(await restored.query(api.players.me, {})).toEqual(player);
    expect(await restored.query(api.players.list, {})).toMatchObject([{ status: "accepted", player: other }]);
    expect(await restored.query(api.rooms.get, { roomId })).toEqual(before);
    expect(await alice.query(api.rooms.get, { roomId })).toBeNull();
    expect(await alice.query(api.players.me, {})).toBeNull();
    await expect(alice.mutation(api.players.rename, { name: "Old session" })).rejects.toThrow();
    await expect(run(t, "signIn", { password })).rejects.toThrow("wasn’t accepted");
    expect(Boolean((await run(t, "signIn", { password: newPassword })).tokens)).toBe(true);
    await expect(run(t, "reset-verification", { code: resetCode, newPassword: randomUUID() })).rejects.toThrow("invalid or expired");
  });
  test("only a live saved owner with the password can attach an address; verification is required", async () => {
    const { t, alice, password, run } = await setup();
    await expect(run(t, "recovery-email", { password, email: "owner@example.invalid" })).rejects.toThrow("saved player");
    await expect(run(alice, "recovery-email", { password: randomUUID(), email: "owner@example.invalid" })).rejects.toThrow("wasn’t accepted");
    await run(alice, "recovery-email", { password, email: "owner@example.invalid" });
    const verificationCode = code();
    expect(await alice.query(api.recovery.status, {})).toMatchObject({ verified: false, pending: true });
    await run(t, "reset", { email: "owner@example.invalid" });
    expect(sent).toHaveLength(1);
    await expect(run(t, "recovery-email-verify", { code: verificationCode })).rejects.toThrow("invalid or expired");
    await run(alice, "recovery-email-verify", { code: verificationCode });
    expect(await alice.query(api.recovery.status, {})).toMatchObject({ verified: true, pending: false, emailHint: "o•••@example.invalid" });
    expect(await t.query(api.recovery.status, {})).toEqual({ available: true, verified: false, pending: false, emailHint: null });
  });
  test("newest reset code wins and database stores a digest, not the emailed secret", async () => {
    const { t, run, verify } = await setup();
    await verify();
    await run(t, "reset", { email: "owner@example.invalid" });
    const first = code();
    await run(t, "reset", { email: "owner@example.invalid" });
    const newest = code();
    const [row] = await t.run(ctx => ctx.db.query("recovery").take(2));
    expect(row.resetHash === newest).toBe(false);
    expect(row.resetHash).toBe(await tokenHash(newest));
    await expect(run(t, "reset-verification", { code: first, newPassword: randomUUID() })).rejects.toThrow("invalid or expired");
    expect(Boolean((await run(t, "reset-verification", { code: newest, newPassword: randomUUID() })).tokens)).toBe(true);
  });
  test("expiry is enforced server-side for both verification and reset", async () => {
    const { t, alice, password, run } = await setup();
    await run(alice, "recovery-email", { password, email: "owner@example.invalid" });
    await t.run(async ctx => { const row = (await ctx.db.query("recovery").take(1))[0]; await ctx.db.patch(row._id, { verifyExpires: Date.now() - 1 }); });
    await expect(run(alice, "recovery-email-verify", { code: code() })).rejects.toThrow("invalid or expired");
    await t.run(async ctx => { const row = (await ctx.db.query("recovery").take(1))[0]; await ctx.db.patch(row._id, { verifyExpires: Date.now() + 60000 }); });
    await run(alice, "recovery-email-verify", { code: code() });
    await run(t, "reset", { email: "owner@example.invalid" });
    await t.run(async ctx => { const row = (await ctx.db.query("recovery").take(1))[0]; await ctx.db.patch(row._id, { resetExpires: Date.now() - 1 }); });
    await expect(run(t, "reset-verification", { code: code(), newPassword: randomUUID() })).rejects.toThrow("invalid or expired");
  });
  test("wrong ID/email and matching requests have the same response; mail is rate limited", async () => {
    const { t, player, run, verify } = await setup();
    await verify();
    const unknown = await t.action(api.auth.signIn, { provider: "player-password", params: { flow: "reset", playerId: "OS-AAAAAAAAAA", email: "other@example.invalid" } });
    const wrong = await run(t, "reset", { email: "wrong@example.invalid" });
    const matching = await run(t, "reset", { email: "owner@example.invalid" });
    expect(unknown).toEqual(wrong); expect(matching).toEqual(wrong);
    await run(t, "reset", { email: "owner@example.invalid" });
    expect(sent).toHaveLength(2);
    for (let n = 0; n < 12; n++) await t.mutation(internal.recovery.attempt, { playerId: player.playerId });
    expect(await t.mutation(internal.recovery.attempt, { playerId: player.playerId })).toBe(false);
  });
  test("unverified email changes do not replace the old address; verifying invalidates old reset codes", async () => {
    const { t, alice, password, run, verify } = await setup();
    await verify();
    await run(t, "reset", { email: "owner@example.invalid" });
    const oldCode = code();
    await run(alice, "recovery-email", { password, email: "new@example.invalid" });
    expect(await alice.query(api.recovery.status, {})).toMatchObject({ emailHint: "o•••@example.invalid", pending: true });
    await run(alice, "recovery-email-verify", { code: code() });
    expect(await alice.query(api.recovery.status, {})).toMatchObject({ emailHint: "n•••@example.invalid", pending: false });
    await expect(run(t, "reset-verification", { code: oldCode, newPassword: randomUUID() })).rejects.toThrow("invalid or expired");
  });
  test("unavailable mail fails honestly; delivery failures never pretend verification email was sent", async () => {
    const { t, alice, password, run } = await setup();
    delete process.env.AGENTMAIL_API_KEY;
    expect(await t.query(api.recovery.status, {})).toMatchObject({ available: false });
    await expect(run(t, "reset", { email: "owner@example.invalid" })).rejects.toThrow("not configured");
    process.env.AGENTMAIL_API_KEY = "test-only-not-a-real-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failure", { status: 503 })));
    await expect(run(alice, "recovery-email", { password, email: "owner@example.invalid" })).rejects.toThrow("could not send");
  });
  test("code and email validation reject malformed inputs", async () => {
    expect(() => normalizeEmail("a\nb@example.invalid")).toThrow();
    expect(() => normalizeEmail("a".repeat(255) + "@example.invalid")).toThrow();
    expect(normalizeEmail(" Owner@Example.invalid ")).toBe("owner@example.invalid");
    await expect(tokenHash("123456")).rejects.toThrow("complete recovery code");
  });
});
