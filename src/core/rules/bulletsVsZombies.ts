import { ZOMBIE_RADIUS } from "../constants";
import type { Bullet, GameState, Zombie } from "../types";

const overlaps = (bullet: Bullet, z: Zombie): boolean =>
  z.hp > 0 && Math.abs(bullet.x - z.x) <= ZOMBIE_RADIUS && Math.abs(bullet.y - z.y) <= ZOMBIE_RADIUS;

export function bulletsVsZombies(state: GameState): GameState {
  const zombies = state.zombies.map((z) => ({ ...z }));
  const bullets: Bullet[] = [];

  for (const bullet of state.bullets) {
    if (bullet.pierce) {
      const hit = [...bullet.hit];
      for (const z of zombies) {
        if (overlaps(bullet, z) && !hit.includes(z.id)) {
          z.hp -= bullet.damage;
          hit.push(z.id);
        }
      }
      bullets.push({ ...bullet, hit });
      continue;
    }

    const target = zombies.find((z) => overlaps(bullet, z));
    if (!target) {
      bullets.push(bullet);
    } else if (bullet.splash > 0) {
      target.hp -= bullet.damage;
      for (const z of zombies) {
        if (z !== target && z.hp > 0 && Math.hypot(z.x - bullet.x, z.y - bullet.y) <= bullet.splash) {
          z.hp -= bullet.damage;
        }
      }
    } else {
      target.hp -= bullet.damage;
    }
  }

  return { ...state, bullets, zombies: zombies.filter((z) => z.hp > 0) };
}
