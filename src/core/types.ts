export type GateKind = "bullet" | "squad";
export type GateOp = "add" | "sub" | "mul";

export type Bullet = { x: number; y: number; damage: number; passedGates: number[] };
export type Zombie = { x: number; y: number; hp: number; speed: number };
export type Gate = {
  id: number;
  x: number; // centre
  y: number; // centre
  width: number;
  kind: GateKind;
  op: GateOp;
  value: number; // sub gates are negative
};

export type Spawn =
  | { at: number; type: "zombie"; x: number; hp: number; speed: number }
  | {
      at: number;
      type: "zombieWave";
      count: number;
      hp: number;
      speed: number;
      spread: [number, number];
    }
  | {
      at: number;
      type: "gate";
      kind: GateKind;
      op: GateOp;
      value: number;
      x: number;
      width: number;
    };

export type Stage = { length: number; spawns: Spawn[] };

export type GameState = {
  squad: { x: number; count: number };
  bullets: Bullet[];
  zombies: Zombie[];
  gates: Gate[];
  stage: { scrollY: number; length: number; spawnCursor: number; spawns: Spawn[] };
  rng: number;
  fireTimer: number;
  status: "playing" | "won" | "lost";
};

export type Input = { targetX: number };
