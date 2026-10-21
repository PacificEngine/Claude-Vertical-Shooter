import {
  BASE_DAMAGE, FIRE_INTERVAL, MAX_BULLETS, MAX_VISIBLE, RAPID_RATE_MULT, SPREAD_VX, SQUAD_Y,
  TANK_DAMAGE_MULT, TANK_RATE_MULT, TANK_SPLASH,
} from "../constants";
import { soldierOffsets } from "../formation";
import type { ActivePowerKind, Bullet, GameState } from "../types";

const bullet = (x: number, y: number, damage: number, extra: Partial<Bullet> = {}): Bullet => ({
  x, y, damage, passedGates: [], vx: 0, pierce: false, hit: [], splash: 0, ...extra,
});

function intervalFor(kind: ActivePowerKind | undefined): number {
  if (kind === "rapid") return FIRE_INTERVAL * RAPID_RATE_MULT;
  if (kind === "tank") return FIRE_INTERVAL * TANK_RATE_MULT;
  return FIRE_INTERVAL;
}

function soldierBullets(state: GameState, visible: number, kind: ActivePowerKind | undefined): Bullet[] {
  const damage = (BASE_DAMAGE * state.squad.count) / visible;
  const speeds = kind === "spread" ? [-SPREAD_VX, 0, SPREAD_VX] : [0];
  return soldierOffsets(visible).flatMap(({ dx, dy }) =>
    speeds.map((vx) => bullet(state.squad.x + dx, SQUAD_Y + dy, damage, { vx, pierce: kind === "pierce" })),
  );
}

const tankShell = (state: GameState): Bullet[] => [
  bullet(state.squad.x, SQUAD_Y, BASE_DAMAGE * state.squad.count * TANK_DAMAGE_MULT, { splash: TANK_SPLASH }),
];

export function fireRule(state: GameState, dt: number): GameState {
  const timer = state.fireTimer - dt;
  if (timer > 0) return { ...state, fireTimer: timer };

  const kind = state.power?.kind;
  const interval = intervalFor(kind);
  const visible = Math.min(state.squad.count, MAX_VISIBLE);
  if (visible === 0) return { ...state, fireTimer: interval };

  const room = Math.max(0, MAX_BULLETS - state.bullets.length);
  const fired = (kind === "tank" ? tankShell(state) : soldierBullets(state, visible, kind)).slice(0, room);

  return { ...state, bullets: [...state.bullets, ...fired], fireTimer: timer + interval };
}
