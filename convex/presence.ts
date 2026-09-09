import { Presence } from "@convex-dev/presence";
import { liveUserId as getAuthUserId } from "./liveIdentity";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query, type QueryCtx } from "./_generated/server";

const presence = new Presence(components.presence);
async function member(ctx: QueryCtx, rawRoomId: string) {
  const userId = await getAuthUserId(ctx);
  const roomId = ctx.db.normalizeId("rooms", rawRoomId);
  const room = roomId && await ctx.db.get(roomId);
  if (!userId || !room || (room.hostId !== userId && room.guestId !== userId))
    throw new ConvexError("This case is not available to your session.");
  return { roomId: room._id, role: room.hostId === userId ? "archivist" : "operator" };
}
export const heartbeat = mutation({
  args: { roomId: v.string(), userId: v.string(), sessionId: v.string(), interval: v.number() },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, args) => {
    const identity = await member(ctx, args.roomId);
    if (args.sessionId.length > 256 || args.sessionId.length < 1)
      throw new ConvexError("Invalid presence session.");
    // Ignore the client identity and heartbeat interval. Only the member's own role can be marked online.
    const result = await presence.heartbeat(ctx, identity.roomId, identity.role, args.sessionId, 10000);
    return { roomToken: identity.roomId, sessionToken: result.sessionToken };
  },
});
export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(v.object({ userId: v.string(), online: v.boolean(), lastDisconnected: v.number() })),
  handler: async (ctx, { roomToken }) => {
    const { roomId } = await member(ctx, roomToken);
    return await presence.listRoom(ctx, roomId, false, 2);
  },
});
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    // Unload beacons cannot carry auth. The opaque token grants only disconnect of its own session.
    if (sessionToken.length > 256) throw new ConvexError("Invalid presence token.");
    return await presence.disconnect(ctx, sessionToken);
  },
});
