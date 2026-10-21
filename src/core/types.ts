export type GateKind = "bullet" | "squad";
export type GateOp = "add" | "sub" | "mul";

export type PowerKind = "tank" | "spread" | "shield" | "rapid" | "pierce" | "bomb";
export type ActivePowerKind = Exclude<PowerKind, "bomb">;
export type ActivePower = { kind: ActivePowerKind; remaining: number; charges: number };

export type Crate = { x: number; y: number; hp: number; power: PowerKind };
export type Pickup = { x: number; y: number; power: PowerKind };

export type Bullet = {
  x: number;
  y: number;
  damage: number;
  passedGates: number[];
  vx: number; // horizontal speed (spread shots)
  pierce: boolean; // passes through zombies
  hit: number[]; // zombie ids a piercing bullet has already damaged
  splash: number; // blast radius (tank shells), 0 for plain bullets
};
export type Zombie = { id: number; x: number; y: number; hp: number; speed: number };
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
    }
  | { at: number; type: "crate"; x: number; hp: number; power: PowerKind };

export type Stage = { length: number; spawns: Spawn[] };

export type GameState = {
  squad: { x: number; count: number };
  bullets: Bullet[];
  zombies: Zombie[];
  gates: Gate[];
  crates: Crate[];
  pickups: Pickup[];
  power: ActivePower | null;
  nextId: number; // next zombie id
  stage: { scrollY: number; length: number; spawnCursor: number; spawns: Spawn[] };
  rng: number;
  fireTimer: number;
  status: "playing" | "won" | "lost";
};

export type Input = { targetX: number };
