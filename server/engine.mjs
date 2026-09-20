import { CASE_ID, clues, roles, solution } from "./case.mjs";
import { challengeFor, challengeView } from "./challenges.mjs";
import { storyFor } from "./story.mjs";

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

export function createCase(players, seed, timed = false, openingPack = null) {
  requireThat(players && roles.every((r) => typeof players[r] === "string" && players[r].trim()), "Two player identities are required.");
  requireThat(players.archivist !== players.operator, "Each role requires a different player.");
  return {
    caseId: seed ? "last-transmission-v2" : CASE_ID, players: { archivist: players.archivist, operator: players.operator },
    revision: 0, phase: "investigating", contributed: [], votes: {}, ending: null,
    pendingRequest: null, receipt: null, journal: [], operations: [],
    ...(seed ? { challenge: { seed, index: 0, mistakes: 0, hints: [] } } : {}),
    ...(openingPack ? { openingPack: structuredClone(openingPack) } : {}),
    ...(timed ? { clock: { ready: [], deadline: null, expired: false, finishedAt: null } } : {}),
  };
}

function roleOf(state, actorId) {
  const role = roles.find((r) => state.players[r] === actorId);
  requireThat(role, "This player is not a member of the case.");
  return role;
}

// The transport must derive actorId from authenticated membership, never request JSON.
export function viewFor(state, actorId) {
  const role = roleOf(state, actorId);
  const currentClues = state.challenge?.index === 0 && state.openingPack ? state.openingPack.clues
    : state.challenge ? challengeFor(state.challenge.seed, Math.min(state.challenge.index, 2)).clues : clues;
  return structuredClone({
    caseId: state.caseId, role, revision: state.revision, phase: state.phase,
    pack: state.openingPack ? { title: state.openingPack.title, provenance: state.openingPack.provenance } : null,
    privateClue: state.clock && !state.clock.deadline ? { id: "sealed", title: "Sealed evidence", kind: "fictional-clue", text: "Both players must press Ready before the evidence opens and the eight-minute signal window begins.", sources: [] } : currentClues[role],
    clock: state.clock ?? null,
    sharedClues: state.contributed.map((r) => currentClues[r]),
    challenge: challengeView(state),
    story: storyFor(state),
    contributions: state.contributed,
    ownVote: state.votes[role] ?? null,
    otherPlayerHasVoted: Boolean(state.votes[roles.find((r) => r !== role)]),
    ending: state.ending,
    awaitingCharacterReply: state.phase === "awaiting-reply",
    timeline: state.journal,
  });
}

function begin(state, operationId, fingerprint) {
  requireThat(typeof operationId === "string" && operationId.length > 0 && operationId.length <= 160, "A bounded operation ID is required.");
  const previous = state.operations.find((op) => op.id === operationId);
  if (previous) {
    requireThat(previous.fingerprint === fingerprint, "Operation ID was already used for different input.");
    return null;
  }
  requireThat(state.operations.length < 256, "This case has reached its action limit. Start a fresh room.");
  requireThat(state.phase !== "resolved", "This case has already ended.");
  const next = structuredClone(state);
  next.operations.push({ id: operationId, fingerprint });
  next.revision += 1;
  return next;
}

function note(state, text) {
  state.journal.push({ revision: state.revision, text });
}

export function applyPlayerAction(state, actorId, operationId, action, now = Date.now()) {
  const role = roleOf(state, actorId);
  requireThat(action && ["ready", "contribute", "submit-solution", "submit-challenge", "request-hint", "vote-ending"].includes(action.type), "Unknown player action.");
  const next = begin(state, operationId, JSON.stringify([actorId, action]));
  if (!next) return state;
  if (action.type === "ready") {
    requireThat(next.clock && next.clock.deadline === null, "This signal window has already started or is untimed.");
    requireThat(!next.clock.ready.includes(role), "You are already ready.");
    next.clock.ready.push(role);
    if (next.clock.ready.length === 2) {
      next.clock.deadline = now + 480_000;
      note(next, "Both players are ready. Eight minutes to recover the recording and agree on its fate.");
    } else note(next, `${role === "archivist" ? "The archivist" : "The operator"} is ready. Waiting for the other desk.`);
    return next;
  }
  if (next.clock) {
    requireThat(next.clock.deadline !== null, "Both players must be ready first.");
    requireThat(!next.clock.expired && now < next.clock.deadline, "The signal window has closed.");
  }
  if (next.challenge && action.type !== "vote-ending") {
    requireThat(action.challengeIndex === next.challenge.index, "The challenge changed. Read the new clues before acting.");
  }

  if (action.type === "request-hint") {
    requireThat(next.challenge && next.phase === "investigating", "Hints are only available during a challenge.");
    requireThat(!next.challenge.hints.includes(next.challenge.index), "This hint is already open.");
    next.challenge.hints.push(next.challenge.index);
    note(next, "A shared hint is open. Team score reduced by 10 points.");
  }

  if (action.type === "submit-challenge") {
    requireThat(next.challenge && next.challenge.index > 0 && next.phase === "investigating", "This challenge is not open.");
    requireThat(next.contributed.length === 2, "Both players must share their clue first.");
    requireThat(typeof action.answer === "string" && action.answer.trim().length > 0 && action.answer.length <= 80, "Enter a bounded answer.");
    const puzzle = challengeFor(next.challenge.seed, next.challenge.index);
    if (action.answer.trim().toUpperCase() !== puzzle.answer) {
      next.challenge.mistakes += 1;
      note(next, "That answer fails the cross-check. Compare both records; no progress was lost.");
    } else {
      next.challenge.index += 1;
      if (next.challenge.index === 3) {
        next.phase = "decision";
        note(next, "All three challenges passed. You recovered the station recording. Decide its fate together. No email was used to unlock this ending.");
      } else {
        next.contributed = [];
        note(next, "Access code accepted. New private relay evidence has arrived at both desks.");
      }
    }
  }

  if (action.type === "contribute") {
    requireThat(next.phase === "investigating", "Clues can only be contributed during investigation.");
    requireThat(!next.contributed.includes(role), "Your clue is already shared.");
    next.contributed.push(role);
    note(next, `${role === "archivist" ? "The archivist" : "The operator"} shared a discovery.`);
  }

  if (action.type === "submit-solution") {
    requireThat(!next.challenge || next.challenge.index === 0, "Use the current challenge answer form.");
    requireThat(next.phase === "investigating", "A solution cannot be submitted in this phase.");
    requireThat(next.contributed.length === 2, "Both players must share their clue first.");
    requireThat(typeof action.mission === "string" && action.mission.length <= 80 && typeof action.launchDate === "string" && action.launchDate.length <= 32, "Provide a mission and ISO launch date.");
    const mission = action.mission.toLowerCase().replace(/[\s-]/g, "");
    const expected = next.openingPack?.solution ?? solution;
    if (mission !== expected.mission || action.launchDate.trim() !== expected.launchDate) {
      if (next.challenge) next.challenge.mistakes += 1;
      note(next, "The proposed dispatch does not fit both clues. Recheck the manifest together.");
    } else if (next.challenge) {
      next.challenge.index = 1;
      next.contributed = [];
      note(next, "Dispatch recovered. A coded signal has arrived. Each desk has a different part of the cipher.");
    } else {
      next.pendingRequest = { id: operationId, mission: solution.mission, launchDate: solution.launchDate };
      next.phase = "awaiting-reply";
      note(next, "The dispatch matches. The character acknowledgement is still pending.");
    }
  }

  if (action.type === "vote-ending") {
    requireThat(next.phase === "decision", "The final decision is still locked.");
    requireThat(["broadcast", "preserve"].includes(action.choice), "Choose broadcast or preserve.");
    next.votes[role] = action.choice;
    note(next, `${role === "archivist" ? "The archivist" : "The operator"} chose an ending.`);
    if (roles.every((r) => next.votes[r] === action.choice)) {
      next.phase = "resolved";
      next.ending = action.choice;
      if (next.clock) next.clock.finishedAt = now;
      note(next, action.choice === "broadcast" ? "Together, you released the fictional station recording." : "Together, you preserved the fictional station recording in the private archive.");
    }
  }
  return next;
}

export function expireCase(state, now) {
  if (!state.clock?.deadline || state.clock.expired || state.phase === "resolved" || now < state.clock.deadline) return state;
  const next = structuredClone(state);
  next.clock.expired = true;
  next.revision += 1;
  note(next, "The signal window closed before you agreed on an ending. Your discoveries remain in the case record; this timed attempt is over.");
  return next;
}

// Internal adapter seam, NOT a public function. A future provider adapter must verify
// webhook signatures, inbox/thread identity and request binding before calling this.
// Arbitrary email text or OpenAI output cannot be passed through as an unlock event.
export function applyCharacterAcknowledgement(state, { operationId, requestId, messageId }) {
  requireThat(typeof messageId === "string" && messageId.length > 0 && messageId.length <= 320, "A provider message reference is required.");
  const next = begin(state, operationId, JSON.stringify(["character-acknowledgement", requestId, messageId]));
  if (!next) return state;
  requireThat(next.phase === "awaiting-reply" && next.pendingRequest?.id === requestId, "No matching character request is awaiting a reply.");
  next.receipt = { messageId, requestId };
  next.phase = "decision";
  note(next, "The fictional archivist acknowledged the dispatch. The final decision is open to both players.");
  return next;
}
