import type { GameState, Input } from "./types";
import { bulletsVsGates } from "./rules/bulletsVsGates";
import { bulletsVsZombies } from "./rules/bulletsVsZombies";
import { endRule } from "./rules/end";
import { fireRule } from "./rules/fire";
import { moveRule } from "./rules/move";
import { spawnRule } from "./rules/spawn";
import { squadVsGates } from "./rules/squadVsGates";
import { zombiesVsSquad } from "./rules/zombiesVsSquad";

export function step(state: GameState, input: Input, dt: number): GameState {
  if (state.status !== "playing") return state;

  let next = moveRule(state, input, dt);
  next = spawnRule(next);
  next = fireRule(next, dt);
  next = bulletsVsGates(next);
  next = bulletsVsZombies(next);
  next = squadVsGates(next);
  next = zombiesVsSquad(next);
  return endRule(next);
}
