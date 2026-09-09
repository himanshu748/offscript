import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Copy, Users, X } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { AccountControls } from "./AccountControls";

export type PublicPlayer = { playerId: string; name: string };

export function PlayerPanel({ onInvite, onJoin, timed, onResume, onAccountSwitch }: {
  onInvite: (playerId: string) => Promise<void>;
  onJoin: (token: string) => Promise<void>;
  timed: boolean;
  onResume: (roomId: Id<"rooms">) => void;
  onAccountSwitch: () => void;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const friends = useQuery(api.players.list, isAuthenticated ? {} : "skip");
  const invitations = useQuery(api.rooms.invitations, isAuthenticated ? {} : "skip");
  const account = useQuery(api.accounts.status, isAuthenticated ? {} : "skip");
  const savedRooms = useQuery(api.rooms.mine, isAuthenticated ? {} : "skip");
  const ensure = useMutation(api.players.ensure);
  const rename = useMutation(api.players.rename);
  const request = useMutation(api.players.request);
  const respond = useMutation(api.players.respond);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [friendId, setFriendId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const enrolling = useRef(false);
  useEffect(() => {
    if (isAuthenticated && me === null && !enrolling.current) {
      enrolling.current = true;
      void ensure().catch(() => setError("Your player ID couldn’t be created. Use Retry below."));
    }
    if (!isAuthenticated) enrolling.current = false;
  }, [isAuthenticated, me, ensure]);
  useEffect(() => { if (me) setName(me.name); }, [me?.name]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function run(task: () => Promise<unknown>, success = "") {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await task(); setNotice(success); }
    catch (e) { setError(e instanceof ConvexError && typeof e.data === "string" ? e.data : "That didn’t go through. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const pending = friends?.filter(f => f.status === "pending") ?? [];
  const accepted = friends?.filter(f => f.status === "accepted") ?? [];
  const updates = pending.filter(f => f.incoming).length + (invitations?.length ?? 0);
  return <>
    <button className="player-menu-button" onClick={() => setOpen(true)}>
      <Users size={17} /> Players & friends {updates > 0 && <span className="friend-badge">{updates}<span className="sr-only"> new requests or invitations</span></span>}
    </button>
    <dialog ref={dialog} className="player-dialog" onClose={() => setOpen(false)} aria-labelledby="players-title">
      <div className="player-dialog-heading">
        <div><span className="player-eyebrow">OFFSCRIPT / YOUR CONTACTS</span><h2 id="players-title">Find your other half.</h2></div>
        <button className="player-close" aria-label="Close players and friends" onClick={() => setOpen(false)}><X size={22} /></button>
      </div>
      <p className="player-note">Player IDs tell you who’s at the other desk. An ID alone never grants access to an account.</p>
      <AccountControls player={me ?? null} saved={account?.saved ?? false} onAccountSwitch={onAccountSwitch} />
      {!isAuthenticated ? <button className="primary" disabled={busy || isLoading} onClick={() => run(() => signIn("anonymous"))}>{busy ? "Creating your session…" : "Get my player ID"}</button>
      : !me ? <div><p>Setting up your player ID…</p>{error && <button className="primary" disabled={busy} onClick={() => run(() => ensure())}>Retry player setup</button>}</div>
      : <>
        <section className="my-player" aria-label="Your player profile">
          <label htmlFor="public-player-id">Your player ID</label>
          <div className="player-id-row"><input id="public-player-id" value={me.playerId} readOnly onFocus={e => e.target.select()} /><button aria-label="Copy your player ID" disabled={busy} onClick={() => run(async () => {
            try { await navigator.clipboard.writeText(me.playerId); }
            catch { throw new ConvexError("Select the player ID and copy it manually."); }
          }, "Player ID copied. Share it with a friend.")}><Copy size={18} /></button></div>
          <form onSubmit={e => { e.preventDefault(); void run(() => rename({ name }), "Display name saved."); }}>
            <label htmlFor="player-name">Display name</label><div className="player-input-row"><input id="player-name" value={name} maxLength={24} minLength={2} required onChange={e => setName(e.target.value)} /><button disabled={busy || name.trim() === me.name}>Save name</button></div>
          </form>
          <p className="player-note">{account?.saved ? "Account saved in Convex. Use this ID and your password to sign in on another device." : "Guest session: save your account above before clearing browser data or changing devices."}</p>
        </section>
        <form className="add-friend" onSubmit={e => { e.preventDefault(); void run(async () => { await request({ playerId: friendId }); setFriendId(""); }, "Friend request saved."); }}>
          <label htmlFor="friend-player-id">Add a friend by player ID</label>
          <div className="player-input-row"><input id="friend-player-id" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="OS-XXXXXXXXXX" maxLength={13} required value={friendId} onChange={e => setFriendId(e.target.value.toUpperCase())} /><button disabled={busy || !friendId.trim()}>Send request</button></div>
        </form>
        {(invitations?.length ?? 0) > 0 && <section className="social-section" aria-label="Room invitations"><h3>Your desk is waiting</h3>{invitations!.map(invite => <article className="friend-row" key={invite.roomId}><div><strong>{invite.host.name}</strong><span>{invite.host.playerId} · {invite.timed ? "8-minute case" : "Practice"}</span></div><button disabled={busy} onClick={() => run(async () => { await onJoin(invite.inviteToken); setOpen(false); })}>Join room</button></article>)}</section>}
        {pending.length > 0 && <section className="social-section" aria-label="Friend requests"><h3>Requests</h3>{pending.map(friend => <article className="friend-row" key={friend.id}><div><strong>{friend.player.name}</strong><span>{friend.player.playerId}</span><span>{friend.incoming ? "Wants to be your friend" : "Waiting for them to accept"}</span></div><div className="friend-actions">{friend.incoming && <button disabled={busy} onClick={() => run(() => respond({ id: friend.id, action: "accept" }), "You’re now friends.")}><Check size={15} />Accept</button>}<button disabled={busy} onClick={() => run(() => respond({ id: friend.id, action: "remove" }))}>{friend.incoming ? "Decline" : "Cancel request"}</button></div></article>)}</section>}
        <section className="social-section" aria-label="Your friends"><h3>Friends <span>{accepted.length}/50</span></h3>
          {friends === undefined ? <p>Loading your contacts…</p> : accepted.length === 0 ? <p className="player-note">No friends yet. Swap IDs with your partner to find each other next time.</p> : <p className="player-note">Invite opens a new {timed ? "eight-minute" : "practice"} case and reserves the second seat for that friend. Finish your current game before starting another.</p>}
          {accepted.map(friend => <article className="friend-row" key={friend.id}><div><strong>{friend.player.name}</strong><span>{friend.player.playerId}</span></div><div className="friend-actions"><button disabled={busy} onClick={() => run(async () => { await onInvite(friend.player.playerId); setOpen(false); })}>Invite to new room</button><button disabled={busy} onClick={() => run(() => respond({ id: friend.id, action: "remove" }), "Friend removed.")}>Remove</button></div></article>)}
        </section>
        {(savedRooms?.length ?? 0) > 0 && <section className="social-section" aria-label="Your saved cases"><h3>Your saved cases</h3><p className="player-note">Your eight most recent rooms. Timers keep running while you’re away.</p>{savedRooms!.map(room => <article className="friend-row" key={room.roomId}><div><strong>The Last Transmission</strong><span>{room.role} · {room.status}</span><span>{new Date(room.createdAt).toLocaleString()}</span></div><button onClick={() => { onResume(room.roomId); setOpen(false); }}>Open case</button></article>)}</section>}
      </>}
      {error && <p className="social-error" role="alert">{error}</p>}
      <p className="social-status" role="status">{busy ? "Saving…" : notice}</p>
      <aside className="voice-note"><strong>Voice: bring your own call</strong><p>Use Discord, WhatsApp or another call while you play. OFFSCRIPT has no in-game voice, doesn’t access your microphone and doesn’t record audio.</p></aside>
    </dialog>
  </>;
}
