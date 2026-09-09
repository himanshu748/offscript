import { ConvexError, v } from "convex/values";
import { RateLimiter, HOUR, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { currentPlayerAccount, normalizePlayerId } from "./accountLinking";

const limits = new RateLimiter(components.rateLimiter, {
  recoveryAccount: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  recoveryRecipient: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  recoveryGlobal: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  recoveryAttempt: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
});
const purpose = v.union(v.literal("verify"), v.literal("reset"));
export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") throw new ConvexError("Enter your recovery email.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new ConvexError("Enter a valid recovery email.");
  return email;
}

// No public query can read addresses, hashes, or whether another ID has recovery.
export const status = query({
  args: {}, returns: v.object({ available: v.boolean(), verified: v.boolean(), pending: v.boolean(), emailHint: v.union(v.string(), v.null()) }),
  handler: async ctx => {
    const owner = await currentPlayerAccount(ctx);
    const row = owner ? await ctx.db.query("recovery").withIndex("by_userId", q => q.eq("userId", owner.userId)).unique() : null;
    const email = row?.email;
    return { available: Boolean(process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_INBOX_ID),
      verified: Boolean(email), pending: Boolean(row?.verifyHash && row.verifyExpires! > Date.now()),
      emailHint: email ? `${email[0]}•••@${email.split("@")[1]}` : null };
  },
});

// Called before expensive password checks. A false result commits the limiter.
export const attempt = internalMutation({
  args: { playerId: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => (await limits.limit(ctx, "recoveryAttempt", { key: normalizePlayerId(args.playerId) })).ok,
});

export const issue = internalMutation({
  args: { playerId: v.string(), email: v.string(), hash: v.string(), purpose },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const playerId = normalizePlayerId(args.playerId);
    const email = normalizeEmail(args.email);
    if (!/^[a-f0-9]{64}$/.test(args.hash)) throw new Error("Invalid token digest");
    if (!(await limits.limit(ctx, "recoveryGlobal")).ok) return null;
    if (!(await limits.limit(ctx, "recoveryAccount", { key: playerId })).ok) return null;
    if (!(await limits.limit(ctx, "recoveryRecipient", { key: email })).ok) return null;
    const player = await ctx.db.query("players").withIndex("by_playerId", q => q.eq("playerId", playerId)).unique();
    if (!player) return null;
    const account = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", player.ownerId).eq("provider", "player-password")).unique();
    if (!account) return null;
    const row = await ctx.db.query("recovery").withIndex("by_userId", q => q.eq("userId", player.ownerId)).unique();
    if (args.purpose === "verify") {
      const owner = await currentPlayerAccount(ctx);
      if (!owner || owner.userId !== player.ownerId) throw new ConvexError("Sign in to your saved player first.");
      const patch = { pendingEmail: email, verifyHash: args.hash, verifyExpires: Date.now() + 15 * MINUTE };
      if (row) await ctx.db.patch(row._id, patch);
      else await ctx.db.insert("recovery", { userId: player.ownerId, ...patch });
    } else {
      if (!row || row.email !== email) return null;
      await ctx.db.patch(row._id, { resetHash: args.hash, resetExpires: Date.now() + 15 * MINUTE });
    }
    return email;
  },
});

export const consume = internalMutation({
  args: { playerId: v.string(), hash: v.string(), purpose },
  returns: v.union(v.null(), v.id("users")),
  handler: async (ctx, args) => {
    const player = await ctx.db.query("players").withIndex("by_playerId", q => q.eq("playerId", normalizePlayerId(args.playerId))).unique();
    if (!player) return null;
    const row = await ctx.db.query("recovery").withIndex("by_userId", q => q.eq("userId", player.ownerId)).unique();
    if (!row) return null;
    if (args.purpose === "verify") {
      const owner = await currentPlayerAccount(ctx);
      if (!owner || owner.userId !== row.userId || row.verifyHash !== args.hash || !row.pendingEmail || (row.verifyExpires ?? 0) <= Date.now()) return null;
      await ctx.db.patch(row._id, { email: row.pendingEmail, pendingEmail: undefined, verifyHash: undefined, verifyExpires: undefined, resetHash: undefined, resetExpires: undefined });
    } else {
      if (!row.email || row.resetHash !== args.hash || (row.resetExpires ?? 0) <= Date.now()) return null;
      // Claim exactly once, atomically. Also cancel any pending email change.
      await ctx.db.patch(row._id, { resetHash: undefined, resetExpires: undefined, pendingEmail: undefined, verifyHash: undefined, verifyExpires: undefined, recoveredAt: Date.now() });
    }
    return row.userId;
  },
});
