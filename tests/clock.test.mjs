import test from "node:test";
import assert from "node:assert/strict";
import { createCase, viewFor, applyPlayerAction, expireCase } from "../server/engine.mjs";
import { challengeFor } from "../server/challenges.mjs";
const fresh = () => createCase({ archivist: "a", operator: "b" }, "timed-room", true);
const play = (state, actor, action, now = 1000) => applyPlayerAction(state, actor, `${state.revision}-${actor}`, action, now);
const ready = () => play(play(fresh(), "a", { type: "ready" }), "b", { type: "ready" });
test("two distinct ready votes start exactly one eight-minute window and reveal evidence", () => {
  const s = play(fresh(), "a", { type: "ready" });
  assert.equal(s.clock.deadline, null);
  assert.equal(viewFor(s, "a").privateClue.id, "sealed");
  assert.throws(() => play(s, "a", { type: "ready" }), /already ready/);
  assert.throws(() => play(s, "a", { type: "contribute", challengeIndex: 0 }), /ready first/);
  const started = play(s, "b", { type: "ready" });
  assert.equal(started.clock.deadline, 481000);
  assert.equal(viewFor(started, "a").privateClue.id, "launch-manifest");
  assert.throws(() => play(started, "a", { type: "ready" }), /already started/);
});
test("deadline is inclusive; expiry preserves discoveries and cannot be repeated", () => {
  const s = play(ready(), "a", { type: "contribute", challengeIndex: 0 }, 480999);
  assert.equal(expireCase(s, 480999), s);
  assert.throws(() => play(s, "b", { type: "contribute", challengeIndex: 0 }, 481000), /closed/);
  const expired = expireCase(s, 481000);
  assert.equal(expired.clock.expired, true);
  assert.deepEqual(expired.contributed, ["archivist"]);
  assert.equal(expireCase(expired, 900000), expired);
  assert.equal(expired.ending, null);
});
test("a timely ending freezes the clock and survives a late expiry callback", () => {
  let s = ready();
  for (let i = 0; i < 3; i++) {
    for (const actor of ["a", "b"]) s = play(s, actor, { type: "contribute", challengeIndex: i });
    s = play(s, "a", i === 0 ? { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20", challengeIndex: i } : { type: "submit-challenge", answer: challengeFor("timed-room", i).answer, challengeIndex: i });
  }
  s = play(s, "a", { type: "vote-ending", choice: "preserve" }, 3000);
  s = play(s, "b", { type: "vote-ending", choice: "preserve" }, 4000);
  assert.equal(s.clock.finishedAt, 4000);
  assert.equal(expireCase(s, 900000), s);
});
