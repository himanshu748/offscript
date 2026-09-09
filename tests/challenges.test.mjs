import test from "node:test";
import assert from "node:assert/strict";
import { challengeFor } from "../server/challenges.mjs";
import { createCase, viewFor, applyPlayerAction } from "../server/engine.mjs";
const players = { archivist: "a", operator: "b" };
const start = () => createCase(players, "test-room-173");
function play(s, actor, action, id = `${s.revision}-${actor}`) {
  return applyPlayerAction(s, actor, id, { challengeIndex: s.challenge.index, ...action });
}
function share(s) { return play(play(s, "a", { type: "contribute" }), "b", { type: "contribute" }); }
function solve(s) {
  return play(share(s), "a", s.challenge.index === 0
    ? { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20" }
    : { type: "submit-challenge", answer: challengeFor(s.challenge.seed, s.challenge.index).answer });
}
test("all stages can be solved, then both players must agree; no email receipt is invented", () => {
  for (const choice of ["broadcast", "preserve"]) {
    let s = start();
    for (let i = 0; i < 3; i++) s = solve(s);
    assert.equal(s.phase, "decision");
    assert.equal(s.receipt, null);
    assert.equal(s.pendingRequest, null);
    s = play(s, "a", { type: "vote-ending", choice });
    assert.equal(s.phase, "decision");
    s = play(s, "b", { type: "vote-ending", choice });
    assert.equal(s.ending, choice);
    assert.equal(viewFor(s, "a").challenge.score, 100);
  }
});
test("new evidence is private again and stale challenge submissions are rejected", () => {
  const s = solve(start());
  assert.deepEqual(s.contributed, []);
  const a = viewFor(s, "a");
  assert.equal(a.privateClue.title, "Intercepted signal strip");
  assert.equal(JSON.stringify(a).includes("Cipher maintenance card"), false);
  assert.equal("seed" in a.challenge, false);
  assert.equal("answer" in a.challenge, false);
  assert.throws(() => play(s, "a", { type: "contribute", challengeIndex: 0 }), /challenge changed/);
  assert.throws(() => play(s, "a", { type: "submit-challenge", answer: "1234" }), /Both players/);
  assert.throws(() => play(s, "a", { type: "submit-solution", mission: "Voyager 2", launchDate: "1977-08-20" }), /current challenge/);
});
test("hints and wrong answers update score once; hints cannot advance progress", () => {
  let s = solve(start());
  s = play(s, "b", { type: "request-hint" }, "hint");
  const duplicate = applyPlayerAction(s, "b", "hint", { challengeIndex: 1, type: "request-hint" });
  assert.equal(duplicate, s);
  assert.throws(() => play(s, "a", { type: "request-hint" }), /already open/);
  s = play(share(s), "a", { type: "submit-challenge", answer: "wrong" });
  assert.equal(s.challenge.index, 1);
  assert.equal(viewFor(s, "b").challenge.score, 85);
  assert.ok(viewFor(s, "a").challenge.hint);
});
test("100 generated cases have solvable ciphers and exactly one valid relay; answers vary", () => {
  const answers = new Set();
  for (let i = 0; i < 100; i++) {
    const seed = `case-${i}`;
    const cipher = challengeFor(seed, 1);
    const digits = cipher.clues.archivist.text.match(/contain: ([\d ·]+)/)[1].split(" · ").map(Number);
    const order = cipher.clues.operator.text.match(/order: ([A-D →]+)/)[1].split(" → ");
    const shift = Number(cipher.clues.operator.text.match(/added (\d)/)[1]);
    assert.equal(order.map(letter => (digits["ABCD".indexOf(letter)] - shift + 10) % 10).join(""), cipher.answer);
    const relay = challengeFor(seed, 2);
    const [, frequency, checksum] = relay.clues.operator.text.match(/frequency (\d+) and checksum (\d+)/);
    const matches = [...relay.clues.archivist.text.matchAll(/([A-Z]+): frequency (\d+), checksum (\d+), seal (\d{2})/g)].filter(row => row[2] === frequency && row[3] === checksum);
    assert.equal(matches.length, 1);
    assert.equal(`${matches[0][1]}-${[...matches[0][4]].reverse().join("")}`, relay.answer);
    answers.add(cipher.answer);
  }
  assert.ok(answers.size > 70);
});
