import type { GameState } from "../types";

export function powerTimer(state: GameState, dt: number): GameState {
  if (!state.power) return state;
  const remaining = state.power.remaining - dt;
  return { ...state, power: remaining > 0 ? { ...state.power, remaining } : null };
}
