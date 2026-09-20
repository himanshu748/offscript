import { liveUserId as getAuthUserId } from "./liveIdentity";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { Id } from "./_generated/dataModel";
import { createCase, applyPlayerAction, viewFor, expireCase } from "../server/engine.mjs";
import { playerAction, playerView } from "./validators";
import { pairKey, profileFor, publicPlayer } from "./players";

const chatLimits = new RateLimiter(components.rateLimiter, {
  teamMessage: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 6 },
});

async function chatMember(ctx: QueryCtx, roomId: Id<"rooms">) {
  const userId = await getAuthUserId(ctx);
  const room = await ctx.db.get(roomId);
  if (!userId || !room?.state || (room.hostId !== userId && room.guestId !== userId))
    throw new ConvexError("This conversation is not available to your session.");
  return { userId, role: room.hostId === userId ? "archivist" as const : "operator" as const };
}

export const messages = query({
  args: { roomId: v.id("rooms") },
  returns: v.array(v.object({
    id: v.id("teamMessages"), text: v.string(), sentAt: v.number(),
    role: v.union(v.literal("archivist"), v.literal("operator")),
  })),
  handler: async (ctx, { roomId }) => {
    await chatMember(ctx, roomId);
    const rows = await ctx.db.query("teamMessages").withIndex("by_roomId", q => q.eq("roomId", roomId)).order("desc").take(100);
    return rows.reverse().map(row => ({ id: row._id, text: row.text, sentAt: row._creationTime, role: row.role }));
  },
});

export const sendMessage = mutation({
  args: { roomId: v.id("rooms"), clientId: v.string(), text: v.string() },
  returns: v.id("teamMessages"),
  handler: async (ctx, { roomId, clientId, text: rawText }) => {
    const { userId, role } = await chatMember(ctx, roomId);
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(clientId)) throw new ConvexError("Please retry this message.");
    const text = rawText.trim();
    if (!text || text.length > 500) throw new ConvexError("Write a message using 1–500 characters.");
    const existing = await ctx.db.query("teamMessages")
      .withIndex("by_roomId_and_userId_and_clientId", q => q.eq("roomId", roomId).eq("userId", userId).eq("clientId", clientId)).unique();
    if (existing) return existing._id;
    const limit = await chatLimits.limit(ctx, "teamMessage", { key: `${roomId}:${userId}` });
    if (!limit.ok) throw new ConvexError("Give your partner a moment. Try again in a few seconds.");
    const id = await ctx.db.insert("teamMessages", { roomId, userId, role, clientId, text });
    // Keep the conversation bounded without deleting anyone's case progress.
    const recent = await ctx.db.query("teamMessages").withIndex("by_roomId", q => q.eq("roomId", roomId)).order("desc").take(101);
    if (recent.length > 100) await ctx.db.delete(recent[100]._id);
    return id;
  },
});

function boundedToken(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ConvexError("This room link is not valid.");
}
export const create = mutation({
  args: { inviteToken: v.string(), createKey: v.string(), timed: v.optional(v.boolean()), friendPlayerId: v.optional(v.string()) },
  returns: v.id("rooms"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Start a guest session first.");
    boundedToken(args.inviteToken);
    boundedToken(args.createKey);
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_host_create", (q) =>
        q.eq("hostId", userId).eq("createKey", args.createKey),
      )
      .unique();
    if (existing) return existing._id;
    const recent = await ctx.db
      .query("rooms")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .order("desc")
      .take(5);
    if (recent.length === 5 && recent[4].createdAt > Date.now() - 86_400_000)
      throw new ConvexError(
        "You have opened five rooms today. Return to your existing room or try tomorrow.",
      );
    if (
      await ctx.db
        .query("rooms")
        .withIndex("by_invite", (q) => q.eq("inviteToken", args.inviteToken))
        .unique()
    )
      throw new ConvexError("Please create a fresh invitation.");
    let invitedGuestId: Id<"users"> | undefined;
    if (args.friendPlayerId) {
      const friend = await ctx.db.query("players").withIndex("by_playerId", q => q.eq("playerId", args.friendPlayerId!)).unique();
      if (!friend) throw new ConvexError("That friend is no longer available.");
      const pair = pairKey(userId, friend.ownerId);
      const friendship = await ctx.db.query("friendships").withIndex("by_pair", q => q.eq("pair", pair)).unique();
      if (friendship?.status !== "accepted") throw new ConvexError("Become friends before sending a room invitation.");
      invitedGuestId = friend.ownerId;
    }
    const { friendPlayerId: _friend, ...roomArgs } = args;
    return await ctx.db.insert("rooms", {
      hostId: userId,
      ...roomArgs,
      ...(invitedGuestId ? { invitedGuestId } : {}),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      state: null,
    });
  },
});
export const join = mutation({
  args: { inviteToken: v.string() },
  returns: v.id("rooms"),
  handler: async (ctx, { inviteToken }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Start a guest session first.");
    boundedToken(inviteToken);
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_invite", (q) => q.eq("inviteToken", inviteToken))
      .unique();
    if (!room)
      throw new ConvexError(
        "This invitation could not be found. Ask your partner for a fresh link.",
      );
    if (room.guestId === userId) return room._id;
    if (room.invitedGuestId) {
      if (room.invitedGuestId !== userId) throw new ConvexError("This seat is reserved for the invited friend.");
      const pair = pairKey(userId, room.hostId);
      const friendship = await ctx.db.query("friendships").withIndex("by_pair", q => q.eq("pair", pair)).unique();
      if (friendship?.status !== "accepted") throw new ConvexError("This friend invitation is no longer available.");
    }
    if (room.hostId === userId)
      throw new ConvexError(
        "You are the archivist. Send this link to a friend using another browser or device.",
      );
    if (room.guestId)
      throw new ConvexError(
        "Both seats are taken. Ask your partner to create another room.",
      );
    if (room.expiresAt < Date.now())
      throw new ConvexError(
        "This invitation has expired. Ask your partner to create another room.",
      );
    const generated = await ctx.db.query("casePacks").withIndex("by_published", q => q.eq("published", true)).order("desc").take(6);
    const checksum = [...String(room._id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    // Once a validated pack exists, new rooms use one of those immutable
    // snapshots. The authored baseline remains the provider-independent path
    // when the library is empty.
    const selected = generated.length ? generated[checksum % generated.length] : null;
    const openingPack = selected ? { packKey: selected.packKey, title: selected.title,
      provenance: "firecrawl-openai-validated" as const, prompt: selected.prompt, hint: selected.hint,
      clues: selected.clues, solution: selected.solution } : null;
    await ctx.db.patch(room._id, {
      guestId: userId,
      state: createCase({ archivist: room.hostId, operator: userId }, room._id, room.timed ?? false, openingPack),
    });
    return room._id;
  },
});
export const get = query({
  args: { roomId: v.id("rooms") },
  returns: v.union(
    v.null(),
    v.object({
      roomId: v.id("rooms"),
      inviteToken: v.union(v.null(), v.string()),
      expiresAt: v.number(),
      invitedPlayer: v.union(v.null(), publicPlayer),
      players: v.object({ archivist: v.union(v.null(), publicPlayer), operator: v.union(v.null(), publicPlayer) }),
      view: v.union(v.null(), playerView),
    }),
  ),
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const room = await ctx.db.get(roomId);
    if (!room || (room.hostId !== userId && room.guestId !== userId))
      return null;
    return {
      roomId,
      expiresAt: room.expiresAt,
      invitedPlayer: room.invitedGuestId ? await profileFor(ctx, room.invitedGuestId) : null,
      players: {
        archivist: await profileFor(ctx, room.hostId),
        operator: room.guestId ? await profileFor(ctx, room.guestId) : null,
      },
      inviteToken:
        room.hostId === userId && !room.guestId ? room.inviteToken : null,
      view: room.state ? viewFor(room.state, userId) : null,
    };
  },
});
export const invitations = query({
  args: {},
  returns: v.array(v.object({ roomId: v.id("rooms"), inviteToken: v.string(), host: publicPlayer, timed: v.boolean() })),
  handler: async ctx => {
    const id = await getAuthUserId(ctx);
    if (!id) return [];
    const rooms = await ctx.db.query("rooms").withIndex("by_invitedGuestId", q => q.eq("invitedGuestId", id)).order("desc").take(20);
    const result = [];
    for (const room of rooms) {
      if (room.guestId || room.expiresAt <= Date.now()) continue;
      const pair = pairKey(id, room.hostId);
      const friendship = await ctx.db.query("friendships").withIndex("by_pair", q => q.eq("pair", pair)).unique();
      const host = await profileFor(ctx, room.hostId);
      if (host && friendship?.status === "accepted") result.push({ roomId: room._id, inviteToken: room.inviteToken, host, timed: room.timed ?? false });
    }
    return result;
  },
});
export const mine = query({
  args: {},
  returns: v.array(v.object({ roomId: v.id("rooms"), role: v.union(v.literal("archivist"), v.literal("operator")), createdAt: v.number(), status: v.string() })),
  handler: async ctx => {
    const id = await getAuthUserId(ctx);
    if (!id) return [];
    const [hosted, joined] = await Promise.all([
      ctx.db.query("rooms").withIndex("by_host", q => q.eq("hostId", id)).order("desc").take(20),
      ctx.db.query("rooms").withIndex("by_guestId", q => q.eq("guestId", id)).order("desc").take(20),
    ]);
    return [...hosted, ...joined].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8).map(room => ({
      roomId: room._id,
      role: room.hostId === id ? "archivist" as const : "operator" as const,
      createdAt: room.createdAt,
      status: !room.state ? (room.expiresAt <= Date.now() ? "Invitation expired" : "Waiting for partner")
        : room.state.phase === "resolved" ? "Case resolved"
        : room.state.clock?.expired || (room.state.clock?.deadline && room.state.clock.deadline <= Date.now()) ? "Window closed"
        : "Case in progress",
    }));
  },
});
export const play = mutation({
  args: {
    roomId: v.id("rooms"),
    operationId: v.string(),
    action: playerAction,
  },
  returns: v.null(),
  handler: async (ctx, { roomId, operationId, action }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      throw new ConvexError("Your session ended. Reconnect before continuing.");
    const room = await ctx.db.get(roomId);
    if (!room?.state || (room.hostId !== userId && room.guestId !== userId))
      throw new ConvexError("This case is not available to your session.");
    try {
      const now = Date.now();
      const expired = expireCase(room.state, now);
      if (expired.clock?.expired) {
        await ctx.db.patch(roomId, { state: expired });
        return null;
      }
      const state = applyPlayerAction(room.state, userId, operationId, action, now);
      await ctx.db.patch(roomId, {
        state,
      });
      if (state.clock?.deadline && !room.state.clock?.deadline)
        await ctx.scheduler.runAt(state.clock.deadline, internal.rooms.closeSignal, { roomId, deadline: state.clock.deadline });
    } catch (error) {
      throw new ConvexError(
        error instanceof Error
          ? error.message
          : "The action could not be saved.",
      );
    }
    return null;
  },
});

export const closeSignal = internalMutation({
  args: { roomId: v.id("rooms"), deadline: v.number() },
  returns: v.null(),
  handler: async (ctx, { roomId, deadline }) => {
    const room = await ctx.db.get(roomId);
    if (room?.state?.clock?.deadline === deadline) {
      const state = expireCase(room.state, Date.now());
      if (state !== room.state) await ctx.db.patch(roomId, { state });
    }
    return null;
  },
});

// An uncached timestamp lets the display use monotonic elapsed time instead of the device clock.
export const syncClock = mutation({
  args: { roomId: v.id("rooms") },
  returns: v.number(),
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (!userId || !room || (room.hostId !== userId && room.guestId !== userId))
      throw new ConvexError("This case is not available to your session.");
    return Date.now();
  },
});
