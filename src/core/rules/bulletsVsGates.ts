import { GATE_HEIGHT, MAX_BULLETS } from "../constants";
import type { Bullet, GameState, Gate } from "../types";

const overlaps = (bullet: Bullet, gate: Gate): boolean =>
  Math.abs(bullet.x - gate.x) <= gate.width / 2 && Math.abs(bullet.y - gate.y) <= GATE_HEIGHT / 2;

// Every hit nudges the gate toward "better for the player"; sub gates stop at 0.
const stepValue = (gate: Gate): number =>
  gate.op === "sub" ? Math.min(gate.value + 1, 0) : gate.value + 1;

export function bulletsVsGates(state: GameState): GameState {
  const gates = state.gates.map((g) => ({ ...g }));
  const bullets: Bullet[] = [];
  let total = state.bullets.length;

  for (const original of state.bullets) {
    let bullet = original;
    let alive = true;

    for (const gate of gates) {
      if (gate.kind !== "bullet" || bullet.passedGates.includes(gate.id) || !overlaps(bullet, gate)) continue;

      gate.value = stepValue(gate);
      bullet = { ...bullet, passedGates: [...bullet.passedGates, gate.id] };

      if (gate.op === "add") {
        bullet = { ...bullet, damage: bullet.damage + gate.value };
      } else if (gate.op === "mul") {
        const copies = gate.value - 1;
        if (total + copies > MAX_BULLETS) {
          bullet = { ...bullet, damage: bullet.damage * gate.value };
        } else {
          for (let i = 0; i < copies; i++) bullets.push({ ...bullet, passedGates: [...bullet.passedGates] });
          total += copies;
        }
      } else {
        bullet = { ...bullet, damage: bullet.damage + gate.value };
        if (bullet.damage <= 0) {
          alive = false;
          break;
        }
      }
    }

    if (alive) bullets.push(bullet);
  }

  return { ...state, bullets, gates };
}
