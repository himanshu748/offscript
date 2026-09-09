import type { Clue, GameState, PlayerView } from "./engine.mjs";
export function challengeFor(seed: string, index: number): { title: string; prompt: string; hint: string; clues: Record<"archivist" | "operator", Clue>; answer: string };
export function challengeView(state: GameState): PlayerView["challenge"];
