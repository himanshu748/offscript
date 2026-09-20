// Server-only puzzle construction. Seeds and solutions never enter player projections.
import { clues } from "./case.mjs";

export function challengeFor(seed, index) {
  let n = 2166136261;
  for (const char of seed) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0;
  const digit = (shift) => (n >>> shift) % 10;
  const code = [digit(0), digit(5), digit(10), digit(15)];
  const offset = 1 + (n % 8);
  const order = n % 2 ? [2, 0, 3, 1] : [1, 3, 0, 2];
  const names = ["ALDER", "BIRCH", "CEDAR", "ELM"];
  const winner = (n >>> 9) % 4;
  const frequency = 400 + n % 80;
  const checksum = 10 + (n >>> 8) % 80;
  const evidence = (role, title, text) => ({ id: `challenge-${index}-${role}`, title, text, kind: "fictional-clue", sources: [] });
  if (index === 0) return {
    title: "Recover the dispatch", prompt: "Identify the mission and its ISO launch date.",
    hint: "Ignore the mission number. Compare the two launch dates, then choose the earlier one.", clues,
    answer: "VOYAGER2|1977-08-20",
  };
  if (index === 1) return {
    title: "Break the rotating cipher", prompt: "Recover the four-digit access code. Keep leading zeroes.",
    hint: "First put the slots in the operator’s order. Subtract the shift from each digit; add 10 if the result is negative.",
    clues: {
      archivist: evidence("archivist", "Intercepted signal strip", `Slots A, B, C, D contain: ${code.map(d => (d + offset) % 10).join(" · ")}. This is the transmitted strip, not the access code. Your partner has the reading order and the encoder setting.`),
      operator: evidence("operator", "Cipher maintenance card", `Read slots in this order: ${order.map(i => "ABCD"[i]).join(" → ")}. The encoder added ${offset} to each digit, wrapping 9 back to 0. Reverse that operation after ordering the slots. Ask your archivist for the intercepted digits.`),
    },
    answer: order.map(i => code[i]).join(""),
  };
  const rows = names.map((name, i) => {
    const delta = (i - winner + 4) % 4;
    return `${name}: frequency ${frequency + (delta === 2 || delta === 3 ? 3 : 0)}, checksum ${checksum + (delta === 1 || delta === 3 ? 7 : 0)}, seal ${code[(i + 1) % 4]}${code[i]}`;
  });
  return {
    title: "Find the unaltered relay", prompt: "Submit RELAY-SEAL (for example, ALDER-42). Only one log matches both checks.",
    hint: "Cross out every row with the wrong frequency, then every row with the wrong checksum. Use the remaining row’s seal in reverse order.",
    clues: {
      archivist: evidence("archivist", "Four competing relay logs", `${rows.join("\n")}. Three entries were altered. Your partner has the independent calibration checks.`),
      operator: evidence("operator", "Independent calibration record", `The intact relay used frequency ${frequency} and checksum ${checksum}. Both must match; either check alone leaves a decoy. Authentication requires the relay name, a hyphen, then that row’s two-digit seal REVERSED. Keep zeroes.`),
    },
    answer: `${names[winner]}-${code[winner]}${code[(winner + 1) % 4]}`,
  };
}

export function challengeView(state) {
  if (!state.challenge) return null;
  const { seed, index, mistakes, hints } = state.challenge;
  const puzzle = index === 0 && state.openingPack ? state.openingPack : challengeFor(seed, Math.min(index, 2));
  return {
    index, total: 3, title: puzzle.title, prompt: puzzle.prompt,
    mistakes, hintsUsed: hints.length,
    hint: hints.includes(index) ? puzzle.hint : null,
    score: Math.max(0, 100 - mistakes * 5 - hints.length * 10),
  };
}
