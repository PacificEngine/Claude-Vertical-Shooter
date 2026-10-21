import { SQUAD_HALF_WIDTH, SQUAD_REACH, SQUAD_Y, WORLD_HEIGHT, ZOMBIE_RADIUS } from "../constants";
import type { GameState, Zombie } from "../types";

export function zombiesVsSquad(state: GameState): GameState {
  const reachesSquad = (z: Zombie) =>
    z.y + ZOMBIE_RADIUS >= SQUAD_Y - SQUAD_REACH &&
    Math.abs(z.x - state.squad.x) <= SQUAD_HALF_WIDTH + ZOMBIE_RADIUS;
  const offScreen = (z: Zombie) => z.y - ZOMBIE_RADIUS > WORLD_HEIGHT;

  const hits = state.zombies.filter(reachesSquad).length;
  const zombies = state.zombies.filter((z) => !reachesSquad(z) && !offScreen(z));

  return {
    ...state,
    zombies,
    squad: { ...state.squad, count: Math.max(0, state.squad.count - hits) },
  };
}
