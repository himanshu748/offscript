export type Role = "archivist" | "operator";
export type Ending = "broadcast" | "preserve";
export type Phase =
  "investigating" | "awaiting-reply" | "decision" | "resolved";
export type Action =
  | { type: "ready" }
  | { type: "contribute"; challengeIndex?: number }
  | { type: "submit-solution"; mission: string; launchDate: string; challengeIndex?: number }
  | { type: "submit-challenge"; answer: string; challengeIndex: number }
  | { type: "request-hint"; challengeIndex: number }
  | { type: "vote-ending"; choice: Ending };
export interface Source {
  title: string;
  url: string;
  launchDate: string;
}
export interface Clue {
  id: string;
  title: string;
  kind: string;
  text: string;
  sources: Source[];
}
export interface GameState {
  clock?: Clock;
  challenge?: { seed: string; index: number; mistakes: number; hints: number[] };
  caseId: string;
  players: Record<Role, string>;
  revision: number;
  phase: Phase;
  contributed: Role[];
  votes: Partial<Record<Role, Ending>>;
  ending: Ending | null;
  pendingRequest: { id: string; mission: string; launchDate: string } | null;
  receipt: { messageId: string; requestId: string } | null;
  journal: { revision: number; text: string }[];
  operations: { id: string; fingerprint: string }[];
}
export interface PlayerView {
  story?: import("./story.mjs").StoryView | null;
  clock: Clock | null;
  challenge: { index: number; total: number; title: string; prompt: string; mistakes: number; hintsUsed: number; hint: string | null; score: number } | null;
  caseId: string;
  role: Role;
  revision: number;
  phase: Phase;
  privateClue: Clue;
  sharedClues: Clue[];
  contributions: Role[];
  ownVote: Ending | null;
  otherPlayerHasVoted: boolean;
  ending: Ending | null;
  awaitingCharacterReply: boolean;
  timeline: { revision: number; text: string }[];
}
export interface Clock { ready: Role[]; deadline: number | null; expired: boolean; finishedAt: number | null }
export function createCase(players: Record<Role, string>, seed?: string, timed?: boolean): GameState;
export function expireCase(state: GameState, now: number): GameState;
export function viewFor(state: GameState, actorId: string): PlayerView;
export function applyPlayerAction(
  state: GameState,
  actorId: string,
  operationId: string,
  action: Action,
  now?: number,
): GameState;
export function applyCharacterAcknowledgement(
  state: GameState,
  input: { operationId: string; requestId: string; messageId: string },
): GameState;
