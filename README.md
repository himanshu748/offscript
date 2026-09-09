# OFFSCRIPT

A two-player browser mystery with private clues, live shared discoveries and a joint ending.

Play: **[OFFSCRIPT](https://flexible-kiwi-480.convex.site/)** — frontend and production backend hosted on Convex.

Source: [himanshu748/offscript](https://github.com/himanshu748/offscript), published on the main branch. Launch drafts, storyboards and recordings are excluded.

New rooms contain a three-challenge cooperative case. Recover the dispatch, decode a room-specific cipher, cross-check altered relay logs, then agree on one of two endings. Optional Firecrawl source checks and an OpenAI character conversation work alongside the deterministic puzzles. An opt-in AgentMail debrief follows the ending; inbound email does not unlock gameplay. This is not a completed hackathon submission.

## Realtime and replay

New rooms default to **Signal window**: both players ready up before evidence opens, then share an eight-minute server-enforced deadline. Finish all three challenges and agree on an ending before it closes. A scheduled mutation ends idle attempts; every gameplay mutation independently checks the deadline. Reloads, device-clock changes and disconnects cannot extend it. The visible counter is an estimate anchored to server time; the server decides whether an action was on time. No forced flashing or sound is used. Practice mode is untimed, and existing rooms are not retroactively timed.

Convex subscriptions use WebSockets; there is no separate Socket.IO server or polling game-state API. The Presence component tracks each role's connection, with membership enforced on heartbeat and reads. Abrupt disconnections can take about 25 seconds to appear; a hidden browser tab can show as away. Presence does not gate puzzle actions or claim the person is actively reading.

Every stage requires both players to share their own evidence. Room-specific ciphers and relay logs support replay; the historical dispatch warm-up and puzzle mechanics remain the same. Hints cost 10 team points and wrong answers cost 5, with a floor of zero. The score is a local team challenge, not a ranked leaderboard. A fresh case creates a new invitation and retains the five-room daily guest limit.

The three-challenge ending is earned through puzzle validation, not an email acknowledgement. Legacy rooms keep the original unconnected email gate. No migration fabricates a provider reply. Return home and open a new room to play the extended case.

## The recovered tape

Each solved challenge reveals another server-authored passage of Mara’s testimony. Earlier passages stay readable, and unrecovered text is excluded from both player responses and AI context. The two consensus endings have different consequences for public accountability and the witness’s privacy; neither earns extra points. These are fictional narrative consequences, not real-world publication actions. The optional email debrief includes the same recorded outcome as the game. AI commentary is labeled separately and is not canonical testimony.


## Player IDs, friends and voice

Open **Players & friends** to get a server-issued public player ID, set a display name and add someone by their exact ID. Requests require the recipient’s acceptance; either person can remove the friendship. Accepted friends can send an in-app room invitation that reserves the operator’s seat for that friend. A forwarded invitation cannot claim that seat from a different account. Removing a friendship withdraws its unclaimed invitations. Pending requests and accepted friends share a 50-contact limit.

The room roster shows names and public IDs beside the archivist/operator roles. Public IDs are not credentials: actions still derive their author from the authenticated backend session, check room membership, and only then update that room. The game supports two players per room. Twenty players means ten independent rooms, not a twenty-seat case.

Guests can choose **Players & friends → Save my account** and set a password. This attaches credentials to the existing authenticated user: it does not copy the player or change its public ID, friends or room ownership. Sign in with that ID and password on another device, then choose a room from **Your saved cases**. Switching to a different existing account does not merge the current guest’s data and requires confirmation in the UI.

Guest access still depends on browser storage until the account is saved. Passwords must be 12–128 characters and are hashed server-side with the same Scrypt implementation used by the installed Convex Auth password provider; account/session storage and failed-login throttling use Convex Auth. There is no public player directory or global online-status feed.

### Forgotten-password recovery

After saving your account, choose **Add recovery email**, confirm your current password, and paste the verification code sent through AgentMail. The address stays private. Recovery is not enabled until you verify it. Existing accounts need to add an address while they can still sign in; neither a public ID nor an unverified address can recover a lost account.

Choose **Forgot password?** and enter the player ID and verified email. Paste the newest reset code and choose a new password. Codes expire in 15 minutes and work once. Resetting keeps the player ID, friends, rooms and progress, while revoking other sessions. Codes are stored only as SHA-256 digests, never in URLs; account/recipient/global send limits and per-player attempt limits use the Convex Rate Limiter component. A new email does not replace the old one until verified. Reset-request responses do not reveal whether another player's email matched.

Configure `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` on each Convex deployment, with `SITE_URL` pointing to its frontend. Never put the API key in a `VITE_` variable. Delivery is visibly unavailable when these settings are absent. The current sender is shared with the owner's existing project, with explicit permission and OFFSCRIPT-specific subjects; no inbox was deleted and no paid plan was enabled.

Recovery was independently tested against both cloud development and production with two genuinely received emails per deployment in a controlled inbox. Verification, reset, preserved friend/case data, rejected old credentials/session, and rejected code reuse passed. The eight additional local recovery tests mock only the email transport; they also cover expiry, changing addresses, privacy, limits and failure handling. Browser verification is recorded in `hackathon.md`.

**Optional two-person voice:** both players explicitly choose Join voice and grant microphone permission. WebRTC carries audio directly; Convex handles authenticated room-private offer/answer signaling, mute state and expiring call sessions. There is no recording, transcription or audio sent to an AI model. Mute, leave, speaking indicators and connection-error states are available. Calls stop after 30 minutes; signaling expires after a minute without heartbeats. Peer-to-peer calling can expose a network address to the other participant; invite someone you trust.

Voice currently uses Cloudflare’s free STUN service, **not a TURN relay**. Some mobile, corporate and restrictive NAT networks will not connect; the UI states this limitation and does not claim universal calling. No paid account or relay plan was enabled. Browser tests with synthetic microphones are not physical-device or cross-network audio-quality tests.

Mara also has explicit stage-nudge and ending-reflection actions. The server constructs the prompts from the current shared evidence, recovered testimony, score and ending; it rejects a reflection before consensus. These consume the existing six-turn case / forty-turn daily AI budget. No background model calls, new model fallback, or voice transcription were added. AI nudges are unscored advice, distinct from the deterministic scored hint.

The social flow was checked on the deployed site with two fresh browser identities: create IDs, request/accept friendship, invite/join a reserved room, ready up and share clues under the correct roles. A separate development-browser reload retained the player ID and friend list.

Account persistence was also checked on the production site after the session-enrollment fix: save the current player, sign in from an isolated browser, restore the same friend and shared-clue case, then sign out and back in. The timed case retained its running deadline. These are isolated-browser checks, not a physical-device or password-recovery test.

## Run the app

Requires Node.js 22.12+ and a Convex account. Configure `FIRECRAWL_API_KEY` and `AGENTMAIL_API_KEY` as server-side Convex environment variables before the first component push. Set `AGENTMAIL_INBOX_ID`, `AI_GATEWAY_API_KEY` and `SITE_URL` on each deployment too. The AI model is pinned to `openai/gpt-4o-mini`, with only the OpenAI provider allowed through Vercel AI Gateway. Existing accounts and credits are required; this app does not grant free quota or switch providers when quota runs out.

`npm ci` applies a small version-pinned patch to AgentMail's component configuration so its declared environment can receive the server-side key. This changes environment declarations, not authentication or email verification. See `patches/@agentmail+convex+0.1.0.patch`.

```sh
npm ci
npx convex dev --configure new --dev-deployment cloud
```

For a new deployment, configure Convex Auth in a separate terminal, then restart the Convex development command:

```sh
npx @convex-dev/auth --skip-git-check --web-server-url http://127.0.0.1:5187
npm run dev
```

The Vite frontend runs at `http://127.0.0.1:5187`. Its URL is configured by `VITE_CONVEX_URL` in ignored `.env.local`; backend signing keys stay in Convex. The guest provider in `convex/auth.ts` is already configured. Do not replace it with an empty provider list.

Open a private room in one browser, then open its invitation in another browser or isolated browser profile. Ordinary tabs in the same profile share the guest identity and cannot occupy both seats. Use the public site for friends on another device. Localhost invitations only work on your own machine. Development rooms and identities are separate from production; create a new room on the public site rather than modifying an old localhost invitation.

## Publish updates

`npm run deploy` builds against the production backend and uploads only `dist/`. Convex Auth must be configured on production separately from development, with `SITE_URL` matching the hosted origin. Auth routes remain at their existing root paths; static hosting is registered after them. Never upload the repository or environment files as frontend assets.

Unsaved guest access persists only in this browser. Save the account before clearing site storage to enable cross-device login with a player ID and password. Room creation is bounded to five per player per rolling day, invitations expire after 24 hours, and only one operator can claim a room. This is not a comprehensive public abuse-prevention system.

## Run the local rule tests

The engine tests need no credentials. Install dependencies for the adapter tests and build.

```sh
npm test
npm run test:backend
npm run build
```

The 27 engine/narrative tests and 46 Convex adapter tests use local fixtures, including fictional message references. They include 100 generated cipher/relay variants, timer boundaries, scheduled expiry, player ID stability, friend consent, reserved invitations, and attribution/isolation across 20 identities in ten rooms. Eight recovery tests mock email transport and verify expiry, token reuse, limits and preservation of account data. Account tests exercise actual Convex Auth actions with ephemeral test-only signing keys: guest linking, password hashing, new-session restoration, incorrect credentials, failed-login limits and revoked-session enrollment. This is not a 20-browser load or latency benchmark. Tests do not send email or call an AI provider. Separately, a two-browser playthrough against the cloud development deployment completed all three challenges, exercised a wrong answer and hint, kept conflicting votes open, reached the broadcast ending, restored it after reload, observed WebSocket frames and teammate departure, and opened a fresh invitation. On the production site, two fresh browser identities readied up, shared clues, solved all three timed challenges and reached the preserve ending with both counters frozen at 03:39 remaining. These are gameplay checks, not a provider end-to-end test or proof that people find the case enjoyable.

## Files

- `PRODUCT.md`: approved direction, scoped build brief and acceptance gates.
- `server/case.mjs`: private case truth and separately labelled historical and fictional clues.
- `server/engine.mjs`: deterministic transitions and player-specific projections. Server-only; never bundle into the frontend.
- `tests/engine.test.mjs`: domain rules and fixture replay checks.
- `convex/rooms.ts`: authenticated, indexed room transport and server-derived identity.
- `convex/schema.ts`: auth tables, room membership and validated case state.
- `src/App.tsx`: landing, invitation, player desks and visible integration boundary.
- `tests/rooms.test.ts`: local Convex adapter checks.
- `convex/players.ts`: public profiles and consent-based friend relationships.
- `src/PlayerPanel.tsx`: player IDs, requests and reserved room invitations.
- `tests/players.test.ts`: player/friend authorization and ten-room isolation checks.
- `convex/auth.ts`, `convex/accountLinking.ts`: Convex Auth credentials and ownership-preserving guest account linking.
- `src/AccountControls.tsx`: save/sign-in/sign-out forms without password storage in application state or localStorage.
- `tests/accounts.test.ts`: real auth actions against local isolated fixtures.
- `hackathon.md`: build log and current delivery gates.

The engine accepts an actor identity only as a trusted adapter argument. The Convex transport derives it from authentication and checks stored room membership. Queries return a player projection, never the full case state. Case truth is absent from the frontend JavaScript bundle. The acknowledgement function remains an internal seam: signed webhook verification, sender/thread binding and delivery validation are not implemented, and no public acknowledgement mutation exists.

## Integration status

| Integration | Current evidence |
| --- | --- |
| Convex | Public static frontend and production backend deployed separately from development; guest and password accounts, persistent friends/cases and live two-player updates implemented. |
| Firecrawl | Optional fixed-URL checks extract both NASA mission pages, validate the pinned launch dates, and retain a short citation, extraction hash and timestamp. Real development and production calls passed. No arbitrary URL or crawl input. |
| OpenAI / Convex Agent | Mara Vale, a labelled fictional AI archivist, answers from shared clues and accepted room-local conversation. Filtered development and production inference passed using `openai/gpt-4o-mini` through Vercel AI Gateway, restricted to OpenAI. No model fallback. |
| AgentMail | Live verified-email recovery plus a separately opted-in post-game debrief. Controlled inboxes received development and production debriefs; the final repeated verification hit the existing email rate limit. No inbound character-reply unlock or delivery webhook is claimed. |

### Optional station services and limits

After both players share their clues, open the station panel below the desks. Both players see the same source receipts and conversation. Mara never receives the private clue projection, server answer key, room seed, player credentials, email addresses or another room's messages. Players are told that anything they type here is visible to their partner and sent to the AI provider. The model may still infer an answer from shared clues; it has no tools or authority to change game state.

Each room allows two source-check attempts (two fixed NASA pages per check) and six AI attempts. Shared deployment caps are ten source checks, forty AI attempts and ten debrief emails per daily window. Failed attempts count. AI requests have a 45-second timeout, 220-token output cap and zero SDK retries. Firecrawl's component may retry transient transport failures on the same provider. Sources are pinned once successful and cannot be refreshed into different facts mid-case. Missing or conflicting source facts produce an error, not a synthetic receipt.

The timer continues during optional requests. The core case uses manually reviewed facts and deterministic validation whether or not a provider is available; that is an explicit gameplay boundary, not a silent provider fallback. After a completed ending, each player may separately consent to one debrief to their own verified address. No automatic mail, arbitrary recipients or resend button. Only that recipient sees their send status. AgentMail queue status is not proof of receipt, and no inbound email advances the game.

Local suite now includes thirteen service-policy/adapter tests, four narrative tests and four voice-signaling tests (73 tests total), covering projection boundaries, membership, input/attempt limits, immutable pins, stale completion, room-local Agent history, withheld AI output and email prerequisites. Narrative tests cover earned passages, sealed/expired rooms, legacy cases and both ending consequences. Two tests execute the full Agent worker with a fixture model to check prompt inclusion and response publication. These use fixtures and make no provider calls. Live checks are documented separately in `hackathon.md`.

A production probe caught the model reversing the historical launch order. Mara now gives reasoning guidance without repeating mission names or launch dates. A narrow server-side output check rejects those restatements, and only approved Agent message IDs appear in the UI, future conversation context or debrief. Unreviewed earlier responses are withheld. This is not a general-purpose fact checker: AI reasoning can still be wrong, so the cited documents and deterministic validator remain authoritative. No replacement model or automatic regeneration runs after rejection.

Remaining: human playtest and submission materials. A gameplay-changing inbound character exchange remains a future feature, not part of the shipped debrief. Launch copy, storyboards, recordings and the working submission checklist are local-only and excluded from this repository. This source release does not establish a hackathon submission receipt.

Historical launch dates were checked against NASA's [Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/) and [Voyager 2](https://science.nasa.gov/mission/voyager/voyager-2/) pages on September 8, 2026. The listening station, dispatch puzzle, characters and recordings are fictional. NASA does not endorse this project. A source is labelled live-checked only after that case's actual Firecrawl check succeeds.
