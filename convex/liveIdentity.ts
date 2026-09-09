import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "./_generated/server";

// Password recovery revokes application access immediately, even while an old
// signed JWT has time left. Accounts without a recovery retain existing behavior.
export async function liveUserId(ctx: QueryCtx) {
  const id = await getAuthUserId(ctx);
  if (!id) return null;
  const recovery = await ctx.db.query("recovery").withIndex("by_userId", q => q.eq("userId", id)).unique();
  if (recovery?.recoveredAt !== undefined) {
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== id || session.expirationTime <= Date.now() || session._creationTime <= recovery.recoveredAt) return null;
  }
  return id;
}
