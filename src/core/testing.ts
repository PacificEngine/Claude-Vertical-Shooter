import { createInitialState } from "./state";
import type { Bullet, Crate, GameState, Gate, Input, Pickup, Zombie } from "./types";

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState({ length: 1000, spawns: [] }, 1), ...overrides };
}

export function makeBullet(o: Partial<Bullet> = {}): Bullet {
  return { x: 200, y: 300, damage: 1, passedGates: [], vx: 0, pierce: false, hit: [], splash: 0, ...o };
}

export function makeZombie(o: Partial<Zombie> = {}): Zombie {
  return { id: 0, x: 200, y: 100, hp: 1, speed: 0, ...o };
}

export function makeCrate(o: Partial<Crate> = {}): Crate {
  return { x: 200, y: 300, hp: 3, power: "rapid", ...o };
}

export function makePickup(o: Partial<Pickup> = {}): Pickup {
  return { x: 200, y: 300, power: "rapid", ...o };
}

export function makeGate(o: Partial<Gate> = {}): Gate {
  return { id: 1, x: 200, y: 300, width: 100, kind: "bullet", op: "mul", value: 2, ...o };
}

export const noInput: Input = { targetX: 200 };
