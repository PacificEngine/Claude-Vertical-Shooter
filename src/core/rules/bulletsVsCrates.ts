import { CRATE_SIZE } from "../constants";
import type { Bullet, GameState } from "../types";

export function bulletsVsCrates(state: GameState): GameState {
  const crates = state.crates.map((c) => ({ ...c }));
  const bullets: Bullet[] = [];

  for (const bullet of state.bullets) {
    const target = crates.find(
      (c) =>
        c.hp > 0 && Math.abs(bullet.x - c.x) <= CRATE_SIZE / 2 && Math.abs(bullet.y - c.y) <= CRATE_SIZE / 2,
    );
    if (target) target.hp -= bullet.damage;
    else bullets.push(bullet);
  }

  const released = crates.filter((c) => c.hp <= 0).map((c) => ({ x: c.x, y: c.y, power: c.power }));
  return {
    ...state,
    bullets,
    crates: crates.filter((c) => c.hp > 0),
    pickups: [...state.pickups, ...released],
  };
}
