import type { Stage } from "../core/types";

// A spawn appears at the top when scrollY reaches `at`, and a gate reaches the
// squad 640 units of scroll later, so spawns stop ~700 before `length`.
export const stage1: Stage = {
  length: 3400,
  spawns: [
    { at: 0, type: "gate", kind: "bullet", op: "mul", value: 2, x: 100, width: 180 },
    { at: 0, type: "gate", kind: "bullet", op: "add", value: 1, x: 300, width: 180 },
    { at: 150, type: "zombieWave", count: 4, hp: 2, speed: 35, spread: [40, 360] },
    { at: 450, type: "gate", kind: "squad", op: "add", value: 8, x: 100, width: 180 },
    { at: 450, type: "gate", kind: "squad", op: "sub", value: -2, x: 300, width: 180 },
    { at: 650, type: "zombieWave", count: 8, hp: 3, speed: 40, spread: [40, 360] },
    { at: 900, type: "gate", kind: "bullet", op: "sub", value: -5, x: 100, width: 180 },
    { at: 900, type: "gate", kind: "bullet", op: "mul", value: 2, x: 300, width: 180 },
    { at: 1150, type: "gate", kind: "squad", op: "mul", value: 2, x: 100, width: 180 },
    { at: 1150, type: "gate", kind: "squad", op: "add", value: 10, x: 300, width: 180 },
    { at: 1350, type: "zombieWave", count: 14, hp: 4, speed: 45, spread: [40, 360] },
    { at: 1700, type: "gate", kind: "bullet", op: "add", value: 2, x: 200, width: 360 },
    { at: 1900, type: "zombieWave", count: 14, hp: 5, speed: 50, spread: [40, 360] },
    { at: 2200, type: "gate", kind: "squad", op: "mul", value: 3, x: 100, width: 180 },
    { at: 2200, type: "gate", kind: "squad", op: "sub", value: -5, x: 300, width: 180 },
    { at: 2500, type: "zombieWave", count: 20, hp: 6, speed: 55, spread: [20, 380] },
    { at: 2700, type: "zombieWave", count: 20, hp: 8, speed: 60, spread: [20, 380] },
  ],
};
