import { INITIAL_SQUAD, WORLD_WIDTH } from "./constants";
import { validateStage } from "./stage";
import type { GameState, Stage } from "./types";

export function createInitialState(stage: Stage, seed: number): GameState {
  validateStage(stage);
  return {
    squad: { x: WORLD_WIDTH / 2, count: INITIAL_SQUAD },
    bullets: [],
    zombies: [],
    gates: [],
    crates: [],
    pickups: [],
    power: null,
    nextId: 0,
    stage: { scrollY: 0, length: stage.length, spawnCursor: 0, spawns: stage.spawns },
    rng: seed >>> 0,
    fireTimer: 0,
    status: "playing",
  };
}
