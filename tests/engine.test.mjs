import test from "node:test";
import assert from "node:assert/strict";
import { createCase, viewFor, applyPlayerAction, applyCharacterAcknowledgement } from "../server/engine.mjs";

const players = { archivist: "player-a", operator: "player-b" };
const fresh = () => createCase(players);
function contributed() {
  let s = applyPlayerAction(fresh(), "player-a", "share-a", { type: "contribute" });
  return applyPlayerAction(s, "player-b", "share-b", { type: "contribute" });
}
function pending() {
  return applyPlayerAction(contributed(), "player-a", "solution", { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20" });
}
const ack = { operationId: "ack", requestId: "solution", messageId: "fixture-message-not-a-real-email" };
const decision = () => applyCharacterAcknowledgement(pending(), ack);

test("different players are required", () => {
  assert.throws(() => createCase({ archivist: "same", operator: "same" }));
  assert.throws(() => createCase({ archivist: "a" }));
});
test("private projections expose only the assigned clue", () => {
  const s = fresh();
  const a = viewFor(s, "player-a");
  const b = viewFor(s, "player-b");
  assert.equal(a.privateClue.id, "launch-manifest");
  assert.equal(b.privateClue.id, "routing-note");
  assert.deepEqual(a.sharedClues, []);
  assert.equal(JSON.stringify(a).includes("routing-note"), false);
  assert.equal(JSON.stringify(b).includes("1977-08-20"), false);
  assert.equal("players" in a, false);
  assert.equal("operations" in a, false);
});

test("a generated opening pack is snapshotted without exposing its answer", () => {
  const openingPack = {
    packKey: "fixture-pack", title: "The second wake", provenance: "firecrawl-openai-validated",
    prompt: "Find the later departure.", hint: "Compare dates.",
    clues: {
      archivist: { id: "fact", title: "Manifest", kind: "historical-facts", text: "Two dated records.", sources: [] },
      operator: { id: "route", title: "Order", kind: "fictional-clue", text: "Choose the later departure.", sources: [] },
    },
    solution: { mission: "voyager1", launchDate: "1977-09-05" },
  };
  const state = createCase(players, "pack-room", false, openingPack);
  const archivist = viewFor(state, players.archivist);
  const operator = viewFor(state, players.operator);
  assert.deepEqual(archivist.pack, { title: "The second wake", provenance: "firecrawl-openai-validated" });
  assert.equal(archivist.privateClue.id, "fact");
  assert.equal(operator.privateClue.id, "route");
  assert.ok(!JSON.stringify(archivist).includes("1977-09-05"));
  assert.ok(!JSON.stringify(operator).includes("1977-09-05"));
  openingPack.clues.archivist.text = "mutated";
  assert.equal(viewFor(state, players.archivist).privateClue.text, "Two dated records.");
});
test("outsiders cannot view or act", () => {
  assert.throws(() => viewFor(fresh(), "outsider"));
  assert.throws(() => applyPlayerAction(fresh(), "outsider", "x", { type: "contribute" }));
});
test("a forged clue field cannot contribute the other role's clue", () => {
  const s = applyPlayerAction(fresh(), "player-a", "share", { type: "contribute", clue: "routing-note" });
  assert.deepEqual(s.contributed, ["archivist"]);
});
test("state and projections are not mutated through references", () => {
  const s = fresh();
  const view = viewFor(s, "player-a");
  view.privateClue.sources[0].title = "changed";
  applyPlayerAction(s, "player-a", "share", { type: "contribute" });
  assert.equal(s.revision, 0);
  assert.equal(viewFor(s, "player-a").privateClue.sources[0].title, "NASA: Voyager 1");
});
test("both contributions are required before a solution", () => {
  assert.throws(() => applyPlayerAction(fresh(), "player-a", "solve", { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20" }));
});
test("incorrect dates cannot advance the scene", () => {
  const s = applyPlayerAction(contributed(), "player-b", "wrong", { type: "submit-solution", mission: "Voyager 1", launchDate: "1977-09-05" });
  assert.equal(s.phase, "investigating");
  assert.equal(s.pendingRequest, null);
});
test("a correct answer waits for character delivery rather than inventing it", () => {
  const s = pending();
  assert.equal(s.phase, "awaiting-reply");
  assert.equal(s.receipt, null);
  assert.throws(() => applyPlayerAction(s, "player-a", "early-vote", { type: "vote-ending", choice: "broadcast" }));
});
test("an unrelated or premature acknowledgement does not unlock a scene", () => {
  assert.throws(() => applyCharacterAcknowledgement(fresh(), ack));
  assert.throws(() => applyCharacterAcknowledgement(pending(), { ...ack, requestId: "wrong-request" }));
});
test("a bound acknowledgement unlocks both projections", () => {
  const s = decision();
  assert.equal(viewFor(s, "player-a").phase, "decision");
  assert.equal(viewFor(s, "player-b").phase, "decision");
});
test("duplicate operations have exactly one effect", () => {
  const original = contributed();
  const action = { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20" };
  const s = applyPlayerAction(original, "player-a", "solution", action);
  assert.equal(applyPlayerAction(s, "player-a", "solution", action), s);
  const d = applyCharacterAcknowledgement(s, ack);
  assert.equal(applyCharacterAcknowledgement(d, ack), d);
});
test("an operation ID cannot be reused for a different action", () => {
  assert.throws(() => applyPlayerAction(contributed(), "player-a", "share-a", { type: "vote-ending", choice: "broadcast" }));
});
test("conflicting votes keep the decision open and can be revised", () => {
  let s = applyPlayerAction(decision(), "player-a", "vote-a", { type: "vote-ending", choice: "broadcast" });
  s = applyPlayerAction(s, "player-b", "vote-b", { type: "vote-ending", choice: "preserve" });
  assert.equal(s.phase, "decision");
  assert.equal(s.ending, null);
  s = applyPlayerAction(s, "player-a", "revise-a", { type: "vote-ending", choice: "preserve" });
  assert.equal(s.ending, "preserve");
});
for (const choice of ["broadcast", "preserve"]) {
  test(`both players can reach the ${choice} ending, which is then immutable`, () => {
    let s = applyPlayerAction(decision(), "player-a", "vote-a", { type: "vote-ending", choice });
    s = applyPlayerAction(s, "player-b", "vote-b", { type: "vote-ending", choice });
    assert.equal(s.phase, "resolved");
    assert.equal(s.ending, choice);
    assert.throws(() => applyPlayerAction(s, "player-a", "new-vote", { type: "vote-ending", choice: "broadcast" }));
  });
}
test("unknown actions and oversized operation IDs are refused", () => {
  assert.throws(() => applyPlayerAction(fresh(), "player-a", "x", { type: "unlock-everything" }));
  assert.throws(() => applyPlayerAction(fresh(), "player-a", "x".repeat(161), { type: "contribute" }));
});
