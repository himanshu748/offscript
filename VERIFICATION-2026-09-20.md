# September 20 verification

Scope: local frontend at port 5187 against the cloud development backend, followed by an approved production deployment and public smoke check. Two isolated Chromium identities were controlled by automation, not independent human players. No private invitation URL, recipient code or production solution is included here.

## Observed browser results

- Solo guided practice: entered from the landing page, shared the tutorial clue, tried a wrong choice, opened the hint, completed the tutorial and returned home. The scripted partner is labelled and the tutorial creates no multiplayer score.
- Multiplayer: created and joined an untimed case from separate browser identities. Each initially received a different private clue. Both share gates worked. One wrong answer and one authored hint produced 85/100; all three stages were completed using visible clues.
- Conflicting votes kept the decision open. A message sent through team chat reached the other browser. Matching Preserve votes saved the authored ending and 85/100 result. Reload restored it.
- Replay opened a new room with a different invitation, rather than resetting the completed room.
- A brief offline/online transition followed by reload restored the completed case. This is not a long network-outage or reconnect load test.
- An unavailable microphone produced an error while leaving gameplay usable. Explicit permission-denial testing is tracked separately below.

## Real sponsor loop

With explicit approval and unchanged credentials/caps:

- Firecrawl extracted the two fixed NASA pages at 02:37:42–43 UTC. Both matching dates appeared with extraction fingerprints and timestamps.
- One OpenAI reflection through the existing gateway appeared in the completed case. AI commentary stayed distinct from the authored ending. Its wording is not proof of factual accuracy or narrative quality.
- A recipient-verification email arrived in the authorized Gmail inbox at 02:37:55 UTC. The code was consumed through the app; no password-recovery enrollment was needed.
- The separately consented debrief arrived at 02:38:56 UTC with Preserve and 85/100. Two emails total; no resend or top-up.

## Local regression checks

The build passed. Twenty-eight engine/narrative tests and sixty-three Convex tests passed after the source-pack and shared-budget work. Provider tests use local fixtures and make no external calls. They cover ten failed source jobs, forty failed AI jobs, the shared ten-email verification/debrief limit, single-use recipient verification, member isolation, late AI suppression, known wrong factual output, spoiler-shaped output, source validation, duplicate debrief requests and a generated pack whose answer is recomputed by the server and absent from public projections.

The development case compiler was also exercised against the existing fresh Firecrawl receipt. Its first live AI draft was rejected before publication because the development deployment still had an overly strict receipt comparison. The failed attempt counted against the shared AI budget. The comparison was corrected and deployed; no second provider call was made without fresh approval. Fixture coverage proves the corrected publication path, but a successful live generated pack remains pending.

The output filter is a narrow check, not a general factual or prompt-injection guarantee. A model can infer information from shared clues. Deterministic validation and the authored tape remain authoritative. Rejected or unavailable AI does not replace the game rules.

## Remaining gates

- Three real-pair blind trials: pending, by agreement. Use PLAYTEST-PROTOCOL.md; do not count the automated pair as a trial.
- Full timed expiry browser case: passed; the room reached 00:00, closed, and remained closed after reload.
- Explicit denied-microphone browser case: passed without blocking text play.
- Responsive visual checks: passed at 360, 390, 768 and 1440 pixels for solo practice; the transformed multiplayer desk was additionally inspected at 390 and 1440 pixels.
- Impeccable visual audit: clean after replacing the remaining partial-border tabs and widening the active investigation into a readable two-column workspace. The final demo uses only shared-room states; private invitations, private projections and solution entry stay off camera.
- New narrated demo: complete at 152.86 seconds, 1920×1080, 30 fps, H.264/AAC. The audio has no detected silence longer than 1.5 seconds at −40 dB. Local file: `../videos/offscript-evidence-2026-09-20/OFFSCRIPT-demo-2026-09-20.mp4`.
- Production deployment: complete. Convex backend `flexible-kiwi-480` accepted the new indexes without deleting any; static deployment `25dec9c5-4150-44ad-ad30-912628c4faa7` published assets `index-ChV7xBzv.js` and `index-CG_UDNFw.css`. The public root returned HTTP 200 and the source-backed library, solo-practice action and expanded landing layout appeared in a fresh Comet check.
- Public Vibe Apps entry: https://vibeapps.dev/s/offscript returned HTTP 200 on September 20. The owner form still shows the existing public entry.
- Public Drive demo replacement: complete. The existing submission file ID was preserved, its bytes were replaced at 05:10:15 UTC, and Drive metadata readback reports a 7,986,808-byte MP4 with an `anyone` reader permission. The public URL is https://drive.google.com/file/d/1oCSR-ZezcXE7-KGd8ocpVDYaNc-yos20/view.
- Vibe Apps description refresh: not saved. Two owner-form attempts returned a server error from `stories:updateOwnStory`, including one with the original six tags restored. The public entry and unchanged video URL remain valid because the video file was replaced in place. This is recorded as a platform-side edit blocker, not as a successful metadata update.
