import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export function normalizePlayerId(value: unknown) {
  if (typeof value !== "string" || value.length > 32) throw new ConvexError("Enter your full OS- player ID.");
  const id = value.trim().toUpperCase();
  if (!/^OS-[A-Z2-9]{10}$/.test(id)) throw new ConvexError("Enter your full OS- player ID.");
  return id;
}
export function validateNewPassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new ConvexError("Use a password between 12 and 128 characters.");
}
export async function currentPlayerAccount(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!userId || !sessionId) return null;
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId || session.expirationTime <= Date.now()) return null;
  const player = await ctx.db.query("players").withIndex("by_ownerId", q => q.eq("ownerId", userId)).unique();
  if (!player) return null;
  const account = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", userId).eq("provider", "player-password")).unique();
  return { userId, sessionId, playerId: player.playerId, saved: account !== null };
}

// This callback changes credentials, not ownership. No room, friend or player is copied.
export async function linkAccountUser(ctx: MutationCtx, args: {
  existingUserId: Id<"users"> | null;
  provider: { id: string };
  profile: { email?: string };
}) {
  if (args.existingUserId) return args.existingUserId;
  if (args.provider.id === "anonymous") return await ctx.db.insert("users", { isAnonymous: true });
  if (args.provider.id !== "player-password") throw new ConvexError("This sign-in method isn’t supported.");
  const owner = await currentPlayerAccount(ctx);
  if (!owner || owner.playerId !== args.profile.email || owner.saved)
    throw new ConvexError("Save the player signed in to this browser. You cannot claim someone else’s ID.");
  await ctx.db.patch(owner.userId, { isAnonymous: false });
  return owner.userId;
}
