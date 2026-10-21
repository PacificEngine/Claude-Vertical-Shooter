import { BASE_DAMAGE, FIRE_INTERVAL, MAX_BULLETS, MAX_VISIBLE, SQUAD_Y } from "../constants";
import { soldierOffsets } from "../formation";
import type { GameState } from "../types";

export function fireRule(state: GameState, dt: number): GameState {
  const timer = state.fireTimer - dt;
  if (timer > 0) return { ...state, fireTimer: timer };

  const visible = Math.min(state.squad.count, MAX_VISIBLE);
  if (visible === 0) return { ...state, fireTimer: FIRE_INTERVAL };

  const damage = (BASE_DAMAGE * state.squad.count) / visible;
  const room = Math.max(0, MAX_BULLETS - state.bullets.length);
  const fired = soldierOffsets(visible)
    .slice(0, room)
    .map(({ dx, dy }) => ({ x: state.squad.x + dx, y: SQUAD_Y + dy, damage, passedGates: [] }));

  return { ...state, bullets: [...state.bullets, ...fired], fireTimer: timer + FIRE_INTERVAL };
}
