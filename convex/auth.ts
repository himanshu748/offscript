import { convexAuth, createAccount, retrieveAccount, modifyAccountCredentials, invalidateSessions } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { Scrypt } from "lucia";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { linkAccountUser, normalizePlayerId, validateNewPassword } from "./accountLinking";
import { normalizeEmail } from "./recovery";
import { requireRecoveryMail, sendRecoveryMail, tokenHash } from "./recoveryMail";

const playerPassword = ConvexCredentials<DataModel>({
  id: "player-password",
  crypto: {
    hashSecret: secret => new Scrypt().hash(secret),
    verifySecret: (secret, hash) => new Scrypt().verify(hash, secret),
  },
  authorize: async (params, ctx) => {
    let existingSession: Id<"authSessions"> | undefined;
    const playerId = normalizePlayerId(params.playerId);
    if (["recovery-email", "recovery-email-verify", "reset", "reset-verification"].includes(String(params.flow))) {
      const permitted = await ctx.runMutation(internal.recovery.attempt, { playerId });
      if (!permitted) throw new ConvexError("Too many attempts. Wait a minute before trying again.");
      if (params.flow === "recovery-email-verify") {
        const verified = await ctx.runMutation(internal.recovery.consume, { playerId, hash: await tokenHash(params.code), purpose: "verify" });
        if (!verified) throw new ConvexError("That code is invalid or expired. Request a new verification email.");
        return null;
      }
      if (params.flow === "reset-verification") {
        validateNewPassword(params.newPassword);
        const userId = await ctx.runMutation(internal.recovery.consume, { playerId, hash: await tokenHash(params.code), purpose: "reset" });
        if (!userId) throw new ConvexError("That code is invalid or expired. Request a new reset email.");
        await modifyAccountCredentials(ctx, { provider: "player-password", account: { id: playerId, secret: params.newPassword } });
        await invalidateSessions(ctx, { userId });
        return { userId };
      }
      requireRecoveryMail();
      const email = normalizeEmail(params.email);
      const purpose = params.flow === "reset" ? "reset" : "verify";
      if (purpose === "verify") {
        const owner = await ctx.runQuery(internal.accounts.owner, {});
        if (!owner?.saved || owner.playerId !== playerId) throw new ConvexError("Sign in to your saved player first.");
        if (typeof params.password !== "string" || params.password.length < 1 || params.password.length > 128)
          throw new ConvexError("Enter your current password.");
        try { await retrieveAccount(ctx, { provider: "player-password", account: { id: playerId, secret: params.password } }); }
        catch { throw new ConvexError("Your current password wasn’t accepted."); }
      }
      const code = crypto.randomUUID().replaceAll("-", "");
      const recipient = await ctx.runMutation(internal.recovery.issue, { playerId, email, hash: await tokenHash(code), purpose });
      if (recipient) {
        try { await sendRecoveryMail(recipient, code, playerId, purpose); }
        catch (error) {
          // Reset responses never disclose whether a supplied ID/email matched.
          if (purpose === "verify") throw error;
          console.warn("Recovery email delivery failed; no address or code logged.");
        }
      } else if (purpose === "verify") throw new ConvexError("Email limit reached. Please wait before sending another code.");
      return null;
    }
    if (typeof params.password !== "string" || params.password.length < 1 || params.password.length > 128)
      throw new ConvexError("Enter your password (up to 128 characters).");
    if (params.flow === "save") {
      validateNewPassword(params.password);
      // Check ownership before account creation, including duplicate/retried saves.
      const owner = await ctx.runQuery(internal.accounts.owner, {});
      if (!owner || owner.playerId !== playerId)
        throw new ConvexError("You can only save the player signed in to this browser.");
      // Saving adds a credential to the same player, not a different identity.
      // Keep its verified session to avoid racing the live auth subscription
      // against deletion of the guest session during credential enrollment.
      existingSession = owner.sessionId;
      if (!owner.saved) {
        const { user } = await createAccount(ctx, {
          provider: "player-password", account: { id: playerId, secret: params.password },
          profile: { email: playerId }, shouldLinkViaEmail: false, shouldLinkViaPhone: false,
        });
        return { userId: user._id, sessionId: existingSession };
      }
      // A retry proves the original password instead of replacing it.
    } else if (params.flow !== "signIn") throw new ConvexError("Choose save account or sign in.");
    try {
      const { user } = await retrieveAccount(ctx, {
        provider: "player-password", account: { id: playerId, secret: params.password },
      });
      return { userId: user._id, ...(existingSession ? { sessionId: existingSession } : {}) };
    } catch {
      throw new ConvexError("The player ID or password wasn’t accepted. Check both, or wait a few minutes if you’ve tried several times.");
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous, playerPassword],
  callbacks: { createOrUpdateUser: linkAccountUser },
});
