import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { MessageCircle, Send, X } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function TeamChat({ roomId, role, connected }: {
  roomId: Id<"rooms">; role: "archivist" | "operator"; connected: boolean;
}) {
  const messages = useQuery(api.rooms.messages, { roomId });
  const send = useMutation(api.rooms.sendMessage);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const followLatest = useRef(true);
  const seen = useRef<Set<string> | null>(null);
  const pending = useRef<{ clientId: string; text: string } | null>(null);
  const newestId = messages?.at(-1)?.id;

  useEffect(() => {
    if (!messages) return;
    const fresh = seen.current ? messages.filter(message => !seen.current!.has(message.id) && message.role !== role) : [];
    seen.current = new Set(messages.map(message => message.id));
    if (open && followLatest.current) {
      if (log.current) log.current.scrollTop = log.current.scrollHeight;
      setUnread(0);
    } else if (fresh.length) setUnread(count => count + fresh.length);
  }, [newestId, open, messages, role]);

  function toggle() {
    followLatest.current = true;
    setOpen(value => !value);
    if (!open) setUnread(0);
  }
  function close() { setOpen(false); launcher.current?.focus(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || busy || !connected) return;
    setBusy(true); setError("");
    if (pending.current?.text !== body) pending.current = { clientId: crypto.randomUUID(), text: body };
    try {
      await send({ roomId, ...pending.current });
      setText(""); pending.current = null; followLatest.current = true;
      if (log.current) log.current.scrollTop = log.current.scrollHeight;
    } catch (cause) {
      setError(cause instanceof ConvexError && typeof cause.data === "string" ? cause.data : "Message not confirmed. Your text is still here; reconnect and try again.");
    } finally { setBusy(false); input.current?.focus(); }
  }

  return <aside className="team-chat" aria-label="Private team conversation">
    {open && <section id="team-chat-panel" className="team-chat-panel" aria-labelledby="team-chat-title"
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <div className="team-chat-heading"><div><h2 id="team-chat-title">Talk to your partner</h2><p>Just your two seats · saved with this room</p></div>
        <button type="button" className="chat-close" aria-label="Close team chat" onClick={close}><X size={16} /></button></div>
      <div ref={log} className="team-chat-log" role="log" aria-label="Team messages" aria-live="polite" aria-relevant="additions text"
        onScroll={event => {
          const el = event.currentTarget;
          followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          if (followLatest.current) setUnread(0);
        }}>
        {!messages ? <p className="chat-empty">Loading your conversation…</p> : messages.length === 0 ? <p className="chat-empty">Compare clues, suggest an answer, or discuss your ending. No microphone needed.</p> : messages.map(message => <article key={message.id} className={`team-message ${message.role === role ? "own-message" : "partner-message"}`}>
          <div><strong>{message.role === role ? "You" : "Partner"} · {message.role}</strong><time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <p>{message.text}</p>
        </article>)}
      </div>
      {unread > 0 && <button type="button" className="chat-latest" onClick={() => {
        followLatest.current = true; setUnread(0); if (log.current) log.current.scrollTop = log.current.scrollHeight;
      }}>{unread} new {unread === 1 ? "message" : "messages"} ↓</button>}
      <form className="team-chat-form" onSubmit={submit}>
        <label htmlFor="team-message">Message your partner</label>
        <textarea ref={input} id="team-message" maxLength={500} rows={2} value={text}
          placeholder="What does your clue say?" disabled={busy}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); event.currentTarget.form?.requestSubmit();
            }
          }} />
        <div className="team-chat-footer"><span>{connected ? `${text.length}/500` : "Reconnecting · your text stays here"}</span>
          <button type="submit" disabled={!connected || busy || !text.trim()}><Send size={16} />{busy ? "Sending…" : "Send"}</button></div>
        {error && <p className="chat-error" role="status">{error}</p>}
        <p className="chat-privacy">Latest 100 messages. Team chat is not sent to Mara or included in email debriefs.</p>
      </form>
    </section>}
    <button ref={launcher} type="button" className="team-chat-launcher" aria-expanded={open} aria-controls="team-chat-panel" onClick={toggle}>
      <MessageCircle size={16} /> Team chat {unread > 0 && <span className="chat-unread" aria-label={`${unread} unread messages`}>{unread > 99 ? "99+" : unread}</span>}
    </button>
  </aside>;
}
