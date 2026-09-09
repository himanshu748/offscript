// Authored fiction, projected server-side. Unrecovered passages never travel to
// either player or the AI. Historical evidence remains in the cited clues.
const passages = [
  { title: "A voice behind the static", text: "Mara Vale left a recording inside a misfiled dispatch. Recover it together: one desk holds the record, the other holds the cross-check. Neither is enough alone." },
  { title: "The missing name", text: "Mara, recorded: ‘The dispatch was not lost. I filed it where nobody would look. There is a witness on this tape. I promised her that nobody outside the station would hear her voice.’" },
  { title: "An edit in Mara’s hand", text: "Mara, recorded: ‘The correction order carries my initials. I removed her warning from the public log. I told myself I was protecting her. I was protecting my position, too.’" },
  { title: "The whole recording", text: "Witness, recorded: ‘Keep my statement as evidence, Mara. But do not broadcast my name.’ Mara’s confession follows it on the same transmission. This station can release the complete recording or keep it sealed; it cannot redact a copy before the link closes." },
];
const outcomes = {
  broadcast: { title: "The truth has her voice attached.", text: "You broadcast the complete recording. Mara’s signed edit and confession enter the public record. So does the witness’s name, against her recorded request. The cover-up is exposed; the witness loses the privacy Mara promised her.", cost: "Public accountability. A broken promise to the witness." },
  preserve: { title: "A promise kept. A record still wrong.", text: "You seal the recording in the archive. The witness keeps her privacy and the evidence survives, but no correction reaches the public record. Mara’s confession remains beside the warning she removed. You have protected the witness, not cleared Mara.", cost: "The witness stays private. The public account stays false." },
};
export function storyFor(state) {
  if (!state.challenge) return null;
  const recovered = state.clock && !state.clock.deadline ? 0 : Math.min(3, state.challenge.index);
  return {
    recovered,
    passages: passages.slice(0, recovered + 1),
    next: state.clock?.expired ? "The link closed. Your recovered passages remain in the case record."
      : state.phase === "resolved" ? "Your joint decision is saved. An email debrief is optional."
      : state.clock && !state.clock.deadline ? "Both players: press Ready to open your private evidence."
      : recovered === 3 ? "Read the witness’s request, discuss the cost, then agree on one ending."
      : !state.contributed.includes("archivist") || !state.contributed.includes("operator") ? "Read your private clue, share it, then compare it with your partner’s."
      : "Both clues are shared. Cross-check them and submit one answer for the team.",
    outcome: state.phase === "resolved" ? outcomes[state.ending] ?? null : null,
  };
}
