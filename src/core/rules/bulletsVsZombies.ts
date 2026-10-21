import { ZOMBIE_RADIUS } from "../constants";
import type { Bullet, GameState } from "../types";

export function bulletsVsZombies(state: GameState): GameState {
  const zombies = state.zombies.map((z) => ({ ...z }));
  const bullets: Bullet[] = [];

  for (const bullet of state.bullets) {
    const target = zombies.find(
      (z) => z.hp > 0 && Math.abs(bullet.x - z.x) <= ZOMBIE_RADIUS && Math.abs(bullet.y - z.y) <= ZOMBIE_RADIUS,
    );
    if (target) target.hp -= bullet.damage;
    else bullets.push(bullet);
  }

  return { ...state, bullets, zombies: zombies.filter((z) => z.hp > 0) };
}
