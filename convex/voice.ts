import { ConvexError, v } from "convex/values";
import { action, mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { liveUserId } from "./liveIdentity";
import { role as roleValidator } from "./validators";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
const limits = new RateLimiter(components.rateLimiter, { joins: { kind: "fixed window", rate: 8, period: MINUTE } });

const LEASE = 60_000;
const MAX_CALL = 30 * 60_000;
async function membership(ctx: QueryCtx, roomId: Id<"rooms">) {
  const user = await liveUserId(ctx);
  const room = await ctx.db.get(roomId);
  if (!user || !room?.state || (room.hostId !== user && room.guestId !== user))
    throw new ConvexError("Voice is only available to players in this room.");
  return user === room.hostId ? "archivist" as const : "operator" as const;
}
const other = (role: "archivist" | "operator") => role === "archivist" ? "operator" : "archivist";
const active = (peer: { seenAt: number; joinedAt: number } | null | undefined) => Boolean(peer && peer.seenAt > Date.now() - LEASE && peer.joinedAt > Date.now() - MAX_CALL);
const roomRow = (ctx: QueryCtx, roomId: Id<"rooms">) => ctx.db.query("voiceRooms").withIndex("by_roomId", q => q.eq("roomId", roomId)).unique();
function token(clientId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) throw new ConvexError("Invalid call session.");
}
export const get = query({
  args: { roomId: v.id("rooms") },
  returns: v.object({ role: roleValidator, ownId: v.union(v.null(), v.string()), peerId: v.union(v.null(), v.string()), peerMuted: v.boolean(), description: v.union(v.null(), v.object({ targetId: v.string(), sdp: v.string() })) }),
  handler: async (ctx, { roomId }) => {
    const role = await membership(ctx, roomId);
    const row = await roomRow(ctx, roomId);
    const own = active(row?.[role]) ? row![role] : null;
    const peer = active(row?.[other(role)]) ? row![other(role)] : null;
    return { role, ownId: own?.clientId ?? null, peerId: peer?.clientId ?? null, peerMuted: peer?.muted ?? false,
      description: own && peer?.description?.targetId === own.clientId ? peer.description : null };
  },
});
export const join = mutation({
  args: { roomId: v.id("rooms"), clientId: v.string() }, returns: v.null(),
  handler: async (ctx, { roomId, clientId }) => {
    token(clientId);
    const role = await membership(ctx, roomId);
    let row = await roomRow(ctx, roomId);
    if (active(row?.[role])) {
      if (row![role]!.clientId === clientId) return null;
      throw new ConvexError("Your voice seat is open in another tab. Leave there or wait one minute.");
    }
    if (!(await limits.limit(ctx, "joins", { key: `${roomId}:${role}` })).ok) throw new ConvexError("Too many call starts. Wait a minute before joining again.");
    if (!row) {
      const id = await ctx.db.insert("voiceRooms", { roomId, archivist: null, operator: null });
      row = (await ctx.db.get(id))!;
    }
    await ctx.db.patch(row._id, { [role]: { clientId, seenAt: Date.now(), joinedAt: Date.now(), muted: false } });
    await ctx.scheduler.runAfter(LEASE, internal.voice.expire, { id: row._id, role, clientId });
    return null;
  },
});
export const heartbeat = mutation({
  args: { roomId: v.id("rooms"), clientId: v.string(), muted: v.boolean() }, returns: v.null(),
  handler: async (ctx, { roomId, clientId, muted }) => {
    const role = await membership(ctx, roomId);
    const row = await roomRow(ctx, roomId);
    const own = row?.[role];
    if (!row || !active(own) || own!.clientId !== clientId) throw new ConvexError("Call session expired. Rejoin voice.");
    await ctx.db.patch(row._id, { [role]: { ...own!, seenAt: Date.now(), muted } });
    return null;
  },
});
export const describe = mutation({
  args: { roomId: v.id("rooms"), clientId: v.string(), targetId: v.string(), sdp: v.string() }, returns: v.null(),
  handler: async (ctx, { roomId, clientId, targetId, sdp }) => {
    const role = await membership(ctx, roomId);
    const row = await roomRow(ctx, roomId);
    const own = row?.[role], peer = row?.[other(role)];
    if (!row || !active(own) || own!.clientId !== clientId || !active(peer) || peer!.clientId !== targetId)
      throw new ConvexError("The other call session changed. Reconnect voice.");
    if (!sdp.startsWith("v=0") || sdp.length > 32_000 || !sdp.includes("m=audio") || sdp.includes("m=video") || sdp.includes("m=application"))
      throw new ConvexError("Only a bounded audio connection is allowed.");
    if (own!.description?.targetId === targetId) {
      if (own!.description.sdp === sdp) return null;
      throw new ConvexError("Reconnect to renegotiate voice.");
    }
    await ctx.db.patch(row._id, { [role]: { ...own!, description: { targetId, sdp } } });
    return null;
  },
});
export const leave = mutation({
  args: { roomId: v.id("rooms"), clientId: v.string() }, returns: v.null(),
  handler: async (ctx, { roomId, clientId }) => {
    const role = await membership(ctx, roomId);
    const row = await roomRow(ctx, roomId);
    if (row?.[role]?.clientId === clientId) await ctx.db.patch(row._id, { [role]: null });
    return null;
  },
});
export const expire = internalMutation({
  args: { id: v.id("voiceRooms"), role: roleValidator, clientId: v.string() }, returns: v.null(),
  handler: async (ctx, { id, role, clientId }) => {
    const row = await ctx.db.get(id), peer = row?.[role];
    if (!row || peer?.clientId !== clientId) return null;
    if (active(peer)) {
      await ctx.scheduler.runAfter(Math.max(1, Math.min(peer.seenAt + LEASE, peer.joinedAt + MAX_CALL) - Date.now()), internal.voice.expire, { id, role, clientId });
    } else {
      await ctx.db.patch(id, { [role]: null });
    }
    return null;
  },
});

// Only joined room members may mint short-lived relay credentials.
export const authorizeRelay = internalMutation({
  args: { roomId: v.id("rooms"), clientId: v.string() }, returns: v.null(),
  handler: async (ctx, { roomId, clientId }) => {
    const role = await membership(ctx, roomId);
    const row = await roomRow(ctx, roomId);
    if (!active(row?.[role]) || row?.[role]?.clientId !== clientId)
      throw new ConvexError("Join room voice before connecting audio.");
    if (!(await limits.limit(ctx, "joins", { key: `relay:${roomId}:${role}` })).ok)
      throw new ConvexError("Too many audio retries. Wait a minute.");
    return null;
  },
});
export const connectionConfig = action({
  args: { roomId: v.id("rooms"), clientId: v.string() },
  returns: v.object({ relay: v.boolean(), iceServers: v.array(v.object({ urls: v.array(v.string()), username: v.optional(v.string()), credential: v.optional(v.string()) })) }),
  handler: async (ctx, args): Promise<{ relay: boolean; iceServers: { urls: string[]; username?: string; credential?: string }[] }> => {
    await ctx.runMutation(internal.voice.authorizeRelay, args);
    const key = process.env.TURN_KEY_ID, token = process.env.TURN_KEY_API_TOKEN;
    if (!key || !token) return { relay: false, iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }] };
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 3600 }), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("relay unavailable");
      const body = await response.json();
      if (!Array.isArray(body.iceServers)) throw new Error("invalid response");
      const iceServers = body.iceServers.map((server: { urls: string | string[]; username?: string; credential?: string }) => ({
        urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((url: string) => typeof url === "string" && /^(stun|turn|turns):/.test(url) && !/:53(?:\?|$)/.test(url)),
        ...(server.username ? { username: server.username } : {}), ...(server.credential ? { credential: server.credential } : {}),
      })).filter((server: { urls: string[] }) => server.urls.length);
      if (!iceServers.some((server: { urls: string[]; credential?: string }) => server.credential && server.urls.some(url => /^turns?:/.test(url)))) throw new Error("no relay");
      return { relay: true, iceServers };
    } catch { throw new ConvexError("The voice relay is unavailable. Retry in a moment or use team chat."); }
  },
});
