# OFFSCRIPT product brief

Approved September 8, 2026; reconciled with the shipped build September 9. Separate from RentPilot.

## Experience

A cooperative browser mystery for two people. An archivist and a signal operator receive different clues, solve three challenges and agree on the fate of a recovered recording. New rooms offer an eight-minute signal window or untimed practice. Both players must share evidence at every stage.

The Last Transmission combines a historical Voyager launch comparison, a room-specific cipher and a relay cross-check. Successful solutions reveal server-authored testimony. Broadcasting the fictional tape exposes wrongdoing and a witness's identity; preserving it protects the witness while leaving the public record wrong. Neither ending earns extra points. NASA launch facts are sourced; the station, characters and events are fiction, without NASA endorsement.

## Shipped workflow

Create a room → invite a partner → both ready up → share private clues → solve three challenges → reach consensus → optionally request an email debrief. Source checks and AI advice are optional during play. They do not unlock puzzles or pause the timer.

Guests can save their account with a password, keep a public player ID, add friends by mutual consent and resume saved cases. Recovery requires a previously verified private email address. Opt-in two-person WebRTC voice includes mute, speaking indicators and leave/rejoin. It uses STUN without TURN: restrictive networks may fail. Audio is neither recorded nor sent to AI.

Players can also compare clues in private team text chat. The latest 100 messages persist with their room; only its two joined players can read or send them. Team chat works without microphone permission and stays separate from the AI character and email debriefs.

## Sponsor responsibilities

| Technology | Actual work |
| --- | --- |
| Convex | Authenticated identity, private role views, transactional puzzle state, reactive multiplayer, presence, deadlines, friends, WebRTC signaling and frontend hosting. Original Convex Auth package, not Auth v2. |
| OpenAI | Mara's room-local dialogue, stage nudges and ending reflections through Convex Agent and a pinned OpenAI model via Vercel AI Gateway. Shared context only; no authority over puzzle truth or outcomes. |
| Firecrawl | Checks two fixed NASA Voyager pages and pins validated historical evidence with source receipts per case. |
| AgentMail | Account verification, password recovery and an explicitly requested post-ending debrief to the player's verified address. No inbound email unlock. |
| Codex | Implementation, debugging and verification; not the in-game character model. |

Source checks allow two attempts per case and ten per deployment daily window. AI allows six attempts per case and forty per daily window. Debriefs allow one per player/case and ten per daily window. Failed attempts count. No provider fallback or invented success receipts. See README.md for timeouts and setup.

## Boundaries and open work

The original proposal included an inbound character email that unlocked the ending. That was not shipped. New cases use deterministic puzzle validation; legacy rooms retain their old unavailable gate and should be replaced with a fresh room.

No public rankings, twenty-seat rooms, generated puzzle answers, voice cloning, arbitrary URL scraping, real-world investigations or unsolicited email. Core play remains usable when optional providers fail, with explicit failure states.

Automated tests and two-browser checks establish rule behavior, not enjoyment. A human pair still needs to play without builder guidance. Cross-network voice quality, a fresh full provider recording and submission materials remain separate gates. Launch planning and the working submission checklist are local-only.

The intended distinction is a short cooperative mystery with asymmetric evidence and a shared consequential ending. No claim of universal originality, proven replay appeal or guaranteed placement.
