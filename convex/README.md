# OFFSCRIPT backend

Current module guide, September 9, 2026. Setup and provider limits are in ../README.md; historical verification is in ../hackathon.md.

| Module | Responsibility |
| --- | --- |
| auth.ts, auth.config.ts, liveIdentity.ts | Convex Auth providers and server-derived identity. |
| accounts.ts, accountLinking.ts | Save a guest identity and restore password-based access. |
| recovery.ts, recoveryMail.ts | Verified recovery email, expiring single-use codes and AgentMail delivery. |
| rooms.ts, validators.ts | Membership, private projections and deterministic game transitions. |
| players.ts, presence.ts | Player IDs, consent-based friendships, invitations and connection presence. |
| caseServices.ts, caseWorkers.ts, servicePolicy.ts | Bounded Firecrawl checks, OpenAI dialogue and opt-in outbound debriefs. |
| voice.ts, voiceTypes.ts | Room-private WebRTC signaling and expiring call state; no audio storage. |
| schema.ts, convex.config.ts | Database indexes and installed components. |
| http.ts | Auth routes and static frontend hosting. |

Game truth lives in ../server and must stay out of browser bundles. Public IDs do not grant access. Derive the caller from authentication, check membership and return only their permitted view. Optional services cannot change puzzle answers or endings.

Keep provider credentials in Convex environment variables, never VITE_ variables or committed files. Development and production have separate identities, rooms, auth configuration and environment settings. Convex tooling maintains _generated.

From the project root, run `npm test`, `npm run test:backend` and `npm run build`. Tests use fixtures and do not prove live provider delivery. Use `npx convex dev` for backend development. Follow the root README for production configuration and `npm run deploy` for the static frontend workflow; confirm backend deployment separately when changing functions.
