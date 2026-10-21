import { createInitialState } from "./state";
import type { Bullet, GameState, Gate, Input, Zombie } from "./types";

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState({ length: 1000, spawns: [] }, 1), ...overrides };
}

export function makeBullet(o: Partial<Bullet> = {}): Bullet {
  return { x: 200, y: 300, damage: 1, passedGates: [], ...o };
}

export function makeZombie(o: Partial<Zombie> = {}): Zombie {
  return { x: 200, y: 100, hp: 1, speed: 0, ...o };
}

export function makeGate(o: Partial<Gate> = {}): Gate {
  return { id: 1, x: 200, y: 300, width: 100, kind: "bullet", op: "mul", value: 2, ...o };
}

export const noInput: Input = { targetX: 200 };
