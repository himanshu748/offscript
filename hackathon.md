# OFFSCRIPT — Convex All Gas build log

## September 12, 2026 — play together without a microphone

Added room-private team text chat. Only the two joined identities can read or write, roles come from the server, duplicate retries reuse their message, and the latest 100 messages stay with the room. Each message allows 500 characters, with an independent per-sender burst limit. A compact drawer shows unread partner messages and keeps unsent text during a connection interruption. Team conversation is separate from Mara and never enters model prompts or debrief emails. Optional voice now follows the core clue workspace instead of appearing before it.

Verification: 27 engine/narrative tests and 51 backend tests passed (78 total); TypeScript and the Vite build passed. The first concurrent backend run hit only five-second test timeouts across old and new suites; rerunning with one worker and a 30-second test timeout passed every assertion. Development deployment quick-wren-892 accepted the two chat indexes and functions. Two isolated browser identities exchanged real messages in both directions, saw unread badges, and restored both messages after reloading. The 390×844 chat screenshot was visually checked. An extra puzzle-form check stopped at an existing Mission selector timeout; it is not recorded as a fresh full-case playthrough. No sponsor calls, third-party messages or production deployment occurred during these checks.

## Previous status — September 9, 2026

Public source release verified: https://github.com/himanshu748/offscript, main branch, initial commit 8a4575b. GitHub reports PUBLIC and the remote tree contains app source and this build log, without launch scripts, storyboards, recordings or environment secrets. The staged secret scan flagged only two explicit dummy keys in mocked recovery tests; no other known-pattern findings or omitted files. This check does not cover unknown credential formats.

Fresh audit checks: 27 engine/narrative tests and 46 backend tests passed (73 total); TypeScript/Vite build passed; public root returned HTTP 200. These checks did not repeat production gameplay or provider delivery. Documentation changes are local and no deployment or social publication occurred in this audit.

Live app: https://flexible-kiwi-480.convex.site/. New cases have three deterministic cooperative puzzles, earned testimony, consensus endings, saved accounts and recovery, friends, optional source checks, AI guidance, outbound debriefs and opt-in WebRTC voice. Voice uses STUN without TURN and is not guaranteed across restrictive networks. No inbound email unlock is shipped for new cases.

The entries below are historical snapshots. Earlier unconnected integrations, missing features, test totals and remaining-work lists describe those stages, not the current build. README.md describes current public scope. The working submission checklist and all launch-production materials stay local.

Documentation audit: rewrote PRODUCT.md to remove planned inbound-email behavior from current requirements; replaced the stock Convex README with the real module map; aligned local auth origin, design guidance and the rules checklist. At the time of that audit no public repository, OFFSCRIPT launch video or submission receipt was established.

Source-publication preparation: initialized main at the user's request. Excluded launch copy, scripts, storyboards, recordings, video projects, browser artifacts, environment files and the local submission checklist. The build log remains public as required by the hackathon; it contains development history, not the launch script.

## September 8, 2026

- User approved the cooperative inbox-mystery direction after reviewing other candidate ideas and current entries.
- Created a separate project directory; no RentPilot code, data, credentials or deployment changed.
- Recorded scope, competition boundaries, sponsor responsibilities, demonstration plan and test gates in PRODUCT.md.
- Chose a fictional listening-station case supported by manually reviewed NASA Voyager launch dates.
- Implemented a deterministic server-only rules kernel: role-specific clue projections, shared discoveries, solution validation, a pending character-reply boundary, idempotent operations and two consensus endings.
- All 16 local fixture tests passed using `npm test` on Node.js 22.14.0. These do not exercise Convex, Firecrawl, OpenAI, AgentMail or browser multiplayer.

### First playable chapter

- Created a separate cloud development project `offscript`, deployment `quick-wren-892`, using the existing Convex account. Configured guest authentication with Convex Auth; signing keys remain on the backend.
- Implemented Vite/React listening-station UI directly in code, with responsive private/shared desks, source documents, invitations, reduced-motion support and an explicit unconnected email gate.
- Implemented authenticated room creation/joining and private projections. Identity comes from the backend auth session, not a client-supplied owner ID. No public character-acknowledgement endpoint was added.
- `npm run build`, 16 engine tests and 6 Convex adapter tests passed. Production browser bundle inspection found neither private clue text nor the launch-date solution.
- Two isolated Chromium browser sessions against real cloud functions successfully created/joined a case, received different initial clues, shared them live, rejected an incorrect solution, recovered the correct dispatch and retained progress after reload. No provider calls or email were involved.
- QA covered desktop 1440 px, mobile 390 px, overflow, reduced motion and keyboard skip-link entry. A second-room navigation check found that hash-only invitations needed a listener; that bug was fixed and the existing operator successfully rejoined via same-document navigation. Original test locator for the wrong-answer record was too exact because the record includes a revision number; the corrected check confirmed the rejection text. The final guest browser console contained zero errors or warnings; the initial host favicon 404 was fixed with an authored SVG favicon.
- Impeccable's specialized agent roles were unavailable, so independent generic reviewer/documenter agents substituted. The reviewer requested softened shadows and removal of instructional eyebrows, then scored both fixes resolved (`ship` at the fix-list scope). Missing QUALITY BAR card limits the ceiling assessment; the detector ran in degraded regex mode, not a complete contrast audit.

## UI refinement, September 8

- Reworked the landing around the existing cooperative hook, an above-fold mobile room action and an interactive two-role preview. Preview descriptions are not case clues; historical evidence and the solution remain server-owned.
- Added a server-state-driven case-progress strip, larger shared-clue text, an expandable copy of the player's own shared clue and immediate dispatch feedback. Refined mobile fields and keyboard/touch targets.
- Preserved the listening-station palette and fonts using Impeccable's refinement guidance. No generated decoration or provider-success simulation was added.
- Browser QA: 390/768/1440 px without horizontal overflow; role switching, reduced motion, native clue disclosure, mobile CTA visibility, cloud room creation/joining/sharing and inline wrong-answer feedback verified. Console showed zero errors/warnings in the active QA session. Build and all 22 existing tests pass. The design detector reported palette/type documentation advisories; this was not a clean full-design audit.

## Remaining delivery work

### September 8: cooperative challenge extension

- Extended new rooms to three server-validated challenges: historical dispatch, room-specific rotating cipher, and altered relay cross-check. Each stage requires both role contributions and rejects stale-stage actions. Generated answers and seeds stay server-side.
- Added scored hints, mistakes, fresh-room replay and a puzzle-earned consensus ending. Old rooms keep their email gate. No provider acknowledgement is invented; AgentMail, AI dialogue and Firecrawl are still unfinished.
- Added the official Convex Presence component, with server-derived roles and room membership on heartbeat/read. Reused Convex's existing WebSocket transport. Presence is a connection signal, not proof of attention.
- Verification: build/typecheck and 28 tests pass, including solvability checks over 100 generated variants and presence authorization/disconnect. Cloud functions and component pushed to the existing development deployment.
- Two isolated browser identities completed all three stages through the UI, observed immediate shared score/hint changes, rejected a wrong answer, held conflicting ending votes open, agreed on broadcast, restored the ending after reload, observed actual WebSocket frames, saw partner departure and created a replay invitation. Desktop/mobile screenshots inspected; 390 px had no horizontal overflow.
- Browser completion exposed a pre-existing duplicate React key when two journal records share a revision. Fixed the rendering key; fresh completion reload and replay check had no console errors. One earlier QA selector timeout was a locator mismatch, not a game failure.

### Still outstanding

### September 8: timed play and production hosting

- Added optional Signal window mode (default for new UI-created rooms). Both roles must ready up before private evidence opens. An eight-minute deadline covers puzzles and ending consensus; practice and existing rooms remain untimed.
- Deadline is server-owned, checked during every gameplay action and enforced by a scheduled internal mutation even when both users leave. Completed endings freeze the clock; expired attempts preserve evidence but cannot continue. Client countdown uses a server-time anchor and monotonic elapsed time, with a final-minute visual state and no flashing or autoplay sound.
- 32 tests pass (23 engine, 9 adapter), including deadline boundaries and real scheduler execution under a fake clock. These timer tests are not a claim of an eight-minute human playtest.
- Configured production Convex Auth on `flexible-kiwi-480` and published the frontend at https://flexible-kiwi-480.convex.site/. Kept root auth routes intact and hosted only the compiled static assets. Production and development rooms are separate.
- Public homepage and auth discovery return HTTP 200. Fresh public guest sessions created a hosted invitation, joined from separate browser contexts, readied both roles, saw the countdown and shared clues. Mobile timer layout was inspected at 390 px without overflow. A transient development network error recovered; production auth and room creation were tested independently.
- The production two-browser playthrough completed all three timed challenges and the preserve ending. Both clocks froze at 03:39 remaining, with no console/page errors during the final solve and consensus check. Historical pre-deployment 404 checks are not counted as runtime failures after hosting.
- A separate cloud-development attempt was allowed to expire naturally for eight minutes. Both screens showed 00:00 and “The window closed,” with clue sharing disabled, without any player action to trigger expiry. Production completion screenshot inspection also prompted a small contrast fix for replay explanatory text.
- Git-scoped secret scan was unavailable because this project has no Git repository. Narrow built-file checks found no known credential shapes, private puzzle text, environment files or source maps; this is not a full repository/history scan.

### Remaining after hosting

### September 8: player identity and friends

- Added server-issued public player IDs and display names, separate from auth IDs and credentials. Names and IDs appear beside the two roles in the room roster. Existing guest sessions acquire a profile without replacing their identity or room.
- Added exact-ID friend requests, recipient-only acceptance, decline/cancel/remove and a combined 50-contact cap. Queries are indexed and bounded; no public directory, email exposure or global presence feed was introduced.
- Accepted friends can invite each other through the app. The room reserves its operator seat for the invited identity, checks friendship again at join, and no longer accepts that invitation after the friendship is removed. Ordinary share-link rooms continue to work.
- Build/typecheck and all 39 tests pass (23 engine, 16 adapter). Added checks for profile stability, non-Latin names, friend consent and isolation, reserved invitations, and independently attributed moves across twenty authenticated identities in ten rooms. This is an adapter concurrency/isolation test, not a twenty-browser load benchmark.
- Two isolated browsers against the cloud development backend created IDs, changed names, requested/accepted friendship, sent/joined a reserved invitation, readied up and shared clues. A reload retained the same ID and friend. Desktop/mobile panel screenshots inspected, with no horizontal overflow at 390 px.
- Guest profiles remain browser-bound; cross-device login and recovery are not implemented. Built-in voice is not implemented. The interface now explicitly asks players to use a separate call and states that it does not access the microphone or record audio.
- Published the updated frontend and backend on the existing Convex production deployment. Static hosting replaced the previous compiled asset set; source files remain in the workspace.
- Fresh production browser identities also completed ID creation, friend request/acceptance, reserved invitation/join, readiness and clue sharing. Both rosters attributed the same two IDs to the correct roles, the countdown ran, 390 px had no horizontal overflow, and the production browser console reported zero errors/warnings. This was a social-flow smoke test, not a repeat of the full three-puzzle playthrough.

### Remaining after player identity

### September 8: persistent player accounts

- Added player-ID/password sign-in using the installed Convex Auth credentials provider and account/session APIs. Guest enrollment verifies the current live session and exact profile ownership before account creation, then keeps the existing user ID. No friendship, room, progress or public player ID is migrated to a different owner.
- Added save-account/sign-in/sign-out forms, explicit confirmation before switching accounts, and an authenticated list of the eight most recent hosted/joined cases. Passwords are handled through form submission, not persisted in application state/localStorage; hashes remain in private auth account records. The Scrypt helper matches the existing installed Convex Auth password implementation.
- 44 tests pass (23 engine, 21 backend), including real auth actions under ephemeral test signing keys, password hash verification, ownership-preserving linking, new-session restoration, wrong-password rejection/failed-attempt accounting, no cross-account merging and refusal to enroll from revoked sessions.
- Browser QA against the cloud development deployment preserved a guest's friend and shared-clue progress while saving the account, restored the same player from a separate browser context, opened the original case from the saved-cases list, and retained it after reload. Mobile width 390 px had no horizontal overflow.
- Browser testing caught a saved account still labeled guest during session rotation. Status display now queries credentials for the authenticated user; credential enrollment retains its separate live-session check. Earlier runner failures (missing runner `crypto`, nonpersistent runner globals) were test orchestration issues; test credentials were never printed or written to files, and the final proof ran in one bounded script.
- The first production save exposed a session-rotation race: replacing the guest session could race the client's live auth state. Saving credentials now retains the existing verified session for the same user; signing into another account still uses the normal new-session path. Added an explicit regression assertion that saving preserves the verified session ID.
- Final production check passed after that fix: save an existing player with a friend and shared clues, sign in from a fresh browser context, restore the same ID/friend/case, and sign out/back in. The resumed case retained its deadline (07:03 remaining in the final check); a read-only readiness check waited for server-clock synchronization before declaring the solve controls available. No page/console errors were observed in the fresh production contexts and 390 px had no horizontal overflow. This is not a physical-device test or a new full-case solve.
- Email/forgotten-password recovery remains unconfigured. The UI requires a 12–128-character password and tells users to store both ID and password in a password manager. Public ID alone cannot restore access. Unsaved guests remain browser-bound; signed-in accounts can be restored on another device.

### Remaining after accounts

- Playtest clue quality with two people.
- Integrate and independently verify all sponsor services.
- Expand real-world privacy/reconnect/concurrency coverage; test delivery failures and real opt-in email.
- Create a public repository.
- Record the under-three-minute live demo; prepare required social and Vibe Apps submission.

The frontend and production backend are public on Convex. No emails sent, public submission made or win claimed. RentPilot remains unchanged.

## September 8: verified-email account recovery and rules audit

- Added private recovery-email enrollment for saved players. Attaching/changing an email requires the current password and a live owner session; the new address is not active until its emailed code is verified.
- Added forgotten-password requests and reset-code forms. Codes have 122 bits of random entropy, expire after 15 minutes, are stored as SHA-256 digests, and are consumed atomically once. New codes replace older ones. Verification of an email change invalidates prior reset codes, and recovery cancels pending email changes.
- Password modification and session invalidation use Convex Auth. Application queries/mutations also reject pre-recovery sessions, rather than waiting for an old JWT to expire. Player ID, friendships, rooms, and case progress retain their original owner.
- Added the official Convex Rate Limiter component for account/recipient/global email budgets and per-player attempts. Unknown or mismatched reset requests receive the same response; missing mail configuration and verification-send failures are reported honestly.
- AgentMail's separate-inbox creation was refused by the account's three-inbox limit. The user approved reusing the existing sender with OFFSCRIPT-specific subjects. Configured the existing key and sender only on OFFSCRIPT dev/prod; no key was printed or written to disk, no existing inbox was deleted, and no paid plan was activated. RentPilot's configuration was not changed.
- Local verification: build/typecheck and 52 tests pass (23 engine, 29 backend, including eight new recovery tests with mocked email transport). Production dependency audit reports zero advisories; this is not a comprehensive security audit. Narrow production bundle checks found no signing/API-key identifiers, development URL, or private puzzle strings.
- Real cloud-development and production recovery checks each received a verification email and a reset email in a controlled recipient inbox, verified the address, reset the password, retained the same ID/friend/case/clue progress, and rejected old passwords, old sessions, and reused codes. A sender-only mailbox copy was not counted as receipt; receipt was independently read from the controlled recipient through the connected AgentMail account.
- Browser testing caught a React-auth integration issue: using the login helper for an email-only action would clear the current token on a null-token response. Email send/verify now use the action directly; only reset completion uses the login helper. The browser confirmed saving the player, sending a real verification email, verifying its code, and keeping the saved session.
- The deployed production UI then requested another real reset email, accepted its code and a new password, restored the original player and friend, and reopened the original case with its shared clue. That browser check observed zero page errors. Mobile recovery forms and restored-account screenshots were inspected at 390 px; these are isolated-browser tests, not physical-device or Gmail-deliverability certification.
- Deployed backend and static frontend at https://flexible-kiwi-480.convex.site/. Frontend deployment: `dd84823d-9c07-4f2b-a4e4-05a94461869f`. Hosting replaced the previous compiled asset set; source remains local.
- Rechecked https://www.convex.dev/hackathons/all-gas and recorded requirements/evidence in `SUBMISSION-CHECKLIST.md`. Multiple entries are allowed. The public repo, under-three-minute demo, tagged social post and OFFSCRIPT Vibe Apps entry remain missing. Firecrawl and OpenAI gameplay are still unconnected; recovery email does not stand in for the planned character inbox loop.

The earlier "no emails sent" status describes the previous build. Recovery now sends real account emails. No OFFSCRIPT submission or win is claimed.

## September 8: bounded source checks, AI archivist and opt-in debrief

- With explicit permission, reused RentPilot's existing Firecrawl and AI Gateway credentials only in OFFSCRIPT's development and production environment. Pinned the same `openai/gpt-4o-mini` model and allowed only the OpenAI provider. No paid upgrade, new sender inbox, model fallback, or RentPilot configuration change.
- Added the official Firecrawl, Convex Agent and AgentMail components. AgentMail 0.1.0 needs a version-pinned environment-declaration patch; `postinstall` applies it. API keys never enter frontend variables or mutation arguments.
- Added an optional station panel in the existing visual system: check two fixed NASA URLs, see dated short citations and extraction fingerprints, consult a clearly fictional AI archivist after both players share their clues, and opt into one debrief to the player's own verified email after a completed ending. No generated decorative imagery was needed.
- Source receipts become immutable once both dates are confirmed; a failed/changed extraction does not replace puzzle facts. Maximum two check attempts per room and ten checks per deployment/day. Each check scrapes two pages; the Firecrawl component may retry transient transport failures on the same provider.
- AI uses room-local Agent threads, no tools, no cross-thread search, at most six attempts per case, forty per deployment/day, 500-character questions, a 220-token response cap, 45-second timeout and no SDK retries. Only public shared clues and accepted conversation enter context. Private answers, seeds, credentials and addresses do not.
- The first real development check extracted both NASA dates, produced an OpenAI reply, completed the deterministic case, and delivered a debrief to the controlled sample-source inbox. A duplicate send returned the existing result; the other player saw no recipient delivery status. Production independently received a controlled debrief too. Sent queue state was not treated as proof of receipt: the recipient inbox was read separately through the authorized AgentMail connector.
- **Failure caught during live QA:** the first production AI reply reversed the launch order despite having correct evidence. Mara was restricted to reasoning guidance without historical names/dates, with a narrow output screen. Replies remain in private component storage until an accepted message ID is published. Withheld/older unreviewed replies do not reach the public query, future conversation context or debrief. This is not a general fact checker; AI guidance may still be wrong.
- **Regression caught and fixed:** setting Agent history to zero also omitted `promptMessageId`, causing an empty-prompt error. The worker now retrieves exactly the current prompt, with only accepted prior dialogue supplied separately. Two full-worker tests with a fixture model cover prompt inclusion, excluded old responses, publication and withholding. No replacement provider was called during failures.
- Final automated checks: **64 passing tests** (23 engine, 41 backend), clean TypeScript, successful production frontend build. The twelve service tests do not call real providers. Production dependency audit reported zero advisories; narrow bundle checks found no API-key variable names, private puzzle strings or development URL. This is not a complete security or load audit.
- Final live production case `jx7btzx67d36tp73cvmftfc1n58e1mn8` confirmed both NASA dates through Firecrawl and received an accepted reasoning-only OpenAI response. It completed all three deterministic challenges and the preserve ending. A subsequent fresh-address verification step hit the existing recovery-email rate limit, confirmed from the matching production request log. Limits were not relaxed or bypassed. That later run is not counted as another successful email round trip; earlier development and production debrief receipts remain separate evidence.
- Two isolated development browsers verified sealed controls before both contributions, then live shared source receipts and AI dialogue. Desktop and 390-pixel mobile screenshots were inspected, with reduced-motion emulation and no horizontal overflow. Fixed a misleading timer label in practice mode and added follow-latest behavior plus an explicit latest-message button. Final browser consoles had zero errors/warnings; no physical-device or independent human-fun test is claimed.
- Backend deployed to `flexible-kiwi-480`; latest frontend deployment is `70590344-b56d-4497-91eb-1a953a07b658`, assets `index-E6He2ipk.js` / `index-TcEor8pw.css`. Public homepage and fresh production browser load verified. Hosting replaced only old compiled asset files; source remains local.
- Scope remains explicit: the debrief is outbound email, not the original inbound-character-reply puzzle gate. The timer and ending are deterministic and do not wait for a provider. Public repository, independent playtest, video, social post and OFFSCRIPT submission remain unfinished.

## 2026-09-09 — Earned testimony and ending consequences

- Added a server-projected fictional tape: each solved stage reveals one passage, including Mara’s conflicting motives and the witness’s recorded request. Future passages never enter player responses or AI context. Generated character commentary remains separate from canonical testimony; prompt guidance is not a general guarantee against hallucination.
- Both consensus endings now explain their cost. Neither choice changes the score. The optional AgentMail debrief includes the same authored consequence as the game; no inbound mail workflow was added.
- Impeccable guided a single dark transcript panel within the existing listening-station design, a short progress-triggered reveal, readable earlier passages and state-specific next steps. No imagery or animation dependencies added.
- Verified 68 tests (27 engine/narrative, 41 backend), TypeScript and build. Two isolated browsers completed all three puzzles using visible clues, reached the preserve ending and retained it after reload. Desktop and 390px mobile inspected, no horizontal overflow, reduced-motion reveal disabled, zero console errors. Both endings are covered by automated tests; this is not an independent human playtest.
- This pass did not send another email or consume a live AI/source request. Earlier provider receipts above remain distinct evidence; the changed debrief body is not claimed as newly received.
- Production backend deployed and frontend published as `5b40de2d-1459-4f38-990a-e49203313a2d`, with assets `index-DF17-FX2.js` and `index-beTtKIOb.css`. Hosting removed the previous compiled storage assets; local source remains intact.

## 2026-09-09 — Opt-in voice and guided AI

- Added two-person WebRTC audio with explicit microphone consent, mute/unmute, local speaking meters, playback-permission recovery, leave/rejoin and visible disconnect states. Audio is neither recorded nor sent to AI. Authenticated Convex signaling derives the role from room membership, limits each seat to one active client, bounds SDP to audio-only metadata, and rejects stale sessions. Heartbeat expiry clears abandoned signaling; call starts are capped at eight per minute per room seat and calls last at most thirty minutes.
- Direct calling uses Cloudflare STUN. No TURN account, paid plan or credential was provisioned. Restrictive networks may not connect, and the UI explains this before joining, along with peer network-address exposure. Same-machine synthetic-microphone QA is not evidence of mobile/corporate-network reliability or physical-device audio quality.
- Added server-constructed stage-nudge and post-ending-reflection prompts using shared evidence, earned testimony, team progress and the saved outcome. Both share the existing six-turn case / forty-turn daily budget. No automatic calls, fallback model, audio transcription or scored-hint changes.
- First live nudge was withheld by the existing historical-fact output check. Removed literal mission names/dates from that stage’s AI context while retaining cited facts in the player UI. A second explicit live attempt returned a visible reasoning-only nudge. The output filter remains narrow, not a general fact checker. The reflection phase gate is tested; a new live reflection is not claimed here.
- QA found and fixed duplicate React sibling keys for voice/services. After reload, the two-browser test connected and exchanged inbound and outbound audio RTP packets, mute disabled the local track and appeared to the other player, leave stopped capture and closed the peer, rejoin connected again, and navigating home stopped both tracks from the test. Inspected desktop and 390px mobile with no horizontal overflow; no new console errors after the fix/reload.
- Automated checks: 73 tests (27 engine/narrative, 46 backend), TypeScript and build pass. Voice tests cover membership, explicit peer joins, tab takeover, bounded descriptions, stale requests, mute, leave and expiration without changing game state. No emails were sent during this feature pass.
- Published backend and frontend deployment `5535e8c7-2567-4775-acf3-c979da36d92e` (`index-DFIpMLpH.js`, `index-8cef9JVa.css`). Public HTML serves the new assets. Two fresh production identities joined a room and established WebRTC audio, with an active remote audio stream observed. Test microphones were synthetic; no human microphone or recording was used. Hosting replaced the previous sixteen compiled storage files; local source remains intact.
