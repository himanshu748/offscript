import { generateKeyPairSync, randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { Scrypt } from "lucia";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { linkAccountUser, validateNewPassword } from "../convex/accountLinking";

const modules = import.meta.glob("../convex/**/*.ts");
const oldKey = process.env.JWT_PRIVATE_KEY;
const oldSite = process.env.CONVEX_SITE_URL;
beforeAll(() => {
  // Ephemeral test-only signing key. Never written to disk or printed.
  process.env.JWT_PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  process.env.CONVEX_SITE_URL = "https://auth-fixture.invalid";
});
afterAll(() => {
  if (oldKey === undefined) delete process.env.JWT_PRIVATE_KEY; else process.env.JWT_PRIVATE_KEY = oldKey;
  if (oldSite === undefined) delete process.env.CONVEX_SITE_URL; else process.env.CONVEX_SITE_URL = oldSite;
});
function authenticated(t: ReturnType<typeof convexTest>, token: string) {
  const { sub } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  return t.withIdentity({ subject: sub });
}
async function setup() {
  const t = convexTest(schema, modules);
  const guest = await t.action(api.auth.signIn, { provider: "anonymous" });
  const other = await t.action(api.auth.signIn, { provider: "anonymous" });
  const alice = authenticated(t, guest.tokens!.token);
  const bob = authenticated(t, other.tokens!.token);
  const a = await alice.mutation(api.players.ensure, {});
  const b = await bob.mutation(api.players.ensure, {});
  const password = randomUUID();
  return { t, alice, bob, a, b, password };
}
describe("Persistent player accounts", () => {
  test("saving a guest keeps its owner, ID, friendships, room and clue progress; a new session restores them", async () => {
    const { t, alice, bob, a, b, password } = await setup();
    await alice.mutation(api.players.request, { playerId: b.playerId });
    const [friend] = await bob.query(api.players.list, {});
    await bob.mutation(api.players.respond, { id: friend.id, action: "accept" });
    const inviteToken = randomUUID();
    const roomId = await alice.mutation(api.rooms.create, { inviteToken, createKey: randomUUID(), timed: false });
    await bob.mutation(api.rooms.join, { inviteToken });
    await alice.mutation(api.rooms.play, { roomId, operationId: randomUUID(), action: { type: "contribute", challengeIndex: 0 } });
    const before = await alice.query(api.rooms.get, { roomId });
    const beforeAccount = await alice.query(internal.accounts.owner, {});
    const saved = await alice.action(api.auth.signIn, { provider: "player-password", params: { flow: "save", playerId: a.playerId, password } });
    expect(Boolean(saved.tokens?.token)).toBe(true);
    const savedAccount = await authenticated(t, saved.tokens!.token).query(internal.accounts.owner, {});
    expect(savedAccount?.sessionId).toBe(beforeAccount?.sessionId);
    expect(savedAccount?.saved).toBe(true);
    const loggedIn = await t.action(api.auth.signIn, { provider: "player-password", params: { flow: "signIn", playerId: a.playerId.toLowerCase(), password } });
    const secondDevice = authenticated(t, loggedIn.tokens!.token);
    expect(await secondDevice.query(api.players.me, {})).toEqual(a);
    expect(await secondDevice.query(api.accounts.status, {})).toEqual({ playerId: a.playerId, saved: true });
    expect(await secondDevice.query(api.rooms.get, { roomId })).toEqual(before);
    expect(await secondDevice.query(api.players.list, {})).toMatchObject([{ status: "accepted", player: b }]);
    expect(await secondDevice.query(api.rooms.mine, {})).toMatchObject([{ roomId, role: "archivist" }]);
    const account = await t.run(ctx => ctx.db.query("authAccounts").withIndex("providerAndAccountId", q => q.eq("provider", "player-password").eq("providerAccountId", a.playerId)).unique());
    expect(Boolean(account?.secret && account.secret !== password)).toBe(true);
    expect(await new Scrypt().verify(account!.secret!, password)).toBe(true);
    expect((await t.run(ctx => ctx.db.get(account!.userId)))?.isAnonymous).toBe(false);
    expect(await t.run(ctx => ctx.db.query("players").take(10))).toHaveLength(2);
  });
  test("only the live owner session can save a guest; another public ID is not proof of ownership", async () => {
    const { t, alice, bob, a, b, password } = await setup();
    const params = { flow: "save", playerId: a.playerId, password };
    await expect(t.action(api.auth.signIn, { provider: "player-password", params })).rejects.toThrow("only save");
    await expect(bob.action(api.auth.signIn, { provider: "player-password", params })).rejects.toThrow("only save");
    await expect(alice.run(ctx => linkAccountUser(ctx, { existingUserId: null, provider: { id: "player-password" }, profile: { email: b.playerId } }))).rejects.toThrow("cannot claim");
    expect(await alice.query(api.accounts.status, {})).toMatchObject({ saved: false });
    expect(await t.query(api.accounts.status, {})).toBeNull();
  });
  test("incorrect passwords cannot sign in or overwrite a saved password; failures are rate limited", async () => {
    const { t, alice, a, password } = await setup();
    const saved = await alice.action(api.auth.signIn, { provider: "player-password", params: { flow: "save", playerId: a.playerId, password } });
    const savedClient = authenticated(t, saved.tokens!.token);
    await expect(t.action(api.auth.signIn, { provider: "player-password", params: { flow: "signIn", playerId: a.playerId, password: randomUUID() } })).rejects.toThrow("wasn’t accepted");
    await expect(savedClient.action(api.auth.signIn, { provider: "player-password", params: { flow: "save", playerId: a.playerId, password: randomUUID() } })).rejects.toThrow("wasn’t accepted");
    const limits = await t.run(ctx => ctx.db.query("authRateLimits").take(5));
    expect(limits).toHaveLength(1);
    expect(limits[0].attemptsLeft).toBeLessThan(9);
    const result = await t.action(api.auth.signIn, { provider: "player-password", params: { flow: "signIn", playerId: a.playerId, password } });
    expect(Boolean(result.tokens?.token)).toBe(true);
  });
  test("signing into an existing account does not merge an unrelated guest or its rooms", async () => {
    const { alice, bob, a, b, password, t } = await setup();
    const bobRoom = await bob.mutation(api.rooms.create, { inviteToken: randomUUID(), createKey: randomUUID() });
    await alice.action(api.auth.signIn, { provider: "player-password", params: { flow: "save", playerId: a.playerId, password } });
    const login = await bob.action(api.auth.signIn, { provider: "player-password", params: { flow: "signIn", playerId: a.playerId, password } });
    const switched = authenticated(t, login.tokens!.token);
    expect(await switched.query(api.players.me, {})).toEqual(a);
    expect(await switched.query(api.rooms.get, { roomId: bobRoom })).toBeNull();
    expect(await switched.query(api.rooms.mine, {})).toEqual([]);
    const original = await t.run(ctx => ctx.db.query("players").withIndex("by_playerId", q => q.eq("playerId", b.playerId)).unique());
    expect(original?.playerId).toBe(b.playerId);
  });
  test("validation bounds password work and revoked sessions cannot enroll credentials", async () => {
    expect(() => validateNewPassword("short")).toThrow("12 and 128");
    expect(() => validateNewPassword("a".repeat(129))).toThrow("12 and 128");
    const { alice, a, password } = await setup();
    await alice.action(api.auth.signOut, {});
    await expect(alice.action(api.auth.signIn, { provider: "player-password", params: { flow: "save", playerId: a.playerId, password } })).rejects.toThrow("only save");
  });
});
