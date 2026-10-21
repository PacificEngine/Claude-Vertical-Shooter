# Core Engine and Loop — Design (Piece 1 of 5)

A browser vertical shooter: a squad auto-fires up the screen at a zombie horde, shoots and walks through gates that change bullets and squad size, and survives to a finish line.

## Project breakdown

1. **Core engine and loop** (this spec)
2. Power-ups (pickups, tank transform, others)
3. Levels and progression
4. Boss fights
5. Polish (art, sound, particles, menu, touch tuning)

Each piece gets its own spec, plan and TDD cycle. This spec covers piece 1 only.

## Scope

In: game loop, input, auto-fire, zombies, bullet gates, squad gates, hybrid squad firing, one data-defined stage with a finish line, win/lose/restart, placeholder shapes for art.

Out: power-ups, tank form, bosses, menus, sound, real art, progression beyond one stage.

## Stack

Vite, TypeScript, Vitest, Playwright. Package manager: yarn.

## Architecture

All rules live in a deterministic, pure `step(state, input, dt) -> state`. A thin canvas renderer draws state. Only `main.ts` touches the browser.

```
src/
  core/      step.ts, rules/*.ts (one file per rule), stage.ts, rng.ts, types.ts
  render/    canvas.ts
  input/     input.ts
  stages/    stage1.ts
  main.ts
```

`core/` has no DOM, no canvas and no `Date.now()`. Randomness comes from a seeded RNG (`rng.ts`) whose state is stored in the game state, so runs are replayable.

## State

```ts
type GameState = {
  squad: { x: number; count: number };
  bullets: { x: number; y: number; damage: number; passedGates: number[] }[];
  zombies: { x: number; y: number; hp: number; speed: number }[];
  gates: { id: number; x: number; y: number; width: number;
           kind: "bullet" | "squad"; op: "add" | "sub" | "mul"; value: number }[];
  stage: { scrollY: number; length: number; spawnCursor: number };
  rng: number;
  fireTimer: number;
  status: "playing" | "won" | "lost";
};
type Input = { targetX: number };
```

Constants (in one `constants.ts`): `LANE_WIDTH`, `MAX_VISIBLE = 30`, `MAX_BULLETS`, `MAX_ZOMBIES`, `FIRE_INTERVAL`, `BASE_DAMAGE`, `SQUAD_SPEED`.

## Rules (run in this order each tick)

1. **Move.** Squad moves toward `input.targetX`, clamped to the lane. Bullets, zombies and gates advance.
2. **Spawn.** Spawn entries whose `at <= stage.scrollY`, advancing `spawnCursor` so each fires once.
3. **Fire.** When `fireTimer` elapses, each visible soldier (`min(count, MAX_VISIBLE)`) emits a bullet. Soldiers beyond `MAX_VISIBLE` add to bullet damage: `damage = BASE_DAMAGE * (count / visible)`.
4. **Bullets vs. bullet gates.** When a bullet first overlaps a bullet gate (tracked in `passedGates`, so each bullet affects each gate once):
   - The gate's value steps toward larger: `add`/`mul` value `+1`; `sub` value `+1` (e.g. -100 becomes -99, floored so it never exceeds 0 — at 0 a `sub` gate acts as a no-op).
   - Then the bullet takes the gate's effect, using the value *after* the step:
     - `add`: `damage += value`.
     - `mul`: spawns `value - 1` copies of the bullet. If `MAX_BULLETS` would be exceeded, no copies spawn and the bullet's `damage *= value` instead.
     - `sub`: `damage -= |value|`. If damage reaches 0 or less the bullet is removed.
5. **Bullets vs. zombies.** A bullet hitting a zombie deals its damage to hp and is removed. Zombies at hp <= 0 are removed.
6. **Squad vs. squad gates.** When the squad overlaps a squad gate it applies the op once and the gate is consumed:
   `add`: `count += value`; `sub`: `count -= |value|`; `mul`: `count *= value`. `count` is floored to an integer and clamped at 0.
7. **Zombies vs. squad.** A zombie reaching the squad removes one soldier per zombie and is removed.
8. **End check.** `count <= 0` sets `lost`. `stage.scrollY >= stage.length` with `count > 0` sets `won`. A tick that satisfies both resolves to `lost`.

Once `status` is not `playing`, `step` returns the state unchanged.

## Stage format

```ts
type Stage = { length: number; spawns: Spawn[] };
type Spawn =
  | { at: number; type: "zombie"; x: number; hp: number; speed: number }
  | { at: number; type: "zombieWave"; count: number; hp: number; speed: number; spread: [number, number] }
  | { at: number; type: "gate"; kind: "bullet" | "squad"; op: "add" | "sub" | "mul";
      value: number; x: number; width: number };
```

`zombieWave` expands to individual zombies, picking x within `spread` from the seeded RNG. `validateStage` rejects: spawns not sorted by `at`; `at` outside `[0, length]`; gates extending outside the lane; `mul` value below 1; non-positive `hp`, `speed` or `count`. Errors name the offending spawn index.

Piece 1 ships one hand-written stage, `stages/stage1.ts`: a few bullet-gate and squad-gate pairs and escalating waves.

## Rendering and input

- `render/canvas.ts`: `draw(ctx, state, viewport)`, a pure function of state. Placeholder shapes: circles for soldiers, squares for zombies, translucent labeled bars for gates. It owns world-to-screen scaling so the lane fits any viewport.
- `input/input.ts`: converts pointer and keyboard events to `{ targetX }` in world units. Pointer sets `targetX` directly. Arrow keys / A / D nudge it at a fixed speed. Most recent input wins.
- Loop in `main.ts`: `requestAnimationFrame` with an accumulator, fixed 1/60 s ticks, frame gap clamped (e.g. 250 ms) to avoid catch-up bursts. One draw per frame.
- Screens: `playing`, `won`, `lost`. Win/lose show an overlay. Any tap or key restarts from a fresh state and new seed. No menu.

## Testing

Unit tests (Vitest), written test-first, one red-green-refactor cycle per rule:

- Gates: value steps on hit; `mul` copies and the cap fallback; `add` damage; `sub` reduction and removal at 0; each bullet affects a gate once; squad gate applies once and is consumed; `count` clamped at 0.
- Combat: damage and zombie removal; zombie reaching the squad removes a soldier.
- Squad: only `MAX_VISIBLE` fire individually, extra soldiers scale damage; movement clamped to lane.
- Stage: validation errors; each spawn fires exactly once; same seed gives same waves.
- End states: `lost`, `won`, simultaneous resolves to `lost`, `step` is a no-op after the game ends.
- Replay: scripted input and fixed seed over `stage1`, final state matches a stored snapshot.

Browser tests (Playwright), few: page loads with no console errors; canvas renders; pointer movement shifts the squad; a scripted run reaches won or lost and restarts.

## Workflow

Feature branch (`feature/core-engine`), a commit per red-green-refactor cycle, squashed to one commit before finishing. Behavior changes and refactors go in separate commits. Yarn scripts: `dev`, `build`, `test`, `test:e2e`, `typecheck`, `lint`. Run a Snyk code scan on new first-party code.
