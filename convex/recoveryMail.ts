import { ConvexError } from "convex/values";

export async function tokenHash(code: unknown) {
  if (typeof code !== "string" || !/^[a-f0-9]{32}$/i.test(code.trim()))
    throw new ConvexError("Paste the complete recovery code from your email.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code.trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function requireRecoveryMail() {
  if (!process.env.AGENTMAIL_API_KEY || !process.env.AGENTMAIL_INBOX_ID)
    throw new ConvexError("Recovery email is not configured yet. Your current password still works.");
}
export async function sendRecoveryMail(email: string, code: string, playerId: string, purpose: "verify" | "reset") {
  requireRecoveryMail();
  const reset = purpose === "reset";
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(process.env.AGENTMAIL_INBOX_ID!)}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ to: [email], subject: reset ? "Reset your OFFSCRIPT password" : "Verify your OFFSCRIPT recovery email",
      text: `${reset ? "Someone requested a password reset" : "Confirm this recovery email"} for player ${playerId}.\n\nYour single-use code:\n${code}\n\nOpen OFFSCRIPT at ${process.env.SITE_URL ?? "https://flexible-kiwi-480.convex.site"}, select Players & friends, then ${reset ? "Forgot password?" : "Verify recovery email"} and paste this code. It expires in 15 minutes. Only the newest code works.\n\n${reset ? "Resetting signs out your other sessions but keeps your player ID, friends and cases." : "Your email stays private and is not shown to other players."}\n\nIf you did not request this, ignore the email. Never share the code.` }),
  });
  if (!response.ok) throw new ConvexError("The email service could not send right now. Please try again later.");
}
