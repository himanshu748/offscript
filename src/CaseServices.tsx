import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { BookOpenCheck, MessageCircle, Send } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function CaseServices({ roomId, connected, timed }: { roomId: Id<"rooms">; connected: boolean; timed: boolean }) {
  const data = useQuery(api.caseServices.get, { roomId });
  const checkSources = useMutation(api.caseServices.checkSources);
  const ask = useMutation(api.caseServices.ask);
  const email = useMutation(api.caseServices.emailDebrief);
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
      <h2 id="station-line-title">An open line to the archive.</h2>
      <p>Check the history. Talk through the evidence. Neither service can solve a stage for the server or change your ending.</p>
    </div>
    <div className="services-grid">
      <article className="source-service">
        <h3><BookOpenCheck size={21} /> Check the dispatch’s history</h3>
        <p>Firecrawl reads the two NASA mission pages and checks their launch dates. A successful check stays attached to this case.</p>
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
        <div className="character-heading"><h3><MessageCircle size={21} /> Mara Vale</h3><span>AI CHARACTER</span></div>
        <p>An AI interpretation of Mara, separate from the recorded tape. She sees shared clues, recovered passages and this conversation—not sealed evidence. Your partner sees every message here.</p>
        <div ref={log} className="character-log" aria-label="Conversation with Mara" aria-live="polite" aria-relevant="additions text"
          onScroll={event => { const el = event.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; }}>
          {data.messages.length === 0 ? <p className="service-note">No conversation yet. Share both clues, then ask what to look at next.</p> : data.messages.map(message => <div key={message.id} className={`character-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "Mara · AI" : "Your team"}</strong><p>{message.text}</p>
          </div>)}
          {data.aiStatus === "working" && <p className="service-note service-pending">Mara is reading the shared notes…</p>}
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
        {!data.canConsult && <p className="service-note">Both players must share this stage’s clues before asking Mara.</p>}
        {data.aiError && <p className="service-error" role="status">{data.aiError}</p>}
        <p className="service-note">{data.model} via Vercel AI Gateway. No model fallback. AI advice can be wrong; your team decides.</p>
      </article>
    </div>
    <div className="debrief-service">
      <div><h3>Keep the case in your inbox.</h3><p>After your ending, send yourself its recorded consequences, the team’s score and Mara’s last AI note, if she answered. Save your player and verify an email in Players & friends first. Replies to this email do not enter the game.</p></div>
      <div>{data.mailStatus ? <p role="status">Email status: <strong>{data.mailStatus}</strong>. {data.mailStatus === "status-unavailable" ? "The provider status record is no longer available. We won't resend automatically." : "“Sent” means accepted by AgentMail, not confirmed in your inbox."} Replies do not unlock gameplay.</p> : <>
        <label className="debrief-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!data.canEmail} /> Send this case debrief to my verified email through AgentMail. The shared sender is rentpilot-himanshu@agentmail.to.</label>
        <button disabled={!consent || !data.canEmail || !connected || busy} onClick={() => void run(() => email({ roomId, consent: true }))}>Email my debrief</button>
      </>}</div>
    </div>
    <p className="service-notice" role="status">{notice}</p>
    <p className="service-note">Shared daily caps: 10 source checks, 40 AI turns, 10 debrief emails. Failed attempts count. The game remains playable when a service is unavailable.</p>
  </section>;
}
