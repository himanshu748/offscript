import test from "node:test";
import assert from "node:assert/strict";
import { createCase, applyPlayerAction, viewFor, expireCase } from "../server/engine.mjs";
import { challengeFor } from "../server/challenges.mjs";
const start = (timed = false) => createCase({ archivist: "a", operator: "b" }, "story-room", timed);
const play = (state, actor, action, now) => applyPlayerAction(state, actor, `${actor}-${state.revision}`, { challengeIndex: state.challenge.index, ...action }, now);
function solve(state) {
  for (const actor of ["a", "b"]) state = play(state, actor, { type: "contribute" });
  return play(state, "a", state.challenge.index === 0
    ? { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20" }
    : { type: "submit-challenge", answer: challengeFor(state.challenge.seed, state.challenge.index).answer });
}
test("only solved stages reveal testimony, identically to both players", () => {
  let state = start();
  for (let stage = 0; stage <= 3; stage++) {
    const story = viewFor(state, "a").story;
    assert.equal(story.recovered, stage);
    assert.equal(story.passages.length, stage + 1);
    assert.deepEqual(story, viewFor(state, "b").story);
    assert.equal(story.outcome, null);
    if (stage < 2) assert.ok(!JSON.stringify(story).includes("my initials"));
    if (stage < 3) assert.ok(!JSON.stringify(story).includes("do not broadcast my name"));
    if (stage < 3) state = solve(state);
  }
});
test("wrong answers and hints do not reveal new passages", () => {
  let state = start();
  state = play(state, "a", { type: "request-hint" });
  for (const actor of ["a", "b"]) state = play(state, actor, { type: "contribute" });
  state = play(state, "a", { type: "submit-solution", mission: "wrong", launchDate: "wrong" });
  assert.equal(viewFor(state, "a").story.recovered, 0);
});
test("both endings require consensus and expose different explicit consequences", () => {
  for (const choice of ["broadcast", "preserve"]) {
    let state = solve(solve(solve(start())));
    state = play(state, "a", { type: "vote-ending", choice });
    assert.equal(viewFor(state, "a").story.outcome, null);
    state = play(state, "b", { type: "vote-ending", choice });
    const view = viewFor(state, "a");
    assert.equal(view.challenge.score, 100);
    assert.match(view.story.outcome.text, choice === "broadcast" ? /against her recorded request/ : /no correction reaches/);
    assert.equal(state.receipt, null);
  }
});
test("sealed and expired rooms retain boundaries; legacy cases remain readable", () => {
  let state = start(true);
  assert.match(viewFor(state, "a").story.next, /press Ready/);
  state = play(state, "a", { type: "ready" }, 1000);
  state = play(state, "b", { type: "ready" }, 1000);
  state = expireCase(state, 481000);
  assert.match(viewFor(state, "a").story.next, /link closed/);
  assert.equal(viewFor(state, "a").story.outcome, null);
  assert.equal(viewFor(createCase({ archivist: "a", operator: "b" }), "a").story, null);
});
