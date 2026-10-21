import { MAX_ZOMBIES, SPAWN_Y, ZOMBIE_STAGGER } from "../constants";
import { nextRandom } from "../rng";
import type { GameState, Gate, Zombie } from "../types";

export function spawnRule(state: GameState): GameState {
  const { scrollY, spawns } = state.stage;
  let cursor = state.stage.spawnCursor;
  let rng = state.rng;
  const zombies: Zombie[] = [...state.zombies];
  const gates: Gate[] = [...state.gates];

  const addZombie = (zombie: Zombie) => {
    if (zombies.length < MAX_ZOMBIES) zombies.push(zombie);
  };

  while (cursor < spawns.length && spawns[cursor].at <= scrollY) {
    const spawn = spawns[cursor];
    switch (spawn.type) {
      case "zombie":
        addZombie({ x: spawn.x, y: SPAWN_Y, hp: spawn.hp, speed: spawn.speed });
        break;
      case "zombieWave": {
        const [low, high] = spawn.spread;
        for (let i = 0; i < spawn.count; i++) {
          const [r, next] = nextRandom(rng);
          rng = next;
          addZombie({ x: low + r * (high - low), y: SPAWN_Y - i * ZOMBIE_STAGGER, hp: spawn.hp, speed: spawn.speed });
        }
        break;
      }
      case "gate":
        gates.push({
          id: cursor, x: spawn.x, y: SPAWN_Y, width: spawn.width,
          kind: spawn.kind, op: spawn.op, value: spawn.value,
        });
        break;
    }
    cursor++;
  }

  return { ...state, zombies, gates, rng, stage: { ...state.stage, spawnCursor: cursor } };
}
