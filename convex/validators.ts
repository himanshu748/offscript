import { v } from "convex/values";
export const role = v.union(v.literal("archivist"), v.literal("operator"));
export const ending = v.union(v.literal("broadcast"), v.literal("preserve"));
const clock = v.object({ ready: v.array(role), deadline: v.union(v.null(), v.number()), expired: v.boolean(), finishedAt: v.union(v.null(), v.number()) });
export const phase = v.union(
  v.literal("investigating"),
  v.literal("awaiting-reply"),
  v.literal("decision"),
  v.literal("resolved"),
);
const journal = v.array(v.object({ revision: v.number(), text: v.string() }));
const clue = v.object({
  id: v.string(),
  title: v.string(),
  kind: v.string(),
  text: v.string(),
  sources: v.array(
    v.object({ title: v.string(), url: v.string(), launchDate: v.string() }),
  ),
});
export const gameState = v.object({
  clock: v.optional(clock),
  challenge: v.optional(v.object({ seed: v.string(), index: v.number(), mistakes: v.number(), hints: v.array(v.number()) })),
  caseId: v.string(),
  players: v.object({ archivist: v.string(), operator: v.string() }),
  revision: v.number(),
  phase,
  contributed: v.array(role),
  votes: v.object({
    archivist: v.optional(ending),
    operator: v.optional(ending),
  }),
  ending: v.union(v.null(), ending),
  pendingRequest: v.union(
    v.null(),
    v.object({ id: v.string(), mission: v.string(), launchDate: v.string() }),
  ),
  receipt: v.union(
    v.null(),
    v.object({ messageId: v.string(), requestId: v.string() }),
  ),
  journal,
  operations: v.array(v.object({ id: v.string(), fingerprint: v.string() })),
});
export const playerView = v.object({
  story: v.optional(v.union(v.null(), v.object({ recovered: v.number(), next: v.string(), passages: v.array(v.object({ title: v.string(), text: v.string() })), outcome: v.union(v.null(), v.object({ title: v.string(), text: v.string(), cost: v.string() })) }))),
  clock: v.union(v.null(), clock),
  challenge: v.union(v.null(), v.object({ index: v.number(), total: v.number(), title: v.string(), prompt: v.string(), mistakes: v.number(), hintsUsed: v.number(), hint: v.union(v.null(), v.string()), score: v.number() })),
  caseId: v.string(),
  role,
  revision: v.number(),
  phase,
  privateClue: clue,
  sharedClues: v.array(clue),
  contributions: v.array(role),
  ownVote: v.union(v.null(), ending),
  otherPlayerHasVoted: v.boolean(),
  ending: v.union(v.null(), ending),
  awaitingCharacterReply: v.boolean(),
  timeline: journal,
});
export const playerAction = v.union(
  v.object({ type: v.literal("ready") }),
  v.object({ type: v.literal("contribute"), challengeIndex: v.optional(v.number()) }),
  v.object({ type: v.literal("request-hint"), challengeIndex: v.number() }),
  v.object({ type: v.literal("submit-challenge"), answer: v.string(), challengeIndex: v.number() }),
  v.object({
    type: v.literal("submit-solution"),
    mission: v.string(),
    launchDate: v.string(),
    challengeIndex: v.optional(v.number()),
  }),
  v.object({ type: v.literal("vote-ending"), choice: ending }),
);
