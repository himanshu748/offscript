import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { createCase } from "../server/engine.mjs";
import { challengeFor } from "../server/challenges.mjs";
import presenceTest from "@convex-dev/presence/test";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup(timed = false) {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  const users = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("users", { isAnonymous: true }),
      ctx.db.insert("users", { isAnonymous: true }),
      ctx.db.insert("users", { isAnonymous: true }),
    ]),
  );
  const host = t.withIdentity({ subject: `${users[0]}|host-session` });
  const guest = t.withIdentity({ subject: `${users[1]}|guest-session` });
  const stranger = t.withIdentity({ subject: `${users[2]}|third-session` });
  const args = {
    timed,
    inviteToken: crypto.randomUUID(),
    createKey: crypto.randomUUID(),
  };
  const roomId = await host.mutation(api.rooms.create, args);
  return { t, host, guest, stranger, roomId, args };
}
describe("Authenticated room adapter", () => {
  test("server schedules a shared expiry and refuses play after the window closes", async () => {
    vi.useFakeTimers();
    try {
      const { t, host, guest, stranger, roomId, args } = await setup(true);
      await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken });
      await expect(stranger.mutation(api.rooms.syncClock, { roomId })).rejects.toThrow("not available");
      expect(await host.mutation(api.rooms.syncClock, { roomId })).toBe(Date.now());
      for (const [actor, name] of [[host, "host"], [guest, "guest"]] as const)
        await actor.mutation(api.rooms.play, { roomId, operationId: `ready-${name}`, action: { type: "ready" } });
      const deadline = (await host.query(api.rooms.get, { roomId }))?.view?.clock?.deadline;
      expect(deadline).toBe(Date.now() + 480000);
      await vi.advanceTimersByTimeAsync(480001);
      await t.finishInProgressScheduledFunctions();
      expect((await guest.query(api.rooms.get, { roomId }))?.view?.clock?.expired).toBe(true);
      await host.mutation(api.rooms.play, { roomId, operationId: "late-share", action: { type: "contribute", challengeIndex: 0 } });
      expect((await host.query(api.rooms.get, { roomId }))?.view?.contributions).toEqual([]);
    } finally { vi.useRealTimers(); }
  });
  test("presence derives the role, rejects outsiders, and tracks explicit disconnect", async () => {
    const { host, guest, stranger, roomId, args } = await setup();
    await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken });
    const request = { roomId, userId: "operator", sessionId: "host-presence", interval: 1 };
    await expect(stranger.mutation(api.presence.heartbeat, request)).rejects.toThrow("not available");
    await expect(stranger.query(api.presence.list, { roomToken: roomId })).rejects.toThrow("not available");
    const tokens = await host.mutation(api.presence.heartbeat, request);
    const rows = await guest.query(api.presence.list, { roomToken: roomId });
    expect(rows).toMatchObject([{ userId: "archivist", online: true }]);
    await host.mutation(api.presence.disconnect, { sessionToken: tokens.sessionToken });
    expect(await guest.query(api.presence.list, { roomToken: roomId })).toMatchObject([{ userId: "archivist", online: false }]);
  });
  test("requires an authenticated guest to create", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.rooms.create, {
        inviteToken: crypto.randomUUID(),
        createKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Start a guest session first");
  });
  test("room creation and joining are idempotent; identities cannot occupy both seats", async () => {
    const { host, guest, roomId, args } = await setup();
    expect(await host.mutation(api.rooms.create, args)).toBe(roomId);
    await expect(
      host.mutation(api.rooms.join, { inviteToken: args.inviteToken }),
    ).rejects.toThrow("You are the archivist");
    expect(
      await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken }),
    ).toBe(roomId);
    expect(
      await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken }),
    ).toBe(roomId);
  });
  test("only members receive a view and the unshared partner clue never leaks", async () => {
    const { t, host, guest, stranger, roomId, args } = await setup();
    expect(await t.query(api.rooms.get, { roomId })).toBeNull();
    expect(await stranger.query(api.rooms.get, { roomId })).toBeNull();
    await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken });
    const hostView = await host.query(api.rooms.get, { roomId });
    const guestView = await guest.query(api.rooms.get, { roomId });
    expect(hostView?.view?.role).toBe("archivist");
    expect(guestView?.view?.role).toBe("operator");
    expect(guestView?.inviteToken).toBeNull();
    expect(JSON.stringify(hostView)).not.toContain(
      "whichever Voyager left Earth first",
    );
    expect(JSON.stringify(guestView)).not.toContain("1977-08-20");
    expect(guestView?.view?.sharedClues).toEqual([]);
    await expect(
      stranger.mutation(api.rooms.play, {
        roomId,
        operationId: "outsider",
        action: { type: "contribute" },
      }),
    ).rejects.toThrow("not available");
    await expect(
      stranger.mutation(api.rooms.join, { inviteToken: args.inviteToken }),
    ).rejects.toThrow("Both seats are taken");
  });
  test("an expired invitation cannot be claimed", async () => {
    const { t, guest, roomId, args } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(roomId, { expiresAt: Date.now() - 1000 }),
    );
    await expect(
      guest.mutation(api.rooms.join, { inviteToken: args.inviteToken }),
    ).rejects.toThrow("expired");
  });
  test("contributions unlock puzzle, valid answer stops at an unacknowledged request", async () => {
    const { t, host, guest, roomId, args } = await setup();
    await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken });
    // Legacy rooms retain their explicit email gate; no migration fabricates a reply.
    await t.run(async ctx => {
      const room = await ctx.db.get(roomId);
      await ctx.db.patch(roomId, { state: createCase({ archivist: room!.hostId, operator: room!.guestId! }) });
    });
    const solution = {
      type: "submit-solution" as const,
      mission: "Voyager 2",
      launchDate: "1977-08-20",
    };
    await expect(
      host.mutation(api.rooms.play, {
        roomId,
        operationId: "early",
        action: solution,
      }),
    ).rejects.toThrow("Both players");
    await host.mutation(api.rooms.play, {
      roomId,
      operationId: "share-host",
      action: { type: "contribute" },
    });
    await host.mutation(api.rooms.play, {
      roomId,
      operationId: "share-host",
      action: { type: "contribute" },
    });
    await guest.mutation(api.rooms.play, {
      roomId,
      operationId: "share-guest",
      action: { type: "contribute" },
    });
    expect(
      (await guest.query(api.rooms.get, { roomId }))?.view?.sharedClues,
    ).toHaveLength(2);
    await guest.mutation(api.rooms.play, {
      roomId,
      operationId: "answer",
      action: solution,
    });
    const view = (await host.query(api.rooms.get, { roomId }))?.view;
    expect(view?.phase).toBe("awaiting-reply");
    expect(view?.ending).toBeNull();
    expect(view?.revision).toBe(3);
    await expect(
      host.mutation(api.rooms.play, {
        roomId,
        operationId: "premature",
        action: { type: "vote-ending", choice: "broadcast" },
      }),
    ).rejects.toThrow("still locked");
  });
  test("new cloud-room adapter progresses all three challenges and persists a consensus ending", async () => {
    const { host, guest, roomId, args } = await setup();
    await guest.mutation(api.rooms.join, { inviteToken: args.inviteToken });
    for (let index = 0; index < 3; index++) {
      for (const [actor, name] of [[host, "host"], [guest, "guest"]] as const)
        await actor.mutation(api.rooms.play, { roomId, operationId: `share-${index}-${name}`, action: { type: "contribute", challengeIndex: index } });
      await host.mutation(api.rooms.play, { roomId, operationId: `solve-${index}`, action: index === 0
        ? { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20", challengeIndex: index }
        : { type: "submit-challenge", answer: challengeFor(roomId, index).answer, challengeIndex: index } });
    }
    expect((await guest.query(api.rooms.get, { roomId }))?.view?.phase).toBe("decision");
    for (const [actor, name] of [[host, "host"], [guest, "guest"]] as const)
      await actor.mutation(api.rooms.play, { roomId, operationId: `vote-${name}`, action: { type: "vote-ending", choice: "broadcast" } });
    expect((await host.query(api.rooms.get, { roomId }))?.view?.ending).toBe("broadcast");
  });
  test("invalid tokens are rejected and daily host room count is bounded", async () => {
    const { host, guest } = await setup();
    await expect(
      guest.mutation(api.rooms.join, { inviteToken: "bad" }),
    ).rejects.toThrow("not valid");
    for (let n = 0; n < 4; n++)
      await host.mutation(api.rooms.create, {
        inviteToken: crypto.randomUUID(),
        createKey: crypto.randomUUID(),
      });
    await expect(
      host.mutation(api.rooms.create, {
        inviteToken: crypto.randomUUID(),
        createKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow("five rooms");
  });
});
