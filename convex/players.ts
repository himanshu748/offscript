import { liveUserId as getAuthUserId } from "./liveIdentity";
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const publicPlayer = v.object({ playerId: v.string(), name: v.string() });
export const pairKey = (a: Id<"users">, b: Id<"users">) => [a, b].sort().join(":");
export async function profileFor(ctx: QueryCtx, ownerId: Id<"users">) {
  const profile = await ctx.db.query("players").withIndex("by_ownerId", q => q.eq("ownerId", ownerId)).unique();
  return profile ? { playerId: profile.playerId, name: profile.name } : null;
}
async function connections(ctx: QueryCtx, userId: Id<"users">) {
  const [sent, received] = await Promise.all([
    ctx.db.query("friendships").withIndex("by_requester", q => q.eq("requester", userId)).take(100),
    ctx.db.query("friendships").withIndex("by_recipient", q => q.eq("recipient", userId)).take(100),
  ]);
  return [...sent, ...received];
}
export const me = query({
  args: {}, returns: v.union(v.null(), publicPlayer),
  handler: async ctx => {
    const id = await getAuthUserId(ctx);
    return id ? await profileFor(ctx, id) : null;
  },
});
export const ensure = mutation({
  args: {}, returns: publicPlayer,
  handler: async ctx => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new ConvexError("Start a guest session first.");
    const existing = await profileFor(ctx, ownerId);
    if (existing) return existing;
    // Public handles are identifiers, never bearer tokens or login credentials.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      const playerId = `OS-${code}`;
      if (await ctx.db.query("players").withIndex("by_playerId", q => q.eq("playerId", playerId)).unique()) continue;
      const name = `Listener ${code.slice(-4)}`;
      await ctx.db.insert("players", { ownerId, playerId, name });
      return { playerId, name };
    }
    throw new ConvexError("We couldn’t create your player ID. Try again.");
  },
});
export const rename = mutation({
  args: { name: v.string() }, returns: v.null(),
  handler: async (ctx, { name }) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new ConvexError("Start a guest session first.");
    const cleaned = name.trim().normalize("NFC");
    if (cleaned.length < 2 || cleaned.length > 24 || !/^[\p{L}\p{M}\p{N} ._'’-]+$/u.test(cleaned))
      throw new ConvexError("Use 2–24 letters, numbers, spaces or simple punctuation.");
    const player = await ctx.db.query("players").withIndex("by_ownerId", q => q.eq("ownerId", ownerId)).unique();
    if (!player) throw new ConvexError("Create your player ID first.");
    await ctx.db.patch(player._id, { name: cleaned });
    return null;
  },
});
export const list = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("friendships"), player: publicPlayer,
    status: v.union(v.literal("pending"), v.literal("accepted")), incoming: v.boolean(),
  })),
  handler: async ctx => {
    const id = await getAuthUserId(ctx);
    if (!id) return [];
    const rows = await connections(ctx, id);
    const result = await Promise.all(rows.map(async row => ({
      id: row._id, status: row.status, incoming: row.recipient === id,
      player: await profileFor(ctx, row.requester === id ? row.recipient : row.requester),
    })));
    return result.flatMap(row => row.player ? [{ ...row, player: row.player }] : []);
  },
});
export const request = mutation({
  args: { playerId: v.string() }, returns: v.null(),
  handler: async (ctx, { playerId }) => {
    const id = await getAuthUserId(ctx);
    if (!id || !(await profileFor(ctx, id))) throw new ConvexError("Create your player ID first.");
    const normalized = playerId.trim().toUpperCase();
    if (!/^OS-[A-Z2-9]{10}$/.test(normalized)) throw new ConvexError("Enter the full player ID, starting with OS-.");
    const target = await ctx.db.query("players").withIndex("by_playerId", q => q.eq("playerId", normalized)).unique();
    if (!target) throw new ConvexError("That player ID wasn’t found. Check it with your friend.");
    if (target.ownerId === id) throw new ConvexError("That’s your own player ID.");
    const pair = pairKey(id, target.ownerId);
    const existing = await ctx.db.query("friendships").withIndex("by_pair", q => q.eq("pair", pair)).unique();
    if (existing) return null; // Crossed requests never silently accept a friendship.
    const [mine, theirs] = await Promise.all([connections(ctx, id), connections(ctx, target.ownerId)]);
    if (mine.length >= 50 || theirs.length >= 50) throw new ConvexError("The friend list is full. Clear an old request before adding someone.");
    await ctx.db.insert("friendships", { requester: id, recipient: target.ownerId, pair, status: "pending" });
    return null;
  },
});
export const respond = mutation({
  args: { id: v.id("friendships"), action: v.union(v.literal("accept"), v.literal("remove")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const row = await ctx.db.get(args.id);
    if (!userId || !row || (row.requester !== userId && row.recipient !== userId))
      throw new ConvexError("That request isn’t available to you.");
    if (args.action === "accept") {
      if (row.recipient !== userId) throw new ConvexError("Only the recipient can accept a request.");
      await ctx.db.patch(row._id, { status: "accepted" });
    } else await ctx.db.delete(row._id);
    return null;
  },
});
