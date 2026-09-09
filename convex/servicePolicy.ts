import { v, ConvexError } from "convex/values";
import type { GameState } from "../server/engine.mjs";
import { viewFor } from "../server/engine.mjs";

export const MODEL = "openai/gpt-4o-mini";
export const sourceEvidence = v.object({ title: v.string(), url: v.string(), launchDate: v.string(), excerpt: v.string(), hash: v.string(), checkedAt: v.number() });
export const serviceStatus = v.union(v.literal("idle"), v.literal("working"), v.literal("ready"), v.literal("failed"));
export const NASA_SOURCES = [
  { title: "NASA: Voyager 1", url: "https://science.nasa.gov/mission/voyager/voyager-1/", launchDate: "1977-09-05", datePattern: /(?:september|sept?\.?)\s+5,?\s+1977/i },
  { title: "NASA: Voyager 2", url: "https://science.nasa.gov/mission/voyager/voyager-2/", launchDate: "1977-08-20", datePattern: /(?:august|aug\.?)\s+20,?\s+1977/i },
] as const;

export function mayConsult(state: GameState) {
  if (state.clock && !state.clock.deadline) return false;
  return state.contributed.length === 2 || state.phase === "decision" || state.phase === "resolved";
}
export function mayReadSources(state: GameState) {
  return mayConsult(state) || (state.challenge?.index ?? 0) > 0;
}
// Start from the same public projection the players see. Never serialize state,
// seeds, private clues, pending votes, user IDs, or the server's answer key.
export function sharedContext(state: GameState) {
  if (!mayConsult(state)) throw new ConvexError("Share both clues before contacting Mara.");
  const view = viewFor(state, state.players.archivist);
  // Historical facts stay in the cited UI, not generative advice. Supplying
  // the names/dates despite banning their repetition proved unreliable live.
  const sharedClues = view.challenge?.index === 0
    ? [{ title: "Shared manifest structure", text: "The manifest lists two mission labels and their different launch dates. Ask players to compare chronology, not the numbers in the labels." },
      { title: "Shared routing instruction", text: "Find the earlier departure in the printed manifest. Players must read the actual label and date themselves." }]
    : view.sharedClues.map(c => ({ title: c.title, text: c.text }));
  return JSON.stringify({ phase: view.phase, challenge: view.challenge?.title,
    sharedClues, ending: view.ending,
    recoveredTestimony: view.story?.passages, outcome: view.story?.outcome,
    teamProgress: view.challenge ? { stage: view.challenge.index, mistakes: view.challenge.mistakes, hintsUsed: view.challenge.hintsUsed, score: view.challenge.score } : null });
}
export function questionText(value: string) {
  const text = value.trim();
  if (!text || text.length > 500) throw new ConvexError("Ask a question using 1–500 characters.");
  return text;
}
export function validateCharacterReply(text: string) {
  // This is a narrow output boundary, not a general fact checker. Keep the
  // dispatch's historical names/dates in the cited documents, not AI narration.
  if (!text.trim() || text.length > 1400 || /voyager|\b1977\b|\b(?:aug(?:ust)?|sept?(?:ember)?)\b|\bmission\s*(?:one|two|1|2)\b/i.test(text))
    throw new Error("Reply outside the reasoning-only boundary");
  return text;
}
export function guidedQuestion(state: GameState, mode: "chat" | "hint" | "reflection", question: string) {
  if (mode === "chat") return questionText(question);
  if (mode === "reflection") {
    if (state.phase !== "resolved") throw new ConvexError("Agree on an ending before asking for a reflection.");
    return "Reflect on our saved ending and recorded consequences. Address the choice we actually made, acknowledge what it cost the witness, and ask us one question to discuss. Do not invent new events or another ending.";
  }
  if (state.phase !== "investigating" || state.clock?.expired || (state.clock?.deadline && Date.now() >= state.clock.deadline))
    throw new ConvexError("Stage nudges are available during an active investigation.");
  return "Give our team one small nudge for the current stage, using only shared clues and visible progress. Point out a relationship to compare, not the answer, decoded digits, relay selection, or historical facts. Do not open a scored hint or change our score.";
}
export async function verifySource(markdown: string | undefined, index: number, checkedAt: number) {
  const source = NASA_SOURCES[index];
  if (!markdown || markdown.length > 500_000 || !source || !markdown.includes(`Voyager ${index + 1}`))
    throw new Error("Source extraction was incomplete.");
  const match = source.datePattern.exec(markdown);
  if (!match) throw new Error("NASA's extracted page did not confirm the pinned launch date.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
  // Store a short citation, not the whole page or website instructions.
  return { title: source.title, url: source.url, launchDate: source.launchDate,
    excerpt: `${source.title.replace("NASA: ", "")}: ${match[0]}`,
    hash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""), checkedAt };
}
