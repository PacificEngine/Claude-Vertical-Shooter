import {
  BULLET_MARGIN, BULLET_SPEED, GATE_HEIGHT, SCROLL_SPEED, SQUAD_HALF_WIDTH, SQUAD_SPEED,
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
      .map((b) => ({ ...b, y: b.y - BULLET_SPEED * dt }))
      .filter((b) => b.y >= -BULLET_MARGIN),
    zombies: state.zombies.map((z) => ({ ...z, y: z.y + z.speed * dt })),
    gates: state.gates
      .map((g) => ({ ...g, y: g.y + SCROLL_SPEED * dt }))
      .filter((g) => g.y <= WORLD_HEIGHT + GATE_HEIGHT),
    stage: { ...state.stage, scrollY: state.stage.scrollY + SCROLL_SPEED * dt },
  };
}
