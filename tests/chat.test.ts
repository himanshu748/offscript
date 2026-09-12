import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const users = await t.run(ctx => Promise.all([0, 1, 2].map(() => ctx.db.insert("users", { isAnonymous: true }))));
  const [host, guest, outsider] = users.map(user => t.withIdentity({ subject: `${user}|session` }));
  const inviteToken = crypto.randomUUID();
  const roomId = await host.mutation(api.rooms.create, { inviteToken, createKey: crypto.randomUUID() });
  await guest.mutation(api.rooms.join, { inviteToken });
  return { t, users, host, guest, outsider, roomId };
}

test("team messages persist for both members, derive the sender's seat, and expose no auth IDs", async () => {
  const { host, guest, roomId } = await setup();
  await host.mutation(api.rooms.sendMessage, { roomId, clientId: "host-1", text: "  Compare the earliest departure.  " });
  await guest.mutation(api.rooms.sendMessage, { roomId, clientId: "guest-1", text: "I can check the routing instruction." });
  const messages = await guest.query(api.rooms.messages, { roomId });
  expect(messages).toMatchObject([
    { role: "archivist", text: "Compare the earliest departure." },
    { role: "operator", text: "I can check the routing instruction." },
  ]);
  expect(messages).toEqual(await host.query(api.rooms.messages, { roomId }));
  expect(Object.keys(messages[0]).sort()).toEqual(["id", "role", "sentAt", "text"]);
});

test("only joined members can read or write a room conversation", async () => {
  const { t, host, outsider, roomId } = await setup();
  for (const actor of [t, outsider]) {
    await expect(actor.query(api.rooms.messages, { roomId })).rejects.toThrow("not available");
    await expect(actor.mutation(api.rooms.sendMessage, { roomId, clientId: "no", text: "Hello" })).rejects.toThrow("not available");
  }
  const waiting = await host.mutation(api.rooms.create, { inviteToken: crypto.randomUUID(), createKey: crypto.randomUUID() });
  await expect(host.mutation(api.rooms.sendMessage, { roomId: waiting, clientId: "waiting", text: "Hello" })).rejects.toThrow("not available");
});

test("retrying a confirmed message is idempotent, while both seats can use the same client key", async () => {
  const { host, guest, roomId } = await setup();
  const args = { roomId, clientId: "same-key", text: "My suggestion" };
  const first = await host.mutation(api.rooms.sendMessage, args);
  expect(await host.mutation(api.rooms.sendMessage, args)).toBe(first);
  expect(await guest.mutation(api.rooms.sendMessage, args)).not.toBe(first);
  expect(await host.query(api.rooms.messages, { roomId })).toHaveLength(2);
});

test("messages are length bounded and a burst pauses only its sender", async () => {
  const { host, guest, roomId } = await setup();
  for (const text of ["  ", "x".repeat(501)])
    await expect(host.mutation(api.rooms.sendMessage, { roomId, clientId: "invalid", text })).rejects.toThrow("1–500");
  for (let i = 0; i < 6; i++) await host.mutation(api.rooms.sendMessage, { roomId, clientId: `burst-${i}`, text: "A note" });
  await expect(host.mutation(api.rooms.sendMessage, { roomId, clientId: "excess", text: "One too many" })).rejects.toThrow("Give your partner a moment");
  await expect(guest.mutation(api.rooms.sendMessage, { roomId, clientId: "guest", text: "I can still reply" })).resolves.toBeTruthy();
});

test("history keeps only the latest 100 messages without changing puzzle progress", async () => {
  vi.useFakeTimers();
  try {
    const { t, users, host, roomId } = await setup();
    const before = await host.query(api.rooms.get, { roomId });
    await t.run(async ctx => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("teamMessages", { roomId, userId: users[0], role: "archivist", clientId: `seed-${i}`, text: `Note ${i}` });
    });
    vi.advanceTimersByTime(1000);
    await host.mutation(api.rooms.sendMessage, { roomId, clientId: "latest", text: "The latest note" });
    const messages = await host.query(api.rooms.messages, { roomId });
    expect(messages).toHaveLength(100);
    expect(messages[0].text).toBe("Note 1");
    expect(messages.at(-1)?.text).toBe("The latest note");
    expect(await host.query(api.rooms.get, { roomId })).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("teamMessages").collect())).toHaveLength(100);
  } finally { vi.useRealTimers(); }
});
