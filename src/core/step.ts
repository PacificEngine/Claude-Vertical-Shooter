import type { GameState, Input } from "./types";
import { bulletsVsCrates } from "./rules/bulletsVsCrates";
import { bulletsVsGates } from "./rules/bulletsVsGates";
import { bulletsVsZombies } from "./rules/bulletsVsZombies";
import { endRule } from "./rules/end";
import { fireRule } from "./rules/fire";
import { moveRule } from "./rules/move";
import { pickupsVsSquad } from "./rules/pickupsVsSquad";
import { powerTimer } from "./rules/powerTimer";
import { spawnRule } from "./rules/spawn";
import { squadVsGates } from "./rules/squadVsGates";
import { zombiesVsSquad } from "./rules/zombiesVsSquad";

export function step(state: GameState, input: Input, dt: number): GameState {
  if (state.status !== "playing") return state;

  let next = moveRule(state, input, dt);
  next = spawnRule(next);
  next = powerTimer(next, dt);
  next = fireRule(next, dt);
  next = bulletsVsGates(next);
  next = bulletsVsZombies(next);
  next = bulletsVsCrates(next);
  next = squadVsGates(next);
  next = pickupsVsSquad(next);
  next = zombiesVsSquad(next);
  return endRule(next);
}
