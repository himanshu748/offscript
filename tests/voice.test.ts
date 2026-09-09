import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "../convex/schema";
const modules = import.meta.glob("../convex/**/*.ts");
const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(ctx => Promise.all([0, 1, 2].map(() => ctx.db.insert("users", { isAnonymous: true }))));
  const [host, guest, outsider] = ids.map(id => t.withIdentity({ subject: `${id}|session` }));
  const inviteToken = crypto.randomUUID();
  const roomId = await host.mutation(api.rooms.create, { inviteToken, createKey: crypto.randomUUID() });
  await guest.mutation(api.rooms.join, { inviteToken });
  return { t, host, guest, outsider, roomId, a: crypto.randomUUID(), b: crypto.randomUUID() };
}
test("voice requires authenticated room membership, derives role, and needs both opt-ins", async () => {
  const { t, host, guest, outsider, roomId, a, b } = await setup();
  await expect(t.query(api.voice.get, { roomId })).rejects.toThrow("players in this room");
  await expect(outsider.mutation(api.voice.join, { roomId, clientId: a })).rejects.toThrow("players in this room");
  await host.mutation(api.voice.join, { roomId, clientId: a });
  expect(await guest.query(api.voice.get, { roomId })).toMatchObject({ role: "operator", ownId: null, peerId: a, description: null });
  await expect(host.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp })).rejects.toThrow("session changed");
  await guest.mutation(api.voice.join, { roomId, clientId: b });
  await host.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp });
  expect((await guest.query(api.voice.get, { roomId })).description?.sdp).toBe(sdp);
  expect((await host.query(api.voice.get, { roomId })).description).toBeNull();
});
test("voice rejects stale sessions, tab takeover, changed descriptions and non-audio data", async () => {
  const { host, guest, roomId, a, b } = await setup();
  await host.mutation(api.voice.join, { roomId, clientId: a });
  await host.mutation(api.voice.join, { roomId, clientId: a });
  await expect(host.mutation(api.voice.join, { roomId, clientId: crypto.randomUUID() })).rejects.toThrow("another tab");
  await guest.mutation(api.voice.join, { roomId, clientId: b });
  await expect(guest.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp })).rejects.toThrow("session changed");
  for (const invalid of [sdp + "m=video", sdp + "m=application", "invalid", sdp + "x".repeat(32_000)])
    await expect(host.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp: invalid })).rejects.toThrow("bounded audio");
  await host.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp });
  await host.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp });
  await expect(host.mutation(api.voice.describe, { roomId, clientId: a, targetId: b, sdp: sdp + "x" })).rejects.toThrow("renegotiate");
});
test("leaving clears metadata and a stale leave cannot disconnect a new session", async () => {
  const { host, guest, roomId, a, b } = await setup();
  await host.mutation(api.voice.join, { roomId, clientId: a });
  await guest.mutation(api.voice.join, { roomId, clientId: b });
  await host.mutation(api.voice.heartbeat, { roomId, clientId: a, muted: true });
  expect((await guest.query(api.voice.get, { roomId })).peerMuted).toBe(true);
  await host.mutation(api.voice.leave, { roomId, clientId: a });
  const fresh = crypto.randomUUID();
  await host.mutation(api.voice.join, { roomId, clientId: fresh });
  await host.mutation(api.voice.leave, { roomId, clientId: a });
  expect((await guest.query(api.voice.get, { roomId })).peerId).toBe(fresh);
});
test("expiry clears signaling and rejects late heartbeat without changing game state", async () => {
  vi.useFakeTimers();
  try {
    const { t, host, roomId, a } = await setup();
    const before = await t.run(ctx => ctx.db.get(roomId));
    await host.mutation(api.voice.join, { roomId, clientId: a });
    await vi.advanceTimersByTimeAsync(60_001);
    await t.finishInProgressScheduledFunctions();
    expect((await host.query(api.voice.get, { roomId })).ownId).toBeNull();
    await expect(host.mutation(api.voice.heartbeat, { roomId, clientId: a, muted: false })).rejects.toThrow("expired");
    expect((await t.run(ctx => ctx.db.get(roomId)))?.state).toEqual(before?.state);
  } finally { vi.useRealTimers(); }
});
