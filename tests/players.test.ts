import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(ctx => Promise.all(Array.from({ length: 3 }, () => ctx.db.insert("users", { isAnonymous: true }))));
  const [alice, bob, stranger] = ids.map(id => t.withIdentity({ subject: `${id}|session` }));
  const [a, b, c] = await Promise.all([alice, bob, stranger].map(client => client.mutation(api.players.ensure, {})));
  return { t, ids, alice, bob, stranger, a, b, c };
}
describe("Player IDs and friends", () => {
  test("server-issued handles are stable, unique, public-only and bound to the authenticated user", async () => {
    const { t, ids, alice, bob, a, b } = await setup();
    expect(a.playerId).toMatch(/^OS-[A-Z2-9]{10}$/);
    expect(a.playerId).not.toBe(b.playerId);
    expect(await alice.mutation(api.players.ensure, {})).toEqual(a);
    expect(await t.withIdentity({ subject: `${ids[0]}|another-session` }).query(api.players.me, {})).toEqual(a);
    await alice.mutation(api.players.rename, { name: "अदिति" });
    expect((await alice.query(api.players.me, {}))?.name).toBe("अदिति");
    expect(await bob.query(api.players.me, {})).toEqual(b);
    expect(Object.keys(a).sort()).toEqual(["name", "playerId"]);
    expect(await t.query(api.players.me, {})).toBeNull();
    await expect(t.mutation(api.players.ensure, {})).rejects.toThrow("guest session");
    await expect(alice.mutation(api.players.rename, { name: "\u202Ehidden" })).rejects.toThrow("2–24");
  });
  test("requests require recipient consent; crossed and duplicate requests stay a single pending relationship", async () => {
    const { alice, bob, stranger, a, b } = await setup();
    await alice.mutation(api.players.request, { playerId: b.playerId.toLowerCase() });
    await alice.mutation(api.players.request, { playerId: b.playerId });
    await bob.mutation(api.players.request, { playerId: a.playerId });
    const rows = await bob.query(api.players.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ incoming: true, status: "pending", player: a });
    expect(await stranger.query(api.players.list, {})).toEqual([]);
    await expect(alice.mutation(api.players.respond, { id: rows[0].id, action: "accept" })).rejects.toThrow("recipient");
    await expect(stranger.mutation(api.players.respond, { id: rows[0].id, action: "remove" })).rejects.toThrow("available");
    await bob.mutation(api.players.respond, { id: rows[0].id, action: "accept" });
    expect(await alice.query(api.players.list, {})).toMatchObject([{ incoming: false, status: "accepted", player: b }]);
    await alice.mutation(api.players.respond, { id: rows[0].id, action: "remove" });
    expect(await bob.query(api.players.list, {})).toEqual([]);
  });
  test("self-add and unknown IDs are rejected; decline and cancel clear both sides", async () => {
    const { alice, bob, a, b } = await setup();
    await expect(alice.mutation(api.players.request, { playerId: a.playerId })).rejects.toThrow("own player ID");
    await expect(alice.mutation(api.players.request, { playerId: "OS-AAAAAAAAAA" })).rejects.toThrow("wasn’t found");
    for (const responder of [bob, alice]) {
      await alice.mutation(api.players.request, { playerId: b.playerId });
      const [row] = await alice.query(api.players.list, {});
      await responder.mutation(api.players.respond, { id: row.id, action: "remove" });
      expect(await bob.query(api.players.list, {})).toEqual([]);
      expect(await alice.query(api.players.list, {})).toEqual([]);
    }
  });
  test("only accepted friends can reserve a seat, and only its recipient can join", async () => {
    const { alice, bob, stranger, a, b } = await setup();
    const args = { inviteToken: crypto.randomUUID(), createKey: crypto.randomUUID(), friendPlayerId: b.playerId, timed: true };
    await expect(alice.mutation(api.rooms.create, args)).rejects.toThrow("Become friends");
    await alice.mutation(api.players.request, { playerId: b.playerId });
    const [request] = await bob.query(api.players.list, {});
    await expect(alice.mutation(api.rooms.create, args)).rejects.toThrow("Become friends");
    await bob.mutation(api.players.respond, { id: request.id, action: "accept" });
    const roomId = await alice.mutation(api.rooms.create, args);
    expect(await bob.query(api.rooms.invitations, {})).toEqual([{ roomId, inviteToken: args.inviteToken, host: a, timed: true }]);
    expect(await stranger.query(api.rooms.invitations, {})).toEqual([]);
    await expect(stranger.mutation(api.rooms.join, { inviteToken: args.inviteToken })).rejects.toThrow("reserved");
    expect(await bob.query(api.rooms.get, { roomId })).toBeNull();
    await bob.mutation(api.rooms.join, { inviteToken: args.inviteToken });
    expect(await bob.query(api.rooms.invitations, {})).toEqual([]);
    expect((await bob.query(api.rooms.get, { roomId }))?.players).toEqual({ archivist: a, operator: b });
    expect(await stranger.query(api.rooms.get, { roomId })).toBeNull();
  });
  test("removing a friendship withdraws unclaimed invitations", async () => {
    const { alice, bob, b } = await setup();
    await alice.mutation(api.players.request, { playerId: b.playerId });
    const [friend] = await bob.query(api.players.list, {});
    await bob.mutation(api.players.respond, { id: friend.id, action: "accept" });
    const inviteToken = crypto.randomUUID();
    await alice.mutation(api.rooms.create, { inviteToken, createKey: crypto.randomUUID(), friendPlayerId: b.playerId });
    await bob.mutation(api.players.respond, { id: friend.id, action: "remove" });
    expect(await bob.query(api.rooms.invitations, {})).toEqual([]);
    await expect(bob.mutation(api.rooms.join, { inviteToken })).rejects.toThrow("no longer available");
  });
  test("friend lists including pending requests are bounded", async () => {
    const { t, ids, alice, bob, b } = await setup();
    await t.run(async ctx => {
      for (let i = 0; i < 50; i++) {
        const other = await ctx.db.insert("users", { isAnonymous: true });
        await ctx.db.insert("friendships", { requester: ids[0], recipient: other, pair: [ids[0], other].sort().join(":"), status: "pending" });
      }
    });
    await expect(alice.mutation(api.players.request, { playerId: b.playerId })).rejects.toThrow("full");
    expect(await bob.query(api.players.list, {})).toEqual([]);
  });
  test("20 authenticated players have ten isolated two-seat games with independently attributed moves", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(ctx => Promise.all(Array.from({ length: 20 }, () => ctx.db.insert("users", { isAnonymous: true }))));
    const clients = ids.map(id => t.withIdentity({ subject: `${id}|session` }));
    const profiles = await Promise.all(clients.map(client => client.mutation(api.players.ensure, {})));
    expect(new Set(profiles.map(p => p.playerId)).size).toBe(20);
    const rooms = await Promise.all(Array.from({ length: 10 }, async (_, i) => {
      const inviteToken = crypto.randomUUID();
      const roomId = await clients[i * 2].mutation(api.rooms.create, { inviteToken, createKey: crypto.randomUUID(), timed: false });
      await clients[i * 2 + 1].mutation(api.rooms.join, { inviteToken });
      return roomId;
    }));
    await Promise.all(clients.map((client, i) => client.mutation(api.rooms.play, {
      roomId: rooms[Math.floor(i / 2)], operationId: `share-${i}`, action: { type: "contribute", challengeIndex: 0 },
    })));
    for (let i = 0; i < 20; i++) {
      const roomIndex = Math.floor(i / 2);
      const mine = await clients[i].query(api.rooms.get, { roomId: rooms[roomIndex] });
      expect(mine?.view?.role).toBe(i % 2 === 0 ? "archivist" : "operator");
      expect(mine?.view?.contributions.slice().sort()).toEqual(["archivist", "operator"]);
      expect(mine?.players).toEqual({ archivist: profiles[roomIndex * 2], operator: profiles[roomIndex * 2 + 1] });
      expect(await clients[i].query(api.rooms.get, { roomId: rooms[(roomIndex + 1) % 10] })).toBeNull();
    }
  });
});
