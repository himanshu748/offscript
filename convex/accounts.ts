import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { currentPlayerAccount } from "./accountLinking";
import { liveUserId as getAuthUserId } from "./liveIdentity";

export const owner = internalQuery({
  args: {}, returns: v.union(v.null(), v.object({ userId: v.id("users"), sessionId: v.id("authSessions"), playerId: v.string(), saved: v.boolean() })),
  handler: currentPlayerAccount,
});
export const status = query({
  args: {}, returns: v.union(v.null(), v.object({ playerId: v.string(), saved: v.boolean() })),
  handler: async ctx => {
    // Enrollment checks the live session separately. Display status is attached
    // to the authenticated user, so credential rotation cannot flash a saved
    // player back into guest mode while the client swaps its token.
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db.query("players").withIndex("by_ownerId", q => q.eq("ownerId", userId)).unique();
    if (!profile) return null;
    const account = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", userId).eq("provider", "player-password")).unique();
    return { playerId: profile.playerId, saved: account !== null };
  },
});
