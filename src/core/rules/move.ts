import {
  BULLET_MARGIN, BULLET_SPEED, CRATE_SIZE, GATE_HEIGHT, PICKUP_SIZE, SCROLL_SPEED, SQUAD_HALF_WIDTH, SQUAD_SPEED,
  WORLD_HEIGHT, WORLD_WIDTH,
} from "../constants";
import { clamp } from "../math";
import type { GameState, Input } from "../types";

export function moveRule(state: GameState, input: Input, dt: number): GameState {
  const target = clamp(input.targetX, SQUAD_HALF_WIDTH, WORLD_WIDTH - SQUAD_HALF_WIDTH);
  const maxMove = SQUAD_SPEED * dt;
  const x = state.squad.x + clamp(target - state.squad.x, -maxMove, maxMove);

  return {
    ...state,
    squad: { ...state.squad, x },
    bullets: state.bullets
      .map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y - BULLET_SPEED * dt }))
      .filter((b) => b.y >= -BULLET_MARGIN && b.x >= -BULLET_MARGIN && b.x <= WORLD_WIDTH + BULLET_MARGIN),
    zombies: state.zombies.map((z) => ({ ...z, y: z.y + z.speed * dt })),
    gates: state.gates
      .map((g) => ({ ...g, y: g.y + SCROLL_SPEED * dt }))
      .filter((g) => g.y <= WORLD_HEIGHT + GATE_HEIGHT),
    crates: state.crates
      .map((c) => ({ ...c, y: c.y + SCROLL_SPEED * dt }))
      .filter((c) => c.y <= WORLD_HEIGHT + CRATE_SIZE),
    pickups: state.pickups
      .map((p) => ({ ...p, y: p.y + SCROLL_SPEED * dt }))
      .filter((p) => p.y <= WORLD_HEIGHT + PICKUP_SIZE),
    stage: { ...state.stage, scrollY: state.stage.scrollY + SCROLL_SPEED * dt },
  };
}
