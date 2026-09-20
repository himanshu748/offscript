/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountLinking from "../accountLinking.js";
import type * as accounts from "../accounts.js";
import type * as auth from "../auth.js";
import type * as casePacks from "../casePacks.js";
import type * as caseServices from "../caseServices.js";
import type * as caseWorkers from "../caseWorkers.js";
import type * as http from "../http.js";
import type * as liveIdentity from "../liveIdentity.js";
import type * as players from "../players.js";
import type * as presence from "../presence.js";
import type * as recovery from "../recovery.js";
import type * as recoveryMail from "../recoveryMail.js";
import type * as rooms from "../rooms.js";
import type * as serviceLimits from "../serviceLimits.js";
import type * as servicePolicy from "../servicePolicy.js";
import type * as validators from "../validators.js";
import type * as voice from "../voice.js";
import type * as voiceTypes from "../voiceTypes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountLinking: typeof accountLinking;
  accounts: typeof accounts;
  auth: typeof auth;
  casePacks: typeof casePacks;
  caseServices: typeof caseServices;
  caseWorkers: typeof caseWorkers;
  http: typeof http;
  liveIdentity: typeof liveIdentity;
  players: typeof players;
  presence: typeof presence;
  recovery: typeof recovery;
  recoveryMail: typeof recoveryMail;
  rooms: typeof rooms;
  serviceLimits: typeof serviceLimits;
  servicePolicy: typeof servicePolicy;
  validators: typeof validators;
  voice: typeof voice;
  voiceTypes: typeof voiceTypes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
};
