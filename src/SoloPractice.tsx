import { useState } from "react";

// Deliberately does not import the case engine, production clues, Convex, or auth.
// This disposable exercise never creates a room, identity, vote, or score.
export function SoloPractice({ onExit }: { onExit: () => void }) {
  const [shared, setShared] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [ending, setEnding] = useState(false);
  return <main id="main" className="solo-practice">
    <section aria-labelledby="practice-title">
      <span className="eyebrow">SOLO GUIDED PRACTICE · SCRIPTED PARTNER · NO SCORE</span>
      <h1 id="practice-title">Learn to share the missing half.</h1>
      <p>This separate training exercise takes about two minutes. No account, microphone, timer or second person required. These are tutorial clues, not answers to The Last Transmission. Reloading restarts this exercise.</p>
      <p className="current-instruction"><strong>Next:</strong> {!shared ? "Read your clue, then share it." : !solved ? "Combine both clues and submit a locker name." : !ending ? "Read the scripted partner’s preference, then agree on an ending." : "You finished practice. Invite a real friend for the full case."}</p>
      <article className="source-service"><h2>Your tutorial clue</h2><p>The Cedar locker contains a letter. The Birch locker contains a key.</p>
        <button disabled={shared} onClick={() => { setShared(true); setNotice("Your clue is shared. The scripted partner has now shared theirs."); }}>{shared ? "Shared with scripted partner" : "Share my tutorial clue"}</button>
      </article>
      <article className="source-service"><h2>Scripted partner · not a live player</h2><p>{shared ? "We need the key, not the letter. Which locker should we open?" : "I’ll share my instruction when you share yours. In multiplayer, your real partner decides when to share."}</p></article>
      {shared && !solved && <form onSubmit={e => { e.preventDefault(); const correct = answer.trim().toLowerCase() === "birch"; setSolved(correct); setNotice(correct ? "Both clues were needed: your inventory named the locker; your partner named the object." : "That does not match both clues. Compare the object we need with your inventory. Nothing is lost in practice."); }}>
        <label htmlFor="practice-answer">Which locker contains what the team needs?</label>
        <input id="practice-answer" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={40} autoComplete="off" />
        <button type="submit">Check tutorial answer</button>
        <button type="button" onClick={() => setHint(true)}>Show tutorial hint · no penalty</button>
        {hint && <p>Find “key” in your clue, then read the locker name beside it. Real-case shared hints cost 10 points and show that cost before you open them.</p>}
      </form>}
      {solved && !ending && <article><h2>Agree together</h2><p>Scripted partner: “I would keep the letter private.” In the real case, different votes do not resolve the ending. Discuss the consequences in team chat; either person can change their vote.</p><button onClick={() => { setEnding(true); setNotice("Tutorial consensus reached. This scripted agreement is not a multiplayer result."); }}>Agree to keep the tutorial letter private</button></article>}
      <p role="status">{notice}</p>
      <p>In the full case, the server owns the rules, clues and timer. Optional source checks and Mara’s AI commentary cannot change them. You can finish using the authored clues and text chat alone.</p>
      <button onClick={onExit}>{ending ? "Return and invite a real partner" : "Exit solo practice"}</button>
    </section>
  </main>;
}
