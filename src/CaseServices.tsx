import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { BookOpenCheck, MessageCircle, Send } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function CaseServices({ roomId, connected, timed }: { roomId: Id<"rooms">; connected: boolean; timed: boolean }) {
  const data = useQuery(api.caseServices.get, { roomId });
  const checkSources = useMutation(api.caseServices.checkSources);
  const ask = useMutation(api.caseServices.ask);
  const email = useMutation(api.caseServices.emailDebrief);
  const requestRecipient = useAction(api.caseServices.requestRecipient);
  const verifyRecipient = useMutation(api.caseServices.verifyRecipient);
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [verifyConsent, setVerifyConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => {
    if (log.current && followLatest.current) log.current.scrollTop = log.current.scrollHeight;
  }, [data?.messages.length, data?.aiStatus]);
  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    try { const result = await action(); setNotice(result.ok && /^(Mara is reading|Checking two NASA)/.test(result.message) ? "" : result.message); return result.ok; }
    catch (error) { setNotice(error instanceof ConvexError && typeof error.data === "string" ? error.data : "That request could not finish. Check your connection and try again later."); return false; }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await run(() => ask({ roomId, question }))) setQuestion("");
  }
  if (!data) return <p className="field-hint">Loading the station line…</p>;
  return <section className="case-services" aria-labelledby="station-line-title">
    <div className="services-heading"><span className="eyebrow">{timed ? "OPTIONAL / YOUR CLOCK KEEPS RUNNING" : "OPTIONAL / TAKE YOUR TIME"}</span>
      <h2 id="station-line-title">Source checks & hints.</h2>
      <p>Optional help for your current case. The game works without these tools.</p>
    </div>
    <div className="services-grid">
      <article className="source-service">
        <h3><BookOpenCheck size={16} /> Check the dispatch’s history</h3>
        <p>Use this to check whether the opening manifest agrees with NASA. Firecrawl checks two fixed public mission pages. A validated receipt may be reused for 24 hours across rooms and can feed the source-backed case compiler on the station home. It never changes this room’s answer, testimony or ending.</p>
        {data.sources.length > 0 ? <ul className="source-receipts">{data.sources.map(source => <li key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>
          <p>{source.excerpt}</p>
          <small>Checked {new Date(source.checkedAt).toLocaleString()} · Firecrawl</small>
          <details><summary>Extraction fingerprint</summary><code>{source.hash}</code></details>
        </li>)}</ul> : <>
          <button disabled={busy || !connected || !data.canReadSources || data.sourceStatus === "working" || data.sourceAttempts >= 2}
            onClick={() => void run(() => checkSources({ roomId }))}>{data.sourceStatus === "working" ? "Reading NASA pages…" : "Check live sources"}</button>
          <p className="service-note">{!data.canReadSources ? "Share both dispatch clues to open this check." : `${2 - data.sourceAttempts} of 2 attempts left. No live check recorded yet.`}</p>
        </>}
        {data.sourceError && <p className="service-error" role="status">{data.sourceError}</p>}
      </article>
      <article className="character-service">
        <div className="character-heading"><h3><MessageCircle size={16} /> Mara Vale</h3><span>AI CHARACTER</span></div>
        <p>Mara helps you compare shared evidence; she cannot verify facts or decide the answer. Her AI commentary is separate from the authored recorded tape. She sees shared clues, recovered passages and this conversation—not sealed evidence. Your partner sees every message here.</p>
        <div ref={log} className="character-log" aria-label="Conversation with Mara" aria-live="polite" aria-relevant="additions text"
          onScroll={event => { const el = event.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; }}>
          {data.messages.length === 0 ? <p className="service-note">No conversation yet. Share both clues, then ask what to look at next.</p> : data.messages.map(message => <div key={message.id} className={`character-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "Mara · AI" : "Your team"}</strong><p>{message.text}</p>
          </div>)}
          {data.aiStatus === "working" && <p className="service-note service-pending">Mara is reading the shared notes. Keep playing; {timed ? "the authoritative clock is still running" : "you do not need to wait"}.</p>}
        </div>
        {data.messages.length > 2 && <button className="latest-message" type="button" onClick={() => { followLatest.current = true; if (log.current) log.current.scrollTop = log.current.scrollHeight; }}>Latest message ↓</button>}
        <form onSubmit={submit}>
          <div className="ai-shortcuts">
            <button type="button" disabled={busy || !connected || !data.canConsult || !data.aiConfigured || data.aiStatus === "working" || data.aiAttempts >= 6 || data.phase !== "investigating"}
              onClick={() => void run(() => ask({ roomId, mode: "hint", question: "" }))}>Nudge us on this stage</button>
            <button type="button" disabled={busy || !connected || !data.aiConfigured || data.aiStatus === "working" || data.aiAttempts >= 6 || data.phase !== "resolved"}
              onClick={() => void run(() => ask({ roomId, mode: "reflection", question: "" }))}>Reflect on our ending</button>
          </div>
          <p className="service-note">Each action uses one of your six AI turns. Nudges use shared evidence and team progress; reflections open after you agree on an ending. Neither changes your score.</p>
          <label htmlFor="mara-question">Ask about your shared evidence</label>
          <textarea id="mara-question" maxLength={500} rows={3} value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="What should we compare first?" disabled={!data.canConsult || !data.aiConfigured || data.aiAttempts >= 6} />
          <div className="service-form-footer"><small>{question.length}/500 · {6 - data.aiAttempts} turns left</small>
            <button disabled={busy || !connected || !data.canConsult || !data.aiConfigured || data.aiStatus === "working" || data.aiAttempts >= 6 || !question.trim()}><Send size={16} /> Ask Mara</button></div>
        </form>
        {!data.canConsult && <p className="service-note">Mara is available after both players share, while the case is active, or for reflection after a completed ending.</p>}
        {data.aiError && <p className="service-error" role="status">{data.aiError}</p>}
        <p className="service-note">{data.model} via Vercel AI Gateway. No model fallback. AI advice can be wrong; your team decides.</p>
      </article>
    </div>
    <div className="debrief-service">
      <div><h3>Keep the case in your inbox.</h3><p>After your ending, send yourself its recorded consequences, the team’s score and Mara’s last AI note, if she answered. Verify a private recipient below; no password account or recovery setup is required. Replies to this email do not enter the game.</p>
        {data.phase === "resolved" && !data.recipientVerified && <div>
          <label htmlFor="debrief-address">Your private email</label><input id="debrief-address" type="email" maxLength={254} value={address} onChange={e => setAddress(e.target.value)} />
          <label><input type="checkbox" checked={verifyConsent} onChange={e => setVerifyConsent(e.target.checked)} /> Send one verification code through AgentMail. This uses one of the shared daily email slots and does not subscribe me or enable recovery.</label>
          <button disabled={busy || !connected || !verifyConsent || !address.trim()} onClick={() => void run(() => requestRecipient({ roomId, email: address, consent: true }))}>Send verification code</button>
          <label htmlFor="debrief-code">Private verification code</label><input id="debrief-code" autoComplete="one-time-code" maxLength={32} value={code} onChange={e => setCode(e.target.value)} />
          <button disabled={busy || !connected || code.trim().length !== 32} onClick={() => void run(() => verifyRecipient({ roomId, code }))}>Verify recipient</button>
        </div>}
      </div>
      <div>{data.mailStatus ? <p role="status">Email status: <strong>{data.mailStatus}</strong>. {data.mailStatus === "status-unavailable" ? "The provider status record is no longer available. We won't resend automatically." : "“Sent” means accepted by AgentMail, not confirmed in your inbox."} Replies do not unlock gameplay.</p> : <>
        <label className="debrief-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!data.canEmail} /> Send this case debrief to my verified email through AgentMail. The shared sender is rentpilot-himanshu@agentmail.to.</label>
        <button disabled={!consent || !data.canEmail || !connected || busy} onClick={() => void run(() => email({ roomId, consent: true }))}>Email my debrief</button>
      </>}</div>
    </div>
    <p className="service-notice" role="status">{notice}</p>
    <p className="service-note">Shared daily caps: 10 source-check jobs (two public pages each), 40 AI turns, 10 emails including debrief verification. Failed provider attempts count. The game remains playable when a service is unavailable.</p>
  </section>;
}
