import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import type { PublicPlayer } from "./PlayerPanel";
import { RecoveryControls } from "./RecoveryControls";

export function AccountControls({ player, saved, onAccountSwitch }: {
  player: PublicPlayer | null;
  saved: boolean;
  onAccountSwitch: () => void;
}) {
  const { signIn, signOut } = useAuthActions();
  const [mode, setMode] = useState<"save" | "signIn" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [understood, setUnderstood] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { setMode(null); setError(""); setUnderstood(false); }, [player?.playerId]);
  function choose(next: "save" | "signIn" | null) {
    form.current?.reset(); setMode(next); setError(""); setNotice(""); setUnderstood(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !mode) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (mode === "save" && password !== data.get("confirm")) { setError("The two passwords don’t match."); return; }
    if (mode === "signIn" && player && !understood) { setError("Confirm that you want to switch to your saved account."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await signIn("player-password", {
        flow: mode, playerId: mode === "save" ? player!.playerId : String(data.get("username") ?? ""), password,
      });
      if (!result.signingIn) throw new Error("Sign-in did not complete");
      form.current?.reset();
      if (mode === "signIn") onAccountSwitch();
      setNotice(mode === "save" ? "Account saved. Use this player ID and password on any device." : "Signed in. Your friends and saved cases are below.");
      setMode(null);
    } catch (e) {
      setError(e instanceof ConvexError && typeof e.data === "string" ? e.data : "Sign-in didn’t complete. Check your details and connection, then try again.");
    } finally { setBusy(false); }
  }
  return <section className="account-controls" aria-labelledby="account-title">
    <div className="account-heading"><h3 id="account-title">{saved ? "Your account is saved" : player ? "Keep this player on every device" : "Already have a saved player?"}</h3><span className={`account-tag ${saved ? "saved" : ""}`}>{saved ? "ACCOUNT" : "GUEST"}</span></div>
    <p className="player-note">{saved ? "Convex keeps your player ID, friends and cases. Sign in with your ID and password to restore them on another browser or device." : player ? "Set a password to keep this exact ID, your friends and your cases. Until then, clearing browser data loses access to this guest." : "Sign in with your player ID and password. You don’t need to create another guest first."}</p>
    {!mode ? <div className="account-actions">
      {player && !saved && <button onClick={() => choose("save")}>Save my account</button>}
      <button onClick={() => choose("signIn")}>{saved ? "Switch account" : "Sign in to an existing account"}</button>
      {saved && <button disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await signOut(); onAccountSwitch(); setNotice("Signed out on this browser. Your account is still saved."); }
        catch { setError("Sign-out didn’t complete. Check your connection and try again."); }
        finally { setBusy(false); }
      }}>Sign out</button>}
    </div> : <form ref={form} onSubmit={submit}>
      <label htmlFor="account-player-id">{mode === "save" ? "Player ID to save" : "Saved player ID"}</label>
      <input id="account-player-id" name="username" autoComplete="username" autoCapitalize="characters" spellCheck={false} maxLength={13} required readOnly={mode === "save"} defaultValue={mode === "save" ? player?.playerId : ""} placeholder="OS-XXXXXXXXXX" />
      <label htmlFor="account-password">{mode === "save" ? "Create a password" : "Password"}</label>
      <input id="account-password" name="password" type="password" autoComplete={mode === "save" ? "new-password" : "current-password"} minLength={mode === "save" ? 12 : 1} maxLength={128} required aria-describedby="password-guidance" />
      {mode === "save" && <><label htmlFor="account-password-confirm">Confirm password</label><input id="account-password-confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></>}
      <p id="password-guidance" className="player-note">{mode === "save" ? "Use 12–128 characters. After saving, add and verify a recovery email below. " : "Forgot your password? Use account recovery below. "}Your public ID alone cannot restore access.</p>
      {mode === "signIn" && player && <label className="account-consent"><input type="checkbox" checked={understood} required onChange={e => setUnderstood(e.target.checked)} />I understand this loads a different account; it won’t merge this {saved ? "account" : "guest"}’s friends or cases. {saved ? "" : "Save this guest first if you want to keep it."}</label>}
      <div className="account-actions"><button disabled={busy}>{busy ? "Connecting…" : mode === "save" ? "Save this player" : "Sign in"}</button><button type="button" disabled={busy} onClick={() => choose(null)}>Cancel</button></div>
    </form>}
    {error && <p className="social-error" role="alert">{error}</p>}
    {notice && <p className="social-status" role="status">{notice}</p>}
    <RecoveryControls key={player?.playerId ?? "signed-out"} playerId={player?.playerId} saved={saved} onAccountSwitch={onAccountSwitch} />
  </section>;
}
