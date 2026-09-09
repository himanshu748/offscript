import { useRef, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api";

type Mode = "email" | "verify" | "request" | "reset" | null;
export function RecoveryControls({ playerId, saved, onAccountSwitch }: {
  playerId?: string; saved: boolean; onAccountSwitch: () => void;
}) {
  const status = useQuery(api.recovery.status, {});
  const { signIn } = useAuthActions();
  const accountAction = useAction(api.auth.signIn);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resetPlayer, setResetPlayer] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const select = (next: Mode) => { form.current?.reset(); setMode(next); setError(""); setNotice(""); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !mode) return;
    const data = new FormData(event.currentTarget);
    const id = mode === "email" || mode === "verify" ? playerId! : String(data.get("playerId") ?? "").trim().toUpperCase();
    const newPassword = String(data.get("newPassword") ?? "");
    if (mode === "reset" && newPassword !== data.get("confirm")) { setError("The new passwords don’t match."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const params = {
        flow: mode === "email" ? "recovery-email" : mode === "verify" ? "recovery-email-verify" : mode === "request" ? "reset" : "reset-verification",
        playerId: id, email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""),
        code: String(data.get("code") ?? "").trim(), newPassword,
      };
      // Sending/confirming email is not a login. The auth React helper would
      // clear the current session when a credentials action returns null tokens.
      const result = mode === "reset" ? await signIn("player-password", params)
        : (await accountAction({ provider: "player-password", params }), { signingIn: false });
      if (mode === "reset" && !result.signingIn) throw new Error("Reset did not complete");
      form.current?.reset();
      if (mode === "email") { setMode("verify"); setNotice("Verification email sent. Paste its code below within 15 minutes."); }
      else if (mode === "verify") { setMode(null); setNotice("Recovery email verified. You can now reset a forgotten password."); }
      else if (mode === "request") {
        setResetPlayer(id); setMode("reset");
        setNotice("If that player ID and verified email match, a reset code will arrive shortly. Check spam too. Only the newest code works.");
      } else {
        setMode(null); onAccountSwitch();
        setNotice("Password reset. You’re signed in with the same player ID, friends and cases. Other sessions are signed out.");
      }
    } catch (e) {
      setError(e instanceof ConvexError && typeof e.data === "string" ? e.data : "That didn’t complete. Check your connection or request a new code, then try again.");
    } finally { setBusy(false); }
  }
  return <section className="recovery-controls" aria-labelledby="recovery-title">
    <h4 id="recovery-title">Account recovery</h4>
    {saved && <p className="player-note">{status?.verified ? `Recovery enabled · ${status.emailHint}. Your email is private.` : "Add and verify a private recovery email. Without it, a forgotten password cannot be reset."}</p>}
    {status && !status.available && <p className="player-note" role="status">Recovery email delivery is not configured yet. Existing passwords still work.</p>}
    {!mode ? <div className="account-actions">
      {saved && <button disabled={busy || !status?.available} onClick={() => select("email")}>{status?.verified ? "Change recovery email" : "Add recovery email"}</button>}
      {saved && status?.pending && <button disabled={busy} onClick={() => select("verify")}>Verify recovery email</button>}
      <button disabled={busy || !status?.available} onClick={() => select("request")}>Forgot password?</button>
      <button disabled={busy} onClick={() => select("reset")}>I have a reset code</button>
    </div> : <form ref={form} onSubmit={submit} key={mode}>
      <p className="player-note">{mode === "email" ? "Confirm your current password before adding or changing your recovery email. The old email remains active until you verify the new one." : mode === "verify" ? "Paste the verification code from your email. It expires after 15 minutes." : mode === "request" ? "Use your saved player ID and the email you previously verified. Unsaved guests and unverified addresses cannot be recovered." : "Paste the newest reset code and choose a new password. This restores that account, without merging a different guest’s data."}</p>
      {(mode === "request" || mode === "reset") && <><label htmlFor="recovery-player">Saved player ID</label><input id="recovery-player" name="playerId" autoComplete="username" autoCapitalize="characters" maxLength={13} placeholder="OS-XXXXXXXXXX" defaultValue={resetPlayer} required /></>}
      {(mode === "email" || mode === "request") && <><label htmlFor="recovery-email">Private recovery email</label><input id="recovery-email" type="email" name="email" autoComplete="email" maxLength={254} required /></>}
      {mode === "email" && <><label htmlFor="recovery-password">Current password</label><input id="recovery-password" type="password" name="password" autoComplete="current-password" maxLength={128} required /></>}
      {(mode === "verify" || mode === "reset") && <><label htmlFor="recovery-code">{mode === "verify" ? "Verification code" : "Reset code"}</label><input id="recovery-code" name="code" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} minLength={32} maxLength={32} required /></>}
      {mode === "reset" && <><label htmlFor="recovery-new-password">New password</label><input id="recovery-new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><label htmlFor="recovery-confirm">Confirm new password</label><input id="recovery-confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><p className="player-note">Use 12–128 characters. Resetting signs out other sessions; it does not erase your cases or friends.</p></>}
      <div className="account-actions"><button disabled={busy || ((mode === "email" || mode === "request") && !status?.available)}>{busy ? "Working…" : mode === "email" ? "Send verification code" : mode === "verify" ? "Verify recovery email" : mode === "request" ? "Send reset code" : "Reset password & sign in"}</button><button type="button" disabled={busy} onClick={() => select(null)}>Cancel</button></div>
      {mode === "reset" && <button type="button" disabled={busy} onClick={() => select("request")}>Request a new reset code</button>}
    </form>}
    {error && <p className="social-error" role="alert">{error}</p>}
    {notice && <p className="social-status" role="status">{notice}</p>}
  </section>;
}
