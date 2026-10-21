import { GATE_HEIGHT, SQUAD_Y } from "../constants";
import type { GameState, Gate } from "../types";

const touches = (squadX: number, gate: Gate): boolean =>
  gate.kind === "squad" &&
  Math.abs(squadX - gate.x) <= gate.width / 2 &&
  Math.abs(gate.y - SQUAD_Y) <= GATE_HEIGHT / 2;

const apply = (count: number, gate: Gate): number => {
  switch (gate.op) {
    case "add": return count + gate.value;
    case "sub": return count - Math.abs(gate.value);
    case "mul": return count * gate.value;
  }
};

export function squadVsGates(state: GameState): GameState {
  let count = state.squad.count;
  const gates: Gate[] = [];

  for (const gate of state.gates) {
    if (touches(state.squad.x, gate)) count = Math.max(0, Math.floor(apply(count, gate)));
    else gates.push(gate);
  }

  return { ...state, gates, squad: { ...state.squad, count } };
}
