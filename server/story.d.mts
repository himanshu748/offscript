import type { GameState } from "./engine.mjs";
export interface StoryView {
  recovered: number;
  passages: { title: string; text: string }[];
  next: string;
  outcome: { title: string; text: string; cost: string } | null;
}
export function storyFor(state: GameState): StoryView | null;
