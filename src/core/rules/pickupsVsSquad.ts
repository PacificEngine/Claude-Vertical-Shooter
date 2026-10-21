import { BOMB_DAMAGE, PICKUP_SIZE, POWER_DURATION, SHIELD_CHARGES, SQUAD_HALF_WIDTH, SQUAD_Y } from "../constants";
import type { GameState, Pickup } from "../types";

const touches = (squadX: number, pickup: Pickup): boolean =>
  Math.abs(squadX - pickup.x) <= SQUAD_HALF_WIDTH + PICKUP_SIZE / 2 &&
  Math.abs(pickup.y - SQUAD_Y) <= PICKUP_SIZE;

export function pickupsVsSquad(state: GameState): GameState {
  let power = state.power;
  let zombies = state.zombies;
  const pickups: Pickup[] = [];

  for (const pickup of state.pickups) {
    if (!touches(state.squad.x, pickup)) {
      pickups.push(pickup);
    } else if (pickup.power === "bomb") {
      zombies = zombies
        .map((z) => (z.y > 0 ? { ...z, hp: z.hp - BOMB_DAMAGE } : z))
        .filter((z) => z.hp > 0);
    } else {
      power = {
        kind: pickup.power,
        remaining: POWER_DURATION[pickup.power],
        charges: pickup.power === "shield" ? SHIELD_CHARGES : 0,
      };
    }
  }

  return { ...state, pickups, zombies, power };
}
