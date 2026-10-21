import type { GameState } from "../types";

export function endRule(state: GameState): GameState {
  if (state.squad.count <= 0) return { ...state, status: "lost" };
  if (state.stage.scrollY >= state.stage.length) return { ...state, status: "won" };
  return state;
}
