# Core Engine and Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser vertical shooter: an auto-firing squad, a zombie horde, bullet gates and squad gates, and one data-defined stage with a finish line.

**Architecture:** All rules live in a pure, deterministic `step(state, input, dt)` composed of small rule functions (one file each). A thin canvas renderer draws whatever state it is given. Only `main.ts` touches the browser (events, `requestAnimationFrame`, canvas).

**Tech Stack:** Vite, TypeScript (strict), Vitest, Playwright, ESLint. Package manager: yarn.

**Spec:** `docs/superpowers/specs/2026-10-21-core-engine-design.md`

## Global Constraints

- Package manager is **yarn only**. Never npm, pnpm or bun.
- `src/core/` has no DOM, no canvas and no `Date.now()`. Randomness comes only from the seeded RNG held in `state.rng`.
- Fixed timestep: `TICK = 1/60` seconds. `step` is a pure function and returns a new state.
- `MAX_VISIBLE = 30` soldiers are drawn and fire individually. Extra soldiers scale bullet damage: `damage = BASE_DAMAGE * count / visible`.
- Rule order inside `step`: move, spawn, fire, bullets vs. gates, bullets vs. zombies, squad vs. squad-gates, zombies vs. squad, end check.
- Sub-gate values are stored **negative** (e.g. `-100`). Each bullet that hits a bullet gate raises its value by 1 (a `sub` value is capped at 0).
- Once `status` is not `"playing"`, `step` returns the state unchanged.
- TDD always: failing test, see it fail, minimal code, see it pass, commit. Never refactor and change behavior in the same commit.
- Work on branch `feature/core-engine`. Never commit to `main`. Commit messages explain *why*. Do not add a Claude signature to commits.
- Run the Snyk code scan on new first-party code (final task).

## File Structure

```
package.json, tsconfig.json, vite.config.ts, eslint.config.js, .gitignore, .yarnrc.yml
playwright.config.ts
index.html
src/
  main.ts                  browser shell: loop, events, restart, test hooks
  core/
    constants.ts           all tunables
    types.ts               GameState, Stage, Spawn, Gate, Bullet, Zombie, Input
    math.ts                clamp
    rng.ts                 seeded RNG (mulberry32)
    stage.ts               validateStage
    state.ts               createInitialState
    testing.ts             test factories (makeState, makeBullet, ...)
    formation.ts           soldierOffsets
    step.ts                composes the rules
    rules/
      move.ts  spawn.ts  fire.ts  bulletsVsGates.ts  bulletsVsZombies.ts
      squadVsGates.ts  zombiesVsSquad.ts  end.ts
  stages/stage1.ts
  input/model.ts           InputModel (pure)
  render/canvas.ts         draw(), gateLabel()
e2e/game.spec.ts
```

Tests sit next to their source as `*.test.ts`. Run one with `yarn test <path>`.

---

### Task 1: Project scaffold and seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.gitignore`, `.yarnrc.yml`
- Create: `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

**Interfaces:**
- Produces: `nextRandom(state: number): [value: number, nextState: number]` where `value` is in `[0, 1)`.

- [ ] **Step 1: Write the config files**

`package.json`:
```json
{
  "name": "vertical-shooter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

`.yarnrc.yml` (needed only by yarn Berry; harmless otherwise):
```yaml
nodeLinker: node-modules
```

`.gitignore`:
```
node_modules
dist
playwright-report
test-results
.worktrees
.yarn/*
!.yarn/releases
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "e2e"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
```

`eslint.config.js`:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "playwright-report", "test-results", ".worktrees"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

- [ ] **Step 2: Install dependencies**

Run: `yarn add -D vite typescript vitest eslint @eslint/js typescript-eslint`
Expected: installs without errors; `yarn.lock` is created.

- [ ] **Step 3: Write the failing RNG test**

`src/core/rng.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { nextRandom } from "./rng";

describe("nextRandom", () => {
  it("returns values in [0, 1)", () => {
    let state = 42;
    for (let i = 0; i < 1000; i++) {
      const [value, next] = nextRandom(state);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      state = next;
    }
  });

  it("is deterministic for a given state", () => {
    expect(nextRandom(7)).toEqual(nextRandom(7));
  });

  it("produces a different sequence for different seeds", () => {
    expect(nextRandom(1)[0]).not.toBe(nextRandom(2)[0]);
  });

  it("advances the state", () => {
    const [, next] = nextRandom(5);
    expect(next).not.toBe(5);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `yarn test src/core/rng.test.ts`
Expected: FAIL, cannot resolve `./rng`.

- [ ] **Step 5: Write minimal implementation**

`src/core/rng.ts`:
```ts
// mulberry32: a tiny seeded PRNG. The whole generator state is one number,
// so it can live inside GameState and keep runs replayable.
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
```

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold project tooling and add seeded RNG

Replayable runs need randomness that lives in game state, so the RNG is
a pure function over a single number rather than Math.random."
```

---

### Task 2: Types, constants and stage validation

**Files:**
- Create: `src/core/constants.ts`, `src/core/types.ts`, `src/core/stage.ts`
- Test: `src/core/stage.test.ts`

**Interfaces:**
- Produces: all types in `types.ts` (below), all constants in `constants.ts`, and `validateStage(stage: Stage): void` which throws `Error("Spawn <index>: <reason>")` (or `Error("Stage length must be positive")`).

- [ ] **Step 1: Write constants and types** (declarations only, nothing to test yet)

`src/core/constants.ts`:
```ts
export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 700;
export const SQUAD_Y = 620;
export const SQUAD_SPEED = 300; // units per second toward the target
export const SQUAD_HALF_WIDTH = 20;
export const SQUAD_REACH = 10; // zombies this close above SQUAD_Y hit the squad
export const INITIAL_SQUAD = 5;
export const SCROLL_SPEED = 60; // units per second
export const BULLET_SPEED = 600;
export const BULLET_MARGIN = 20; // bullets are culled this far above the screen
export const FIRE_INTERVAL = 0.25; // seconds
export const BASE_DAMAGE = 1;
export const MAX_VISIBLE = 30;
export const MAX_BULLETS = 500;
export const MAX_ZOMBIES = 200;
export const SPAWN_Y = -20;
export const ZOMBIE_STAGGER = 16; // vertical gap between wave zombies
export const ZOMBIE_RADIUS = 12;
export const GATE_HEIGHT = 30;
export const SOLDIER_SPACING = 14;
export const KEY_SPEED = 300; // keyboard nudge, units per second
export const TICK = 1 / 60;
export const MAX_FRAME_SECONDS = 0.25;
```

`src/core/types.ts`:
```ts
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
```

- [ ] **Step 2: Write the failing validation tests**

`src/core/stage.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { validateStage } from "./stage";
import type { Spawn, Stage } from "./types";

type GateSpawn = Extract<Spawn, { type: "gate" }>;
type WaveSpawn = Extract<Spawn, { type: "zombieWave" }>;
type ZombieSpawn = Extract<Spawn, { type: "zombie" }>;

const gate = (o: Partial<GateSpawn> = {}): Spawn => ({
  at: 10, type: "gate", kind: "bullet", op: "mul", value: 2, x: 200, width: 100, ...o,
});
const wave = (o: Partial<WaveSpawn> = {}): Spawn => ({
  at: 10, type: "zombieWave", count: 3, hp: 1, speed: 40, spread: [50, 350], ...o,
});
const zombie = (o: Partial<ZombieSpawn> = {}): Spawn => ({
  at: 10, type: "zombie", x: 200, hp: 1, speed: 40, ...o,
});
const stage = (spawns: Spawn[], length = 1000): Stage => ({ length, spawns });

describe("validateStage", () => {
  it("accepts a valid stage", () => {
    expect(() => validateStage(stage([gate(), wave(), zombie({ at: 20 })]))).not.toThrow();
  });

  it("rejects a non-positive length", () => {
    expect(() => validateStage(stage([], 0))).toThrow(/length/);
  });

  it("rejects spawns that are not sorted by at", () => {
    expect(() => validateStage(stage([zombie({ at: 50 }), zombie({ at: 10 })]))).toThrow(/Spawn 1.*sorted/);
  });

  it("rejects at outside [0, length]", () => {
    expect(() => validateStage(stage([zombie({ at: 2000 })]))).toThrow(/Spawn 0.*outside/);
    expect(() => validateStage(stage([zombie({ at: -1 })]))).toThrow(/Spawn 0.*outside/);
  });

  it("rejects gates that extend outside the lane", () => {
    expect(() => validateStage(stage([gate({ x: 20, width: 100 })]))).toThrow(/Spawn 0.*lane/);
    expect(() => validateStage(stage([gate({ x: 380, width: 100 })]))).toThrow(/Spawn 0.*lane/);
  });

  it("rejects non-integer gate values", () => {
    expect(() => validateStage(stage([gate({ value: 2.5 })]))).toThrow(/Spawn 0.*integer/);
  });

  it("rejects mul gates below 1", () => {
    expect(() => validateStage(stage([gate({ op: "mul", value: 0 })]))).toThrow(/Spawn 0.*mul/);
  });

  it("rejects sub gates that are not negative", () => {
    expect(() => validateStage(stage([gate({ op: "sub", value: 5 })]))).toThrow(/Spawn 0.*sub/);
    expect(() => validateStage(stage([gate({ op: "sub", value: -100 })]))).not.toThrow();
  });

  it("rejects non-positive hp, speed or count", () => {
    expect(() => validateStage(stage([zombie({ hp: 0 })]))).toThrow(/Spawn 0.*hp/);
    expect(() => validateStage(stage([zombie({ speed: 0 })]))).toThrow(/Spawn 0.*speed/);
    expect(() => validateStage(stage([wave({ count: 0 })]))).toThrow(/Spawn 0.*count/);
  });

  it("rejects zombies and wave spreads outside the lane", () => {
    expect(() => validateStage(stage([zombie({ x: 500 })]))).toThrow(/Spawn 0.*lane/);
    expect(() => validateStage(stage([wave({ spread: [300, 100] })]))).toThrow(/Spawn 0.*spread/);
    expect(() => validateStage(stage([wave({ spread: [-10, 100] })]))).toThrow(/Spawn 0.*spread/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/core/stage.test.ts`
Expected: FAIL, cannot resolve `./stage`.

- [ ] **Step 4: Write minimal implementation**

`src/core/stage.ts`:
```ts
import { WORLD_WIDTH } from "./constants";
import type { Stage } from "./types";

export function validateStage(stage: Stage): void {
  if (stage.length <= 0) throw new Error("Stage length must be positive");

  stage.spawns.forEach((spawn, i) => {
    const fail = (reason: string): never => {
      throw new Error(`Spawn ${i}: ${reason}`);
    };

    if (i > 0 && spawn.at < stage.spawns[i - 1].at) fail("not sorted by at");
    if (spawn.at < 0 || spawn.at > stage.length) {
      fail(`at ${spawn.at} is outside [0, ${stage.length}]`);
    }

    switch (spawn.type) {
      case "zombie":
        if (spawn.hp <= 0) fail("hp must be positive");
        if (spawn.speed <= 0) fail("speed must be positive");
        if (spawn.x < 0 || spawn.x > WORLD_WIDTH) fail("x is outside the lane");
        break;
      case "zombieWave":
        if (!Number.isInteger(spawn.count) || spawn.count <= 0) fail("count must be a positive integer");
        if (spawn.hp <= 0) fail("hp must be positive");
        if (spawn.speed <= 0) fail("speed must be positive");
        if (spawn.spread[0] > spawn.spread[1] || spawn.spread[0] < 0 || spawn.spread[1] > WORLD_WIDTH) {
          fail("spread must be an ordered range inside the lane");
        }
        break;
      case "gate":
        if (spawn.width <= 0) fail("width must be positive");
        if (spawn.x - spawn.width / 2 < 0 || spawn.x + spawn.width / 2 > WORLD_WIDTH) {
          fail("gate extends outside the lane");
        }
        if (!Number.isInteger(spawn.value)) fail("value must be an integer");
        if (spawn.op === "mul" && spawn.value < 1) fail("mul value must be at least 1");
        if (spawn.op === "sub" && spawn.value >= 0) fail("sub value must be negative");
        break;
    }
  });
}
```

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add core types, constants and stage validation

Stages are data, so bad data must fail at load with the spawn index
rather than misbehave mid-game."
```

---

### Task 3: Initial state and test factories

**Files:**
- Create: `src/core/state.ts`, `src/core/testing.ts`
- Test: `src/core/state.test.ts`

**Interfaces:**
- Consumes: `validateStage`, types, constants.
- Produces:
  - `createInitialState(stage: Stage, seed: number): GameState`
  - Test factories in `testing.ts`: `makeState(overrides?: Partial<GameState>): GameState` (empty stage, length 1000, seed 1), `makeBullet(o?)`, `makeZombie(o?)`, `makeGate(o?)`, and `noInput: Input` (`targetX: 200`).

- [ ] **Step 1: Write the failing test**

`src/core/state.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { INITIAL_SQUAD, WORLD_WIDTH } from "./constants";
import { createInitialState } from "./state";
import type { Stage } from "./types";

const stage: Stage = { length: 1000, spawns: [] };

describe("createInitialState", () => {
  it("starts playing with a centred squad and nothing on screen", () => {
    const state = createInitialState(stage, 99);
    expect(state.status).toBe("playing");
    expect(state.squad).toEqual({ x: WORLD_WIDTH / 2, count: INITIAL_SQUAD });
    expect(state.bullets).toEqual([]);
    expect(state.zombies).toEqual([]);
    expect(state.gates).toEqual([]);
    expect(state.stage).toEqual({ scrollY: 0, length: 1000, spawnCursor: 0, spawns: [] });
    expect(state.rng).toBe(99);
    expect(state.fireTimer).toBe(0);
  });

  it("validates the stage", () => {
    expect(() => createInitialState({ length: 0, spawns: [] }, 1)).toThrow(/length/);
  });

  it("gives each game its own arrays", () => {
    const a = createInitialState(stage, 1);
    const b = createInitialState(stage, 1);
    expect(a.bullets).not.toBe(b.bullets);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/core/state.test.ts`
Expected: FAIL, cannot resolve `./state`.

- [ ] **Step 3: Write minimal implementation**

`src/core/state.ts`:
```ts
import { INITIAL_SQUAD, WORLD_WIDTH } from "./constants";
import { validateStage } from "./stage";
import type { GameState, Stage } from "./types";

export function createInitialState(stage: Stage, seed: number): GameState {
  validateStage(stage);
  return {
    squad: { x: WORLD_WIDTH / 2, count: INITIAL_SQUAD },
    bullets: [],
    zombies: [],
    gates: [],
    stage: { scrollY: 0, length: stage.length, spawnCursor: 0, spawns: stage.spawns },
    rng: seed >>> 0,
    fireTimer: 0,
    status: "playing",
  };
}
```

`src/core/testing.ts` (factories used by every rule test; not shipped to the browser because only tests import it):
```ts
import { createInitialState } from "./state";
import type { Bullet, GameState, Gate, Input, Zombie } from "./types";

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState({ length: 1000, spawns: [] }, 1), ...overrides };
}

export function makeBullet(o: Partial<Bullet> = {}): Bullet {
  return { x: 200, y: 300, damage: 1, passedGates: [], ...o };
}

export function makeZombie(o: Partial<Zombie> = {}): Zombie {
  return { x: 200, y: 100, hp: 1, speed: 0, ...o };
}

export function makeGate(o: Partial<Gate> = {}): Gate {
  return { id: 1, x: 200, y: 300, width: 100, kind: "bullet", op: "mul", value: 2, ...o };
}

export const noInput: Input = { targetX: 200 };
```

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add initial game state and test factories

Every rule test builds a small state; shared factories keep those tests
short and focused on the one behavior they assert."
```

---

### Task 4: Move rule

**Files:**
- Create: `src/core/math.ts`, `src/core/rules/move.ts`
- Test: `src/core/rules/move.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Input`, constants, test factories.
- Produces: `clamp(value, min, max): number`; `moveRule(state: GameState, input: Input, dt: number): GameState`.

- [ ] **Step 1: Write the failing test**

`src/core/rules/move.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { GATE_HEIGHT, SCROLL_SPEED, WORLD_HEIGHT, WORLD_WIDTH, SQUAD_HALF_WIDTH } from "../constants";
import { makeBullet, makeGate, makeState, makeZombie } from "../testing";
import { moveRule } from "./move";

describe("moveRule", () => {
  it("moves the squad toward the target at SQUAD_SPEED", () => {
    const next = moveRule(makeState(), { targetX: 400 }, 0.1);
    expect(next.squad.x).toBeCloseTo(230);
  });

  it("does not overshoot the target", () => {
    const next = moveRule(makeState(), { targetX: 205 }, 0.1);
    expect(next.squad.x).toBeCloseTo(205);
  });

  it("keeps the squad inside the lane", () => {
    const right = moveRule(makeState({ squad: { x: 370, count: 5 } }), { targetX: 1000 }, 1);
    expect(right.squad.x).toBe(WORLD_WIDTH - SQUAD_HALF_WIDTH);
    const left = moveRule(makeState({ squad: { x: 30, count: 5 } }), { targetX: -50 }, 1);
    expect(left.squad.x).toBe(SQUAD_HALF_WIDTH);
  });

  it("scrolls the stage", () => {
    const next = moveRule(makeState(), { targetX: 200 }, 0.5);
    expect(next.stage.scrollY).toBeCloseTo(SCROLL_SPEED * 0.5);
  });

  it("moves bullets up and culls those above the screen", () => {
    const next = moveRule(
      makeState({ bullets: [makeBullet({ y: 300 }), makeBullet({ y: -15 })] }),
      { targetX: 200 },
      0.1,
    );
    expect(next.bullets).toHaveLength(1);
    expect(next.bullets[0].y).toBeCloseTo(240);
  });

  it("moves zombies down at their own speed", () => {
    const next = moveRule(makeState({ zombies: [makeZombie({ y: 100, speed: 50 })] }), { targetX: 200 }, 0.1);
    expect(next.zombies[0].y).toBeCloseTo(105);
  });

  it("scrolls gates down and culls those below the screen", () => {
    const next = moveRule(
      makeState({ gates: [makeGate({ id: 1, y: 300 }), makeGate({ id: 2, y: WORLD_HEIGHT + GATE_HEIGHT })] }),
      { targetX: 200 },
      0.1,
    );
    expect(next.gates).toHaveLength(1);
    expect(next.gates[0].y).toBeCloseTo(306);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/core/rules/move.test.ts`
Expected: FAIL, cannot resolve `./move`.

- [ ] **Step 3: Write minimal implementation**

`src/core/math.ts`:
```ts
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
```

`src/core/rules/move.ts`:
```ts
import {
  BULLET_MARGIN, BULLET_SPEED, GATE_HEIGHT, SCROLL_SPEED, SQUAD_HALF_WIDTH, SQUAD_SPEED,
  WORLD_HEIGHT, WORLD_WIDTH,
} from "../constants";
import { clamp } from "../math";
import type { GameState, Input } from "../types";

export function moveRule(state: GameState, input: Input, dt: number): GameState {
  const target = clamp(input.targetX, SQUAD_HALF_WIDTH, WORLD_WIDTH - SQUAD_HALF_WIDTH);
  const maxMove = SQUAD_SPEED * dt;
  const x = state.squad.x + clamp(target - state.squad.x, -maxMove, maxMove);

  return {
    ...state,
    squad: { ...state.squad, x },
    bullets: state.bullets
      .map((b) => ({ ...b, y: b.y - BULLET_SPEED * dt }))
      .filter((b) => b.y >= -BULLET_MARGIN),
    zombies: state.zombies.map((z) => ({ ...z, y: z.y + z.speed * dt })),
    gates: state.gates
      .map((g) => ({ ...g, y: g.y + SCROLL_SPEED * dt }))
      .filter((g) => g.y <= WORLD_HEIGHT + GATE_HEIGHT),
    stage: { ...state.stage, scrollY: state.stage.scrollY + SCROLL_SPEED * dt },
  };
}
```

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add move rule for squad, bullets, zombies and gates

Culling off-screen entities here keeps later rules free of dead objects."
```

---

### Task 5: Spawn rule

**Files:**
- Create: `src/core/rules/spawn.ts`
- Test: `src/core/rules/spawn.test.ts`

**Interfaces:**
- Consumes: `nextRandom`, `GameState`, `Spawn`, constants.
- Produces: `spawnRule(state: GameState): GameState`. Gate `id` equals the spawn's index. Spawned things appear at `y = SPAWN_Y`; wave zombie `i` is at `SPAWN_Y - i * ZOMBIE_STAGGER`.

- [ ] **Step 1: Write the failing test**

`src/core/rules/spawn.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MAX_ZOMBIES, SPAWN_Y, ZOMBIE_STAGGER } from "../constants";
import { makeState, makeZombie } from "../testing";
import type { GameState, Spawn } from "../types";
import { spawnRule } from "./spawn";

const withSpawns = (spawns: Spawn[], scrollY: number, extra: Partial<GameState> = {}): GameState =>
  makeState({ stage: { scrollY, length: 1000, spawnCursor: 0, spawns }, ...extra });

describe("spawnRule", () => {
  const zombie: Spawn = { at: 5, type: "zombie", x: 100, hp: 3, speed: 40 };

  it("spawns a zombie once scrollY reaches at", () => {
    const next = spawnRule(withSpawns([zombie], 5));
    expect(next.zombies).toEqual([{ x: 100, y: SPAWN_Y, hp: 3, speed: 40 }]);
    expect(next.stage.spawnCursor).toBe(1);
  });

  it("waits until scrollY reaches at", () => {
    const next = spawnRule(withSpawns([zombie], 4.9));
    expect(next.zombies).toEqual([]);
    expect(next.stage.spawnCursor).toBe(0);
  });

  it("spawns each entry exactly once", () => {
    const once = spawnRule(withSpawns([zombie], 5));
    const twice = spawnRule(once);
    expect(twice.zombies).toHaveLength(1);
  });

  it("spawns a gate whose id is the spawn index", () => {
    const spawns: Spawn[] = [
      zombie,
      { at: 5, type: "gate", kind: "squad", op: "add", value: 5, x: 100, width: 150 },
    ];
    const next = spawnRule(withSpawns(spawns, 5));
    expect(next.gates).toEqual([
      { id: 1, x: 100, y: SPAWN_Y, width: 150, kind: "squad", op: "add", value: 5 },
    ]);
  });

  it("expands a wave into staggered zombies with x inside the spread", () => {
    const wave: Spawn = { at: 0, type: "zombieWave", count: 3, hp: 2, speed: 30, spread: [100, 200] };
    const next = spawnRule(withSpawns([wave], 0));
    expect(next.zombies).toHaveLength(3);
    next.zombies.forEach((z, i) => {
      expect(z.x).toBeGreaterThanOrEqual(100);
      expect(z.x).toBeLessThanOrEqual(200);
      expect(z.y).toBe(SPAWN_Y - i * ZOMBIE_STAGGER);
      expect(z.hp).toBe(2);
    });
  });

  it("is deterministic for a seed and advances the rng", () => {
    const wave: Spawn = { at: 0, type: "zombieWave", count: 3, hp: 1, speed: 30, spread: [0, 400] };
    const a = spawnRule(withSpawns([wave], 0));
    const b = spawnRule(withSpawns([wave], 0));
    expect(a.zombies).toEqual(b.zombies);
    expect(a.rng).not.toBe(makeState().rng);
  });

  it("drops zombies beyond MAX_ZOMBIES but still consumes the spawn", () => {
    const crowd = Array.from({ length: MAX_ZOMBIES }, () => makeZombie());
    const next = spawnRule(withSpawns([zombie], 5, { zombies: crowd }));
    expect(next.zombies).toHaveLength(MAX_ZOMBIES);
    expect(next.stage.spawnCursor).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/core/rules/spawn.test.ts`
Expected: FAIL, cannot resolve `./spawn`.

- [ ] **Step 3: Write minimal implementation**

`src/core/rules/spawn.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add spawn rule driven by stage scroll position

A cursor into the sorted spawn list guarantees each entry fires once
without scanning the whole list every tick."
```

---

### Task 6: Formation and fire rule (hybrid squad)

**Files:**
- Create: `src/core/formation.ts`, `src/core/rules/fire.ts`
- Test: `src/core/formation.test.ts`, `src/core/rules/fire.test.ts`

**Interfaces:**
- Consumes: constants, test factories.
- Produces:
  - `soldierOffsets(visible: number): { dx: number; dy: number }[]` (rows centred on the squad x, rows stack downward by `SOLDIER_SPACING`)
  - `fireRule(state: GameState, dt: number): GameState`

- [ ] **Step 1: Write the failing formation test**

`src/core/formation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { soldierOffsets } from "./formation";

describe("soldierOffsets", () => {
  it("places one soldier at the centre", () => {
    expect(soldierOffsets(1)).toEqual([{ dx: 0, dy: 0 }]);
  });

  it("centres each row, with a partial last row", () => {
    expect(soldierOffsets(3)).toEqual([
      { dx: -7, dy: 0 },
      { dx: 7, dy: 0 },
      { dx: 0, dy: 14 },
    ]);
  });

  it("returns nothing for zero soldiers", () => {
    expect(soldierOffsets(0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `yarn test src/core/formation.test.ts`
Expected: FAIL, cannot resolve `./formation`.

`src/core/formation.ts`:
```ts
import { SOLDIER_SPACING } from "./constants";

export function soldierOffsets(visible: number): { dx: number; dy: number }[] {
  const columns = Math.ceil(Math.sqrt(visible));
  return Array.from({ length: visible }, (_, i) => {
    const row = Math.floor(i / columns);
    const column = i % columns;
    const inRow = Math.min(columns, visible - row * columns);
    return { dx: (column - (inRow - 1) / 2) * SOLDIER_SPACING, dy: row * SOLDIER_SPACING };
  });
}
```

Run: `yarn test src/core/formation.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing fire test**

`src/core/rules/fire.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BASE_DAMAGE, FIRE_INTERVAL, MAX_BULLETS, MAX_VISIBLE, SQUAD_Y } from "../constants";
import { makeBullet, makeState } from "../testing";
import { fireRule } from "./fire";

const squad = (count: number) => ({ x: 200, count });

describe("fireRule", () => {
  it("does not fire while the timer is still running", () => {
    const next = fireRule(makeState({ fireTimer: 0.2 }), 0.1);
    expect(next.bullets).toHaveLength(0);
    expect(next.fireTimer).toBeCloseTo(0.1);
  });

  it("fires one bullet per visible soldier from the formation positions", () => {
    const next = fireRule(makeState({ squad: squad(3), fireTimer: 0 }), 0.1);
    expect(next.bullets.map((b) => [b.x, b.y])).toEqual([
      [193, SQUAD_Y],
      [207, SQUAD_Y],
      [200, SQUAD_Y + 14],
    ]);
    expect(next.bullets.every((b) => b.damage === BASE_DAMAGE && b.passedGates.length === 0)).toBe(true);
    expect(next.fireTimer).toBeCloseTo(-0.1 + FIRE_INTERVAL);
  });

  it("scales damage for soldiers beyond MAX_VISIBLE", () => {
    const next = fireRule(makeState({ squad: squad(MAX_VISIBLE * 2) }), 0.1);
    expect(next.bullets).toHaveLength(MAX_VISIBLE);
    expect(next.bullets.every((b) => b.damage === BASE_DAMAGE * 2)).toBe(true);
  });

  it("fires nothing with an empty squad but resets the timer", () => {
    const next = fireRule(makeState({ squad: squad(0) }), 0.1);
    expect(next.bullets).toHaveLength(0);
    expect(next.fireTimer).toBeGreaterThan(0);
  });

  it("never exceeds MAX_BULLETS", () => {
    const existing = Array.from({ length: MAX_BULLETS - 1 }, () => makeBullet());
    const next = fireRule(makeState({ squad: squad(3), bullets: existing }), 0.1);
    expect(next.bullets).toHaveLength(MAX_BULLETS);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `yarn test src/core/rules/fire.test.ts`
Expected: FAIL, cannot resolve `./fire`.

- [ ] **Step 5: Write minimal implementation**

`src/core/rules/fire.ts`:
```ts
import { BASE_DAMAGE, FIRE_INTERVAL, MAX_BULLETS, MAX_VISIBLE, SQUAD_Y } from "../constants";
import { soldierOffsets } from "../formation";
import type { GameState } from "../types";

export function fireRule(state: GameState, dt: number): GameState {
  const timer = state.fireTimer - dt;
  if (timer > 0) return { ...state, fireTimer: timer };

  const visible = Math.min(state.squad.count, MAX_VISIBLE);
  if (visible === 0) return { ...state, fireTimer: FIRE_INTERVAL };

  const damage = (BASE_DAMAGE * state.squad.count) / visible;
  const room = Math.max(0, MAX_BULLETS - state.bullets.length);
  const fired = soldierOffsets(visible)
    .slice(0, room)
    .map(({ dx, dy }) => ({ x: state.squad.x + dx, y: SQUAD_Y + dy, damage, passedGates: [] }));

  return { ...state, bullets: [...state.bullets, ...fired], fireTimer: timer + FIRE_INTERVAL };
}
```

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add squad formation and hybrid fire rule

Capping individual shooters keeps big squads cheap to simulate and draw
while extra soldiers still make every bullet hit harder."
```

---

### Task 7: Bullets vs. gates

**Files:**
- Create: `src/core/rules/bulletsVsGates.ts`
- Test: `src/core/rules/bulletsVsGates.test.ts`

**Interfaces:**
- Consumes: `Bullet`, `Gate`, constants (`MAX_BULLETS`, `GATE_HEIGHT`), factories.
- Produces: `bulletsVsGates(state: GameState): GameState`. A bullet overlaps a gate when `|bullet.x - gate.x| <= gate.width/2` and `|bullet.y - gate.y| <= GATE_HEIGHT/2`. Each bullet affects each gate once (tracked in `passedGates`). Only gates with `kind === "bullet"` are considered.

- [ ] **Step 1: Write the failing test**

`src/core/rules/bulletsVsGates.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MAX_BULLETS } from "../constants";
import { makeBullet, makeGate, makeState } from "../testing";
import { bulletsVsGates } from "./bulletsVsGates";

describe("bulletsVsGates", () => {
  it("steps a mul gate and spawns value-1 copies", () => {
    const next = bulletsVsGates(makeState({ bullets: [makeBullet()], gates: [makeGate({ op: "mul", value: 2 })] }));
    expect(next.gates[0].value).toBe(3);
    expect(next.bullets).toHaveLength(3);
    expect(next.bullets.every((b) => b.passedGates.includes(1))).toBe(true);
  });

  it("adds the stepped value to bullet damage for an add gate", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "add", value: 5 })] }),
    );
    expect(next.gates[0].value).toBe(6);
    expect(next.bullets[0].damage).toBe(7);
  });

  it("removes a bullet whose damage a sub gate reduces to zero or less, but still raises the gate", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "sub", value: -100 })] }),
    );
    expect(next.gates[0].value).toBe(-99);
    expect(next.bullets).toHaveLength(0);
  });

  it("lets a strong bullet survive a sub gate with reduced damage", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 5 })], gates: [makeGate({ op: "sub", value: -3 })] }),
    );
    expect(next.gates[0].value).toBe(-2);
    expect(next.bullets[0].damage).toBe(3);
  });

  it("caps a sub gate's value at 0 so it becomes harmless", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "sub", value: -1 })] }),
    );
    expect(next.gates[0].value).toBe(0);
    expect(next.bullets[0].damage).toBe(1);
    const again = bulletsVsGates(
      makeState({ bullets: [makeBullet({ damage: 1 })], gates: [makeGate({ op: "sub", value: 0 })] }),
    );
    expect(again.gates[0].value).toBe(0);
    expect(again.bullets[0].damage).toBe(1);
  });

  it("ignores bullets outside the gate", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet({ x: 300 }), makeBullet({ y: 100 })], gates: [makeGate()] }),
    );
    expect(next.gates[0].value).toBe(2);
    expect(next.bullets).toHaveLength(2);
  });

  it("affects each gate only once per bullet", () => {
    const next = bulletsVsGates(makeState({ bullets: [makeBullet({ passedGates: [1] })], gates: [makeGate()] }));
    expect(next.gates[0].value).toBe(2);
    expect(next.bullets).toHaveLength(1);
  });

  it("ignores squad gates", () => {
    const next = bulletsVsGates(makeState({ bullets: [makeBullet()], gates: [makeGate({ kind: "squad" })] }));
    expect(next.gates[0].value).toBe(2);
    expect(next.bullets).toHaveLength(1);
  });

  it("multiplies damage instead of copying when the bullet cap would be exceeded", () => {
    const filler = Array.from({ length: MAX_BULLETS - 1 }, () => makeBullet({ y: 0 }));
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet(), ...filler], gates: [makeGate({ op: "mul", value: 2 })] }),
    );
    expect(next.bullets).toHaveLength(MAX_BULLETS);
    expect(next.bullets[0].damage).toBe(3);
  });

  it("processes bullets in order so a second bullet sees the raised value", () => {
    const next = bulletsVsGates(
      makeState({ bullets: [makeBullet(), makeBullet()], gates: [makeGate({ op: "mul", value: 2 })] }),
    );
    expect(next.gates[0].value).toBe(4);
    expect(next.bullets).toHaveLength(2 + 2 + 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/core/rules/bulletsVsGates.test.ts`
Expected: FAIL, cannot resolve `./bulletsVsGates`.

- [ ] **Step 3: Write minimal implementation**

`src/core/rules/bulletsVsGates.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS. If the ordering test fails, check that copies are pushed before the original bullet (the test only counts totals, so either order passes).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add bullet-gate rule: shooting raises gates, crossing applies them

Raising a gate even with bullets it destroys is what lets the player
shoot a bad gate down before walking into it."
```

---

### Task 8: Bullets vs. zombies

**Files:**
- Create: `src/core/rules/bulletsVsZombies.ts`
- Test: `src/core/rules/bulletsVsZombies.test.ts`

**Interfaces:**
- Produces: `bulletsVsZombies(state: GameState): GameState`. A bullet hits the first living zombie with `|dx| <= ZOMBIE_RADIUS` and `|dy| <= ZOMBIE_RADIUS`; the bullet is consumed, damage is subtracted from hp, and zombies at hp <= 0 are removed.

- [ ] **Step 1: Write the failing test**

`src/core/rules/bulletsVsZombies.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeBullet, makeState, makeZombie } from "../testing";
import { bulletsVsZombies } from "./bulletsVsZombies";

describe("bulletsVsZombies", () => {
  it("kills a zombie and consumes the bullet", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ x: 200, y: 100, damage: 1 })], zombies: [makeZombie({ hp: 1 })] }),
    );
    expect(next.zombies).toHaveLength(0);
    expect(next.bullets).toHaveLength(0);
  });

  it("wounds a zombie that survives", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ y: 100, damage: 1 })], zombies: [makeZombie({ hp: 3 })] }),
    );
    expect(next.zombies[0].hp).toBe(2);
    expect(next.bullets).toHaveLength(0);
  });

  it("lets bullets that miss fly on", () => {
    const next = bulletsVsZombies(
      makeState({ bullets: [makeBullet({ x: 300, y: 100 })], zombies: [makeZombie()] }),
    );
    expect(next.bullets).toHaveLength(1);
    expect(next.zombies[0].hp).toBe(1);
  });

  it("applies several bullets to the same zombie", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ y: 100 }), makeBullet({ y: 100 })],
        zombies: [makeZombie({ hp: 2 })],
      }),
    );
    expect(next.zombies).toHaveLength(0);
    expect(next.bullets).toHaveLength(0);
  });

  it("lets a bullet hit only one zombie", () => {
    const next = bulletsVsZombies(
      makeState({
        bullets: [makeBullet({ y: 100 })],
        zombies: [makeZombie({ hp: 1 }), makeZombie({ hp: 1 })],
      }),
    );
    expect(next.zombies).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `yarn test src/core/rules/bulletsVsZombies.test.ts`
Expected: FAIL, cannot resolve `./bulletsVsZombies`.

`src/core/rules/bulletsVsZombies.ts`:
```ts
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
```

- [ ] **Step 3: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add bullet-zombie collision rule

Each bullet is spent on one zombie so a dense horde soaks up fire
instead of being deleted in a single volley."
```

---

### Task 9: Squad vs. squad gates

**Files:**
- Create: `src/core/rules/squadVsGates.ts`
- Test: `src/core/rules/squadVsGates.test.ts`

**Interfaces:**
- Produces: `squadVsGates(state: GameState): GameState`. A squad gate triggers when `|squad.x - gate.x| <= gate.width/2` and `|gate.y - SQUAD_Y| <= GATE_HEIGHT/2`; it applies once and is removed. `add`: `count + value`; `sub`: `count - |value|`; `mul`: `count * value`. Result is floored and clamped at 0.

- [ ] **Step 1: Write the failing test**

`src/core/rules/squadVsGates.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SQUAD_Y } from "../constants";
import { makeGate, makeState } from "../testing";
import type { Gate } from "../types";
import { squadVsGates } from "./squadVsGates";

const run = (count: number, gate: Partial<Gate>) =>
  squadVsGates(
    makeState({ squad: { x: 200, count }, gates: [makeGate({ kind: "squad", y: SQUAD_Y, ...gate })] }),
  );

describe("squadVsGates", () => {
  it("adds soldiers and consumes the gate", () => {
    const next = run(5, { op: "add", value: 3 });
    expect(next.squad.count).toBe(8);
    expect(next.gates).toHaveLength(0);
  });

  it("subtracts soldiers", () => {
    expect(run(5, { op: "sub", value: -3 }).squad.count).toBe(2);
  });

  it("never drops below zero", () => {
    expect(run(2, { op: "sub", value: -10 }).squad.count).toBe(0);
  });

  it("multiplies soldiers", () => {
    expect(run(5, { op: "mul", value: 3 }).squad.count).toBe(15);
  });

  it("does not trigger when the squad is outside the gate horizontally", () => {
    const next = run(5, { op: "add", value: 3, x: 50, width: 60 });
    expect(next.squad.count).toBe(5);
    expect(next.gates).toHaveLength(1);
  });

  it("does not trigger before the gate reaches the squad", () => {
    const next = run(5, { op: "add", value: 3, y: SQUAD_Y - 100 });
    expect(next.squad.count).toBe(5);
    expect(next.gates).toHaveLength(1);
  });

  it("ignores bullet gates", () => {
    const next = run(5, { kind: "bullet", op: "add", value: 3 });
    expect(next.squad.count).toBe(5);
    expect(next.gates).toHaveLength(1);
  });

  it("applies several gates in order", () => {
    const next = squadVsGates(
      makeState({
        squad: { x: 200, count: 5 },
        gates: [
          makeGate({ id: 1, kind: "squad", y: SQUAD_Y, op: "mul", value: 2 }),
          makeGate({ id: 2, kind: "squad", y: SQUAD_Y, op: "add", value: 1 }),
        ],
      }),
    );
    expect(next.squad.count).toBe(11);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `yarn test src/core/rules/squadVsGates.test.ts`
Expected: FAIL, cannot resolve `./squadVsGates`.

`src/core/rules/squadVsGates.ts`:
```ts
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
```

- [ ] **Step 3: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add squad-gate rule so walking through gates changes squad size

Gates are consumed on contact so a squad idling on one cannot farm it."
```

---

### Task 10: Zombies vs. squad

**Files:**
- Create: `src/core/rules/zombiesVsSquad.ts`
- Test: `src/core/rules/zombiesVsSquad.test.ts`

**Interfaces:**
- Produces: `zombiesVsSquad(state: GameState): GameState`. A zombie reaches the squad when `zombie.y + ZOMBIE_RADIUS >= SQUAD_Y - SQUAD_REACH` and `|zombie.x - squad.x| <= SQUAD_HALF_WIDTH + ZOMBIE_RADIUS`. Each such zombie is removed and costs one soldier (floor 0). Zombies fully below the screen (`y - ZOMBIE_RADIUS > WORLD_HEIGHT`) are removed with no penalty.

- [ ] **Step 1: Write the failing test**

`src/core/rules/zombiesVsSquad.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SQUAD_Y, WORLD_HEIGHT } from "../constants";
import { makeState, makeZombie } from "../testing";
import { zombiesVsSquad } from "./zombiesVsSquad";

const squad = (count: number) => ({ x: 200, count });

describe("zombiesVsSquad", () => {
  it("costs a soldier and removes the zombie that reaches the squad", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), zombies: [makeZombie({ y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(4);
    expect(next.zombies).toHaveLength(0);
  });

  it("costs one soldier per zombie", () => {
    const next = zombiesVsSquad(
      makeState({ squad: squad(5), zombies: [makeZombie({ y: SQUAD_Y }), makeZombie({ y: SQUAD_Y, x: 210 })] }),
    );
    expect(next.squad.count).toBe(3);
  });

  it("never drops the squad below zero", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(1), zombies: [makeZombie({ y: SQUAD_Y }), makeZombie({ y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(0);
  });

  it("leaves zombies that are still far away", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), zombies: [makeZombie({ y: SQUAD_Y - 100 })] }));
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(1);
  });

  it("lets zombies that pass beside the squad continue", () => {
    const next = zombiesVsSquad(makeState({ squad: squad(5), zombies: [makeZombie({ x: 300, y: SQUAD_Y })] }));
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(1);
  });

  it("silently removes zombies that left the bottom of the screen", () => {
    const next = zombiesVsSquad(
      makeState({ squad: squad(5), zombies: [makeZombie({ x: 0, y: WORLD_HEIGHT + 50 })] }),
    );
    expect(next.squad.count).toBe(5);
    expect(next.zombies).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `yarn test src/core/rules/zombiesVsSquad.test.ts`
Expected: FAIL, cannot resolve `./zombiesVsSquad`.

`src/core/rules/zombiesVsSquad.ts`:
```ts
import { SQUAD_HALF_WIDTH, SQUAD_REACH, SQUAD_Y, WORLD_HEIGHT, ZOMBIE_RADIUS } from "../constants";
import type { GameState, Zombie } from "../types";

export function zombiesVsSquad(state: GameState): GameState {
  const reachesSquad = (z: Zombie) =>
    z.y + ZOMBIE_RADIUS >= SQUAD_Y - SQUAD_REACH &&
    Math.abs(z.x - state.squad.x) <= SQUAD_HALF_WIDTH + ZOMBIE_RADIUS;
  const offScreen = (z: Zombie) => z.y - ZOMBIE_RADIUS > WORLD_HEIGHT;

  const hits = state.zombies.filter(reachesSquad).length;
  const zombies = state.zombies.filter((z) => !reachesSquad(z) && !offScreen(z));

  return {
    ...state,
    zombies,
    squad: { ...state.squad, count: Math.max(0, state.squad.count - hits) },
  };
}
```

- [ ] **Step 3: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add zombie-squad contact rule

Contact trades one zombie for one soldier, so a big squad is both the
damage dealer and the health bar."
```

---

### Task 11: End check and the `step` function

**Files:**
- Create: `src/core/rules/end.ts`, `src/core/step.ts`
- Test: `src/core/rules/end.test.ts`, `src/core/step.test.ts`

**Interfaces:**
- Consumes: every rule above.
- Produces: `endRule(state: GameState): GameState`; `step(state: GameState, input: Input, dt: number): GameState`.

- [ ] **Step 1: Write the failing end-rule test**

`src/core/rules/end.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeState } from "../testing";
import { endRule } from "./end";

const atFinish = { scrollY: 1000, length: 1000, spawnCursor: 0, spawns: [] };

describe("endRule", () => {
  it("keeps playing while soldiers remain and the finish line is ahead", () => {
    expect(endRule(makeState()).status).toBe("playing");
  });

  it("loses when the squad is gone", () => {
    expect(endRule(makeState({ squad: { x: 200, count: 0 } })).status).toBe("lost");
  });

  it("wins at the finish line with soldiers left", () => {
    expect(endRule(makeState({ stage: atFinish })).status).toBe("won");
  });

  it("resolves a simultaneous finish and wipe-out as a loss", () => {
    expect(endRule(makeState({ stage: atFinish, squad: { x: 200, count: 0 } })).status).toBe("lost");
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `yarn test src/core/rules/end.test.ts`
Expected: FAIL, cannot resolve `./end`.

`src/core/rules/end.ts`:
```ts
import type { GameState } from "../types";

export function endRule(state: GameState): GameState {
  if (state.squad.count <= 0) return { ...state, status: "lost" };
  if (state.stage.scrollY >= state.stage.length) return { ...state, status: "won" };
  return state;
}
```

Run: `yarn test src/core/rules/end.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing step test**

`src/core/step.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { TICK } from "./constants";
import { step } from "./step";
import { makeState, makeZombie, noInput } from "./testing";
import type { GameState } from "./types";

const run = (state: GameState, ticks: number): GameState => {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, noInput, TICK);
  return s;
};

describe("step", () => {
  it("returns the same state once the game is over", () => {
    const lost = makeState({ status: "lost" });
    expect(step(lost, noInput, TICK)).toBe(lost);
    const won = makeState({ status: "won" });
    expect(step(won, noInput, TICK)).toBe(won);
  });

  it("kills a zombie standing in the line of fire", () => {
    const start = makeState({ squad: { x: 200, count: 1 }, zombies: [makeZombie({ x: 200, y: 300, hp: 1 })] });
    const end = run(start, 60);
    expect(end.zombies).toHaveLength(0);
    expect(end.squad.count).toBe(1);
    expect(end.status).toBe("playing");
  });

  it("wins when the stage scrolls to the finish with the squad alive", () => {
    const start = makeState({ stage: { scrollY: 0, length: 3, spawnCursor: 0, spawns: [] } });
    expect(run(start, 10).status).toBe("won");
  });

  it("loses when zombies overrun the squad", () => {
    const crowd = Array.from({ length: 6 }, () => makeZombie({ x: 200, y: 600 }));
    const start = makeState({ squad: { x: 200, count: 5 }, zombies: crowd });
    expect(run(start, 5).status).toBe("lost");
  });

  it("does not mutate its input", () => {
    const start = makeState({ zombies: [makeZombie({ speed: 50 })] });
    const snapshot = structuredClone(start);
    step(start, noInput, TICK);
    expect(start).toEqual(snapshot);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `yarn test src/core/step.test.ts`
Expected: FAIL, cannot resolve `./step`.

- [ ] **Step 5: Write minimal implementation**

`src/core/step.ts`:
```ts
import type { GameState, Input } from "./types";
import { bulletsVsGates } from "./rules/bulletsVsGates";
import { bulletsVsZombies } from "./rules/bulletsVsZombies";
import { endRule } from "./rules/end";
import { fireRule } from "./rules/fire";
import { moveRule } from "./rules/move";
import { spawnRule } from "./rules/spawn";
import { squadVsGates } from "./rules/squadVsGates";
import { zombiesVsSquad } from "./rules/zombiesVsSquad";

export function step(state: GameState, input: Input, dt: number): GameState {
  if (state.status !== "playing") return state;

  let next = moveRule(state, input, dt);
  next = spawnRule(next);
  next = fireRule(next, dt);
  next = bulletsVsGates(next);
  next = bulletsVsZombies(next);
  next = squadVsGates(next);
  next = zombiesVsSquad(next);
  return endRule(next);
}
```

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS. The "zombies overrun" test needs the squad of 5 to lose 6 soldiers on the first tick; if it fails, check `zombiesVsSquad` runs before `endRule`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Compose rules into step and add win/lose resolution

A fixed rule order is the contract that makes runs reproducible, so it
lives in one small function that reads like the spec."
```

---

### Task 12: Stage 1 and the replay test

**Files:**
- Create: `src/stages/stage1.ts`
- Test: `src/stages/stage1.test.ts`

**Interfaces:**
- Consumes: `createInitialState`, `step`, `validateStage`, `TICK`.
- Produces: `stage1: Stage`.

- [ ] **Step 1: Write the failing test**

`src/stages/stage1.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { TICK } from "../core/constants";
import { validateStage } from "../core/stage";
import { createInitialState } from "../core/state";
import { step } from "../core/step";
import type { GameState } from "../core/types";
import { stage1 } from "./stage1";

// A deterministic "player" that sweeps left and right across the lane.
const sweep = (tick: number): number => {
  const t = (tick * 2) % 600;
  return 50 + (t < 300 ? t : 600 - t);
};

function play(seed: number): { state: GameState; ticks: number } {
  let state = createInitialState(stage1, seed);
  let ticks = 0;
  while (state.status === "playing" && ticks < 5000) {
    state = step(state, { targetX: sweep(ticks) }, TICK);
    ticks++;
  }
  return { state, ticks };
}

describe("stage1", () => {
  it("is a valid stage", () => {
    expect(() => validateStage(stage1)).not.toThrow();
  });

  it("replays identically for the same seed", () => {
    expect(play(123).state).toEqual(play(123).state);
  });

  it("can be won by a player who keeps moving", () => {
    const { state, ticks } = play(123);
    expect(state.status).toBe("won");
    expect({
      status: state.status,
      ticks,
      soldiers: state.squad.count,
      zombiesAlive: state.zombies.length,
    }).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/stages/stage1.test.ts`
Expected: FAIL, cannot resolve `./stage1`.

- [ ] **Step 3: Write the stage**

`src/stages/stage1.ts`:
```ts
import type { Stage } from "../core/types";

// A spawn appears at the top when scrollY reaches `at`, and a gate reaches the
// squad 640 units of scroll later, so spawns stop ~700 before `length`.
export const stage1: Stage = {
  length: 3400,
  spawns: [
    { at: 0, type: "gate", kind: "bullet", op: "mul", value: 2, x: 100, width: 180 },
    { at: 0, type: "gate", kind: "bullet", op: "add", value: 1, x: 300, width: 180 },
    { at: 150, type: "zombieWave", count: 4, hp: 2, speed: 35, spread: [40, 360] },
    { at: 450, type: "gate", kind: "squad", op: "add", value: 5, x: 100, width: 180 },
    { at: 450, type: "gate", kind: "squad", op: "sub", value: -3, x: 300, width: 180 },
    { at: 650, type: "zombieWave", count: 8, hp: 3, speed: 40, spread: [40, 360] },
    { at: 900, type: "gate", kind: "bullet", op: "sub", value: -10, x: 100, width: 180 },
    { at: 900, type: "gate", kind: "bullet", op: "mul", value: 2, x: 300, width: 180 },
    { at: 1150, type: "gate", kind: "squad", op: "mul", value: 2, x: 100, width: 180 },
    { at: 1150, type: "gate", kind: "squad", op: "add", value: 10, x: 300, width: 180 },
    { at: 1350, type: "zombieWave", count: 14, hp: 4, speed: 45, spread: [40, 360] },
    { at: 1700, type: "gate", kind: "bullet", op: "add", value: 2, x: 200, width: 360 },
    { at: 1900, type: "zombieWave", count: 20, hp: 6, speed: 50, spread: [40, 360] },
    { at: 2200, type: "gate", kind: "squad", op: "mul", value: 3, x: 100, width: 180 },
    { at: 2200, type: "gate", kind: "squad", op: "sub", value: -15, x: 300, width: 180 },
    { at: 2500, type: "zombieWave", count: 30, hp: 8, speed: 55, spread: [20, 380] },
    { at: 2700, type: "zombieWave", count: 30, hp: 10, speed: 60, spread: [20, 380] },
  ],
};
```

- [ ] **Step 4: Run the test, tune if needed**

Run: `yarn test src/stages/stage1.test.ts`
Expected: validity and determinism PASS. The snapshot test writes `src/stages/__snapshots__/stage1.test.ts.snap` on first run.

If "can be won" fails with `status: "lost"`, the numbers are a balance problem, not a rule bug. Adjust `stage1` (fewer or weaker waves, bigger squad gates) or `INITIAL_SQUAD` in `constants.ts` until a sweeping player wins, then re-run. Do not weaken the assertion. If it ends `"playing"` after 5000 ticks, `length` is too large for `SCROLL_SPEED` (3400/60 is about 57 s, around 3400 ticks).

- [ ] **Step 5: Review the snapshot**

Open the generated `.snap` file and confirm it shows `"status": "won"` with a plausible soldier count (at least 1) and tick count (about 3400).

- [ ] **Step 6: Run tests, typecheck and lint, then commit**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

```bash
git add -A
git commit -m "Add stage 1 and a seeded replay test

The replay snapshot is a tripwire: any accidental rule change shows up
as a diff in a full-stage run."
```

---

### Task 13: Input model

**Files:**
- Create: `src/input/model.ts`
- Test: `src/input/model.test.ts`

**Interfaces:**
- Consumes: `clamp`, `Input`, `KEY_SPEED`, `WORLD_WIDTH`.
- Produces: `class InputModel` with `setPointer(worldX: number): void`, `keyDown(key: string): void`, `keyUp(key: string): void`, `update(dt: number): Input`. Left keys: `ArrowLeft`, `a`. Right keys: `ArrowRight`, `d` (case-insensitive). The initial `targetX` is `WORLD_WIDTH / 2`.

- [ ] **Step 1: Write the failing test**

`src/input/model.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { KEY_SPEED, WORLD_WIDTH } from "../core/constants";
import { InputModel } from "./model";

describe("InputModel", () => {
  it("starts at the centre of the lane", () => {
    expect(new InputModel().update(0.1).targetX).toBe(WORLD_WIDTH / 2);
  });

  it("follows the pointer", () => {
    const input = new InputModel();
    input.setPointer(80);
    expect(input.update(0.1).targetX).toBe(80);
  });

  it("nudges right while a right key is held", () => {
    const input = new InputModel();
    input.keyDown("ArrowRight");
    expect(input.update(0.1).targetX).toBeCloseTo(WORLD_WIDTH / 2 + KEY_SPEED * 0.1);
  });

  it("nudges left for A and ArrowLeft, case-insensitively", () => {
    const a = new InputModel();
    a.keyDown("A");
    expect(a.update(0.1).targetX).toBeCloseTo(WORLD_WIDTH / 2 - KEY_SPEED * 0.1);
    const arrow = new InputModel();
    arrow.keyDown("ArrowLeft");
    expect(arrow.update(0.1).targetX).toBeCloseTo(WORLD_WIDTH / 2 - KEY_SPEED * 0.1);
  });

  it("stops when the key is released", () => {
    const input = new InputModel();
    input.keyDown("d");
    input.update(0.1);
    input.keyUp("d");
    const held = input.update(0.1).targetX;
    expect(input.update(0.1).targetX).toBe(held);
  });

  it("cancels out when both directions are held", () => {
    const input = new InputModel();
    input.keyDown("a");
    input.keyDown("d");
    expect(input.update(0.1).targetX).toBe(WORLD_WIDTH / 2);
  });

  it("keeps the target inside the lane", () => {
    const input = new InputModel();
    input.keyDown("d");
    expect(input.update(10).targetX).toBe(WORLD_WIDTH);
  });

  it("lets the most recent source win", () => {
    const input = new InputModel();
    input.keyDown("d");
    input.update(0.1);
    input.setPointer(40);
    input.keyUp("d");
    expect(input.update(0.1).targetX).toBe(40);
  });

  it("ignores other keys", () => {
    const input = new InputModel();
    input.keyDown(" ");
    expect(input.update(0.1).targetX).toBe(WORLD_WIDTH / 2);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `yarn test src/input/model.test.ts`
Expected: FAIL, cannot resolve `./model`.

`src/input/model.ts`:
```ts
import { KEY_SPEED, WORLD_WIDTH } from "../core/constants";
import { clamp } from "../core/math";
import type { Input } from "../core/types";

const LEFT_KEYS = new Set(["arrowleft", "a"]);
const RIGHT_KEYS = new Set(["arrowright", "d"]);

// Pointer sets an absolute target; held keys nudge that same target, so
// whichever source acted last naturally wins.
export class InputModel {
  private targetX = WORLD_WIDTH / 2;
  private readonly held = new Set<string>();

  setPointer(worldX: number): void {
    this.targetX = clamp(worldX, 0, WORLD_WIDTH);
  }

  keyDown(key: string): void {
    this.held.add(key.toLowerCase());
  }

  keyUp(key: string): void {
    this.held.delete(key.toLowerCase());
  }

  update(dt: number): Input {
    const left = [...this.held].some((k) => LEFT_KEYS.has(k)) ? 1 : 0;
    const right = [...this.held].some((k) => RIGHT_KEYS.has(k)) ? 1 : 0;
    this.targetX = clamp(this.targetX + (right - left) * KEY_SPEED * dt, 0, WORLD_WIDTH);
    return { targetX: this.targetX };
  }
}
```

- [ ] **Step 3: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add pure input model for pointer and keyboard

Keeping input as plain state lets the DOM shell stay a few lines of
event wiring with nothing worth unit-testing inside it."
```

---

### Task 14: Canvas renderer

**Files:**
- Create: `src/render/canvas.ts`
- Test: `src/render/canvas.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Gate`, `soldierOffsets`, constants.
- Produces: `type Viewport = { width: number; height: number }`; `gateLabel(gate: Pick<Gate, "op" | "value">): string` (`add` gives `+5`, `sub` gives `-100`, `mul` gives `x2`); `draw(ctx: CanvasRenderingContext2D, state: GameState, viewport: Viewport): void`. Soldiers are the only thing drawn with `arc`. Overlay text is exactly `YOU WIN` or `GAME OVER`, with a second line `Tap or press any key to restart`.

- [ ] **Step 1: Write the failing test**

`src/render/canvas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MAX_VISIBLE } from "../core/constants";
import { makeGate, makeState } from "../core/testing";
import type { GameState } from "../core/types";
import { draw, gateLabel } from "./canvas";

function fakeContext() {
  const calls: { name: string; args: unknown[] }[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, name: string) => (...args: unknown[]) => {
        calls.push({ name, args });
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const render = (state: GameState) => {
  const { ctx, calls } = fakeContext();
  draw(ctx, state, { width: 800, height: 1400 });
  return calls;
};
const texts = (calls: { name: string; args: unknown[] }[]) =>
  calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);

describe("gateLabel", () => {
  it("formats each op", () => {
    expect(gateLabel({ op: "add", value: 5 })).toBe("+5");
    expect(gateLabel({ op: "sub", value: -100 })).toBe("-100");
    expect(gateLabel({ op: "mul", value: 2 })).toBe("x2");
  });
});

describe("draw", () => {
  it("draws one circle per visible soldier", () => {
    const calls = render(makeState({ squad: { x: 200, count: 3 } }));
    expect(calls.filter((c) => c.name === "arc")).toHaveLength(3);
  });

  it("caps drawn soldiers at MAX_VISIBLE", () => {
    const calls = render(makeState({ squad: { x: 200, count: 500 } }));
    expect(calls.filter((c) => c.name === "arc")).toHaveLength(MAX_VISIBLE);
  });

  it("labels gates and shows the squad count", () => {
    const calls = render(
      makeState({ squad: { x: 200, count: 7 }, gates: [makeGate({ op: "mul", value: 3 })] }),
    );
    expect(texts(calls)).toContain("x3");
    expect(texts(calls)).toContain("7");
  });

  it("shows no overlay while playing", () => {
    const shown = texts(render(makeState()));
    expect(shown).not.toContain("GAME OVER");
    expect(shown).not.toContain("YOU WIN");
  });

  it("shows overlays when the game ends", () => {
    expect(texts(render(makeState({ status: "lost" })))).toContain("GAME OVER");
    const won = texts(render(makeState({ status: "won" })));
    expect(won).toContain("YOU WIN");
    expect(won).toContain("Tap or press any key to restart");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/render/canvas.test.ts`
Expected: FAIL, cannot resolve `./canvas`.

- [ ] **Step 3: Write minimal implementation**

`src/render/canvas.ts`:
```ts
import {
  GATE_HEIGHT, MAX_VISIBLE, SQUAD_Y, WORLD_HEIGHT, WORLD_WIDTH, ZOMBIE_RADIUS,
} from "../core/constants";
import { soldierOffsets } from "../core/formation";
import type { GameState, Gate } from "../core/types";

export type Viewport = { width: number; height: number };

export function gateLabel(gate: Pick<Gate, "op" | "value">): string {
  switch (gate.op) {
    case "add": return `+${gate.value}`;
    case "sub": return `${gate.value}`;
    case "mul": return `x${gate.value}`;
  }
}

const GATE_COLORS = { bullet: "rgba(255, 190, 60, 0.45)", squad: "rgba(80, 170, 255, 0.45)" };

export function draw(ctx: CanvasRenderingContext2D, state: GameState, viewport: Viewport): void {
  const scale = Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT);

  ctx.save();
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.translate((viewport.width - WORLD_WIDTH * scale) / 2, (viewport.height - WORLD_HEIGHT * scale) / 2);
  ctx.scale(scale, scale);

  drawFinishLine(ctx, state);
  drawGates(ctx, state);
  drawZombies(ctx, state);
  drawBullets(ctx, state);
  drawSquad(ctx, state);
  if (state.status !== "playing") drawOverlay(ctx, state);

  ctx.restore();
}

function drawFinishLine(ctx: CanvasRenderingContext2D, state: GameState): void {
  const y = SQUAD_Y - (state.stage.length - state.stage.scrollY);
  if (y < 0 || y > WORLD_HEIGHT) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, y - 2, WORLD_WIDTH, 4);
}

function drawGates(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 20px sans-serif";
  for (const gate of state.gates) {
    ctx.fillStyle = GATE_COLORS[gate.kind];
    ctx.fillRect(gate.x - gate.width / 2, gate.y - GATE_HEIGHT / 2, gate.width, GATE_HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(gateLabel(gate), gate.x, gate.y);
  }
}

function drawZombies(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "#58a04a";
  for (const z of state.zombies) {
    ctx.fillRect(z.x - ZOMBIE_RADIUS, z.y - ZOMBIE_RADIUS, ZOMBIE_RADIUS * 2, ZOMBIE_RADIUS * 2);
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "#ffe066";
  for (const b of state.bullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
}

function drawSquad(ctx: CanvasRenderingContext2D, state: GameState): void {
  const visible = Math.min(state.squad.count, MAX_VISIBLE);
  ctx.fillStyle = "#e8e8f0";
  for (const { dx, dy } of soldierOffsets(visible)) {
    ctx.beginPath();
    ctx.arc(state.squad.x + dx, SQUAD_Y + dy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${state.squad.count}`, state.squad.x, SQUAD_Y - 24);
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(state.status === "won" ? "YOU WIN" : "GAME OVER", WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20);
  ctx.font = "18px sans-serif";
  ctx.fillText("Tap or press any key to restart", WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 24);
}
```

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add canvas renderer as a pure function of game state

Drawing only reads state, so the whole look can be swapped for real art
in the polish piece without touching a single rule."
```

---

### Task 15: Browser shell and Playwright smoke tests

**Files:**
- Create: `playwright.config.ts`, `e2e/game.spec.ts`, `index.html`, `src/main.ts`

**Interfaces:**
- Consumes: `step`, `createInitialState`, `stage1`, `draw`, `InputModel`, `TICK`, `MAX_FRAME_SECONDS`, `WORLD_WIDTH`, `WORLD_HEIGHT`.
- Produces: the playable page. It also exposes a test hook `window.__game = { state(): GameState; fastForward(ticks: number, targetX: number): void }` and honors `?seed=<number>`.

- [ ] **Step 1: Install Playwright**

Run: `yarn add -D @playwright/test`
Run: `yarn playwright install chromium`
Expected: Chromium downloads. This is the one download this plan needs.

- [ ] **Step 2: Write the config and failing browser tests**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "yarn dev --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:5173" },
});
```

`e2e/game.spec.ts`:
```ts
import { expect, test, type Page } from "@playwright/test";

type Hook = {
  state(): { squad: { x: number; count: number }; status: string };
  fastForward(ticks: number, targetX: number): void;
};
// page.evaluate callbacks run in the browser, so they cannot close over Node-side helpers.
const squadX = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: Hook }).__game.state().squad.x);
const status = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: Hook }).__game.state().status);

test("loads and renders with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/?seed=1");
  const box = await page.locator("canvas#game").boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test("pointer movement shifts the squad", async ({ page }) => {
  await page.goto("/?seed=1");
  const box = (await page.locator("canvas#game").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
  await expect.poll(() => squadX(page)).toBeLessThan(100);
});

test("a run reaches an end state and restarts on a key press", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.evaluate(() =>
    (window as unknown as { __game: Hook }).__game.fastForward(4000, 200),
  );
  await expect.poll(() => status(page)).not.toBe("playing");
  await page.waitForTimeout(600); // restart is ignored briefly so the final key press cannot skip the result
  await page.keyboard.press("Space");
  await expect.poll(() => status(page)).toBe("playing");
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn test:e2e`
Expected: FAIL, the page has no `canvas#game` and no `window.__game`.

- [ ] **Step 4: Write the page and shell**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <title>Vertical Shooter</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
      body { display: flex; justify-content: center; align-items: center; }
      canvas {
        height: 100vh;
        max-width: 100vw;
        aspect-ratio: 400 / 700;
        touch-action: none; /* dragging must steer, not scroll */
        user-select: none;
      }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
import { MAX_FRAME_SECONDS, TICK, WORLD_HEIGHT, WORLD_WIDTH } from "./core/constants";
import { createInitialState } from "./core/state";
import { step } from "./core/step";
import { InputModel } from "./input/model";
import { draw } from "./render/canvas";
import { stage1 } from "./stages/stage1";

const RESTART_DELAY_MS = 400;
const PIXEL_RATIO = 2;

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = WORLD_WIDTH * PIXEL_RATIO;
canvas.height = WORLD_HEIGHT * PIXEL_RATIO;
const context = canvas.getContext("2d");
if (!context) throw new Error("2D canvas is not supported in this browser");
const ctx: CanvasRenderingContext2D = context;
const viewport = { width: canvas.width, height: canvas.height };

const seedParam = new URLSearchParams(location.search).get("seed");
const newGame = () => createInitialState(stage1, seedParam ? Number(seedParam) : Date.now() >>> 0);

let state = newGame();
let endedAt: number | null = null;
const input = new InputModel();

const toWorldX = (clientX: number): number => {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * WORLD_WIDTH;
};

function tryRestart(): void {
  if (state.status !== "playing" && endedAt !== null && performance.now() - endedAt > RESTART_DELAY_MS) {
    state = newGame();
    endedAt = null;
  }
}

canvas.addEventListener("pointermove", (e) => input.setPointer(toWorldX(e.clientX)));
canvas.addEventListener("pointerdown", (e) => {
  input.setPointer(toWorldX(e.clientX));
  tryRestart();
});
window.addEventListener("keydown", (e) => {
  input.keyDown(e.key);
  tryRestart();
});
window.addEventListener("keyup", (e) => input.keyUp(e.key));

let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  accumulator += Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
  last = now;
  while (accumulator >= TICK) {
    state = step(state, input.update(TICK), TICK);
    accumulator -= TICK;
  }
  if (state.status !== "playing" && endedAt === null) endedAt = now;
  draw(ctx, state, viewport);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook used by e2e tests to inspect state and skip ahead without waiting in real time.
(window as unknown as { __game: unknown }).__game = {
  state: () => state,
  fastForward(ticks: number, targetX: number) {
    for (let i = 0; i < ticks; i++) state = step(state, { targetX }, TICK);
  },
};
```

- [ ] **Step 5: Run the browser tests**

Run: `yarn test:e2e`
Expected: 3 tests PASS. If the console-errors test fails on a favicon 404, add `<link rel="icon" href="data:," />` to `index.html`'s `<head>`.

- [ ] **Step 6: Play it once by hand**

Run: `yarn dev` and open the printed URL. Confirm: the squad follows the mouse and arrow keys, zombies fall, gates scroll down, shooting a gate changes its number, and the overlay appears at the end. Stop the server afterwards.

- [ ] **Step 7: Run everything, then commit**

Run: `yarn test && yarn typecheck && yarn lint && yarn build`
Expected: all PASS and `dist/` is produced.

```bash
git add -A
git commit -m "Add browser shell and Playwright smoke tests

main.ts is the only file that touches the DOM; the e2e tests prove the
pieces connect, while all game logic stays covered by fast unit tests."
```

---

### Task 16: Final verification, security scan and squash

**Files:** none new (fixes only if a check fails).

- [ ] **Step 1: Run the full check suite**

Run: `yarn test && yarn typecheck && yarn lint && yarn build && yarn test:e2e`
Expected: everything PASSES. Fix any failure with a failing test first if it is a behavior bug.

- [ ] **Step 2: Run the Snyk code scan**

Run the `snyk_code_scan` MCP tool with `path` set to this project's absolute path. Fix any issue it reports in first-party code, re-run the scan, and repeat until it is clean. Commit fixes as separate commits before squashing.

- [ ] **Step 3: Squash the interim commits into one**

The base is the commit that added this plan (it is the last commit before implementation began).

Run: `git log --oneline` and note the hash of the commit titled "Add core engine implementation plan".

```bash
git reset --soft <that-hash>
git commit -m "Build the core vertical-shooter engine and playable stage

Adds a deterministic rules core (auto-fire squad, zombies, shootable
bullet gates, walk-through squad gates, win/lose), a pure canvas
renderer and a thin browser shell, with unit, replay and e2e coverage.
This is piece 1 of the game; power-ups, levels, bosses and polish build
on the same state and step function."
```

- [ ] **Step 4: Confirm the result**

Run: `git log --oneline && git status --short`
Expected: spec commit, plan commit, one implementation commit, clean working tree.

- [ ] **Step 5: Hand off**

Use superpowers:finishing-a-development-branch. Note that this repo has no `main` commit yet (the branch was created from an empty repo), so decide with the user how to create or merge into `main`.
