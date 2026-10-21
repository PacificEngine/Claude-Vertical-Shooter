# Power-ups — Design (Piece 2 of 5)

Builds on `docs/superpowers/specs/2026-10-21-core-engine-design.md`. Adds shootable crates that drop pickups, and six power-ups the squad collects by walking into them.

## Scope

In: crates (stage data, shootable), pickups (walk into), one active timed power-up at a time, six power-ups (Tank, Spread, Shield, Rapid, Pierce, Bomb), placeholder rendering and HUD, crates added to stage 1.

Out: stacking power-ups, new art or sound, balance tuning beyond keeping stage 1 winnable, and the piece-1 follow-ups (squad hitbox vs. formation width, zombies hitting from below, gate-pair exclusivity, invisible multiplier copies).

## Approach

An active-power-up slot in `GameState` that existing rules consult, plus three new rules. `step` stays a flat pipeline of pure rules. No power-up registry or hooks (one active power-up at a time does not need them).

## State changes

```ts
type PowerKind = "tank" | "spread" | "shield" | "rapid" | "pierce" | "bomb";
type ActivePowerKind = Exclude<PowerKind, "bomb">;

type Crate  = { x: number; y: number; hp: number; power: PowerKind };
type Pickup = { x: number; y: number; power: PowerKind };

GameState += {
  crates: Crate[];
  pickups: Pickup[];
  power: { kind: ActivePowerKind; remaining: number; charges: number } | null;
  nextId: number;               // next zombie id
};
Bullet += { vx: number; pierce: boolean; hit: number[]; splash: number };  // defaults: 0, false, [], 0
Zombie += { id: number };
```

- `power.remaining` is seconds left; `charges` is only meaningful for the shield (0 otherwise).
- Bomb is instant and never stored in `power`.
- Collecting a non-bomb power-up replaces any active one and restarts the timer.
- `hit` lists zombie ids a piercing bullet has already damaged. `splash` is a blast radius (0 for normal bullets).
- Existing test factories gain defaults for the new fields (`makeZombie` assigns an id).

## Constants (starting values, all tunable in `constants.ts`)

`POWER_DURATION = { tank: 8, spread: 10, shield: 10, rapid: 8, pierce: 8 }`, `SHIELD_CHARGES = 5`, `BOMB_DAMAGE = 10`, `TANK_DAMAGE_MULT = 2`, `TANK_RATE_MULT = 3`, `TANK_SPLASH = 40`, `RAPID_RATE_MULT = 0.5`, `SPREAD_VX = 160`, `CRATE_SIZE = 28`, `PICKUP_SIZE = 24`.

## Stage format

```ts
Spawn += { at: number; type: "crate"; x: number; hp: number; power: PowerKind };
```

A crate spawns at `y = SPAWN_Y` when `scrollY` reaches `at`. `validateStage` additionally rejects a crate with `hp <= 0`, `x` outside `[0, WORLD_WIDTH]`, or an unknown `power`.

## Rules

New order: move, spawn, **powerTimer**, fire, bulletsVsGates, bulletsVsZombies, **bulletsVsCrates**, squadVsGates, **pickupsVsSquad**, zombiesVsSquad, end.

New rules:
- **powerTimer(state, dt):** `remaining -= dt`; `power` becomes `null` when `remaining <= 0`.
- **bulletsVsCrates:** a bullet overlaps a crate when `|dx| <= CRATE_SIZE/2` and `|dy| <= CRATE_SIZE/2`. The bullet is consumed (including piercing bullets and tank shells; shells do not splash crates) and deals its damage to `hp`. A crate at `hp <= 0` is removed and a `Pickup` of its `power` appears at the crate's position.
- **pickupsVsSquad:** a pickup is collected when `|squad.x - pickup.x| <= SQUAD_HALF_WIDTH + PICKUP_SIZE/2` and `|pickup.y - SQUAD_Y| <= PICKUP_SIZE`. It is removed. Bomb: every zombie with `y > 0` takes `BOMB_DAMAGE` and dead zombies are removed; `power` is untouched. Any other kind: `power = { kind, remaining: POWER_DURATION[kind], charges: kind === "shield" ? SHIELD_CHARGES : 0 }`.

Changes to existing rules:
- **moveRule:** also scrolls crates and pickups at `SCROLL_SPEED` and culls them once below `WORLD_HEIGHT + CRATE_SIZE`; applies `bullet.vx * dt` to `x`; culls bullets whose `x` is outside `[-BULLET_MARGIN, WORLD_WIDTH + BULLET_MARGIN]`.
- **spawnRule:** spawns crates; assigns each new zombie `id = nextId++`.
- **fireRule** (reads `power`; interval is chosen when firing and the timer is refilled with it):
  - rapid: interval `FIRE_INTERVAL * RAPID_RATE_MULT`.
  - spread: each visible soldier emits three bullets with `vx` of `-SPREAD_VX`, `0`, `+SPREAD_VX`; each has the normal damage. The `MAX_BULLETS` cap applies (excess bullets are dropped).
  - pierce: bullets are emitted with `pierce: true`.
  - tank: one shell per volley at `x = squad.x`, `y = SQUAD_Y`, `damage = BASE_DAMAGE * squad.count * TANK_DAMAGE_MULT` (no `MAX_VISIBLE` scaling), `splash = TANK_SPLASH`, interval `FIRE_INTERVAL * TANK_RATE_MULT`.
  - shield, none: unchanged.
- **bulletsVsZombies:**
  - pierce bullets are not consumed: each damages every overlapping zombie whose id is not in `hit` once and records the id.
  - a bullet with `splash > 0` is consumed on its first zombie hit and damages every zombie whose centre is within `splash` of the bullet position at full damage (the primary zombie included).
  - others behave as before.
- **zombiesVsSquad:** with `n` zombies reaching the squad and an active shield with `charges > 0`: `absorbed = min(n, charges)`; soldiers lost `= n - absorbed`; `charges -= absorbed`; the shield clears when `charges` reaches 0. All reaching zombies are removed as before.
- Bullet gates apply to every bullet kind (a x2 gate copies shells and piercing bullets, including `vx`, `pierce`, `hit` and `splash`; each copy gets its own `hit` array).

## Rendering and HUD (placeholder shapes; `arc` stays reserved for soldiers)

- Crates: brown squares with remaining hp and a label of the contents (`TANK`, `SPRD`, `SHLD`, `RAPD`, `PRCE`, `BOMB`).
- Pickups: coloured diamonds (rotated `fillRect`) with the same label.
- Tank mode: the squad is drawn as one tank (hull and barrel from rectangles) instead of soldier circles; the squad count text stays. Shells are drawn larger; piercing bullets use a distinct colour.
- Shield: a `strokeRect` outline around the squad.
- HUD: active power name, a time bar (`remaining / POWER_DURATION[kind]`), and shield charges.
- No changes to `input/` or `main.ts`.

## Stage 1

Add roughly one crate per power-up spaced along the stage (bomb and tank later, near the heavy waves). The replay snapshot is regenerated and reviewed by hand. The "sweeping player wins" test is unchanged; if the added crates break it, retune stage data, not the assertion.

## Testing

Unit tests (Vitest), test-first, one red-green-refactor cycle per behavior:
- `bulletsVsCrates`: damage, bullet consumed, destruction leaves a pickup, misses, piercing bullets stop at crates.
- `pickupsVsSquad`: collection sets `power` correctly, replaces the active power, bomb damages and removes zombies without touching `power`, out-of-reach pickups ignored.
- `powerTimer`: counts down, clears at 0.
- `fire`: rapid interval, spread bullets and `vx`, spread respects the cap, pierce flag, tank shell damage, rate and splash.
- `bulletsVsZombies`: piercing bullets survive and hurt each zombie once; tank splash hits all zombies in range and consumes the shell.
- `zombiesVsSquad`: shield absorbs and spends charges, ends at 0, overflow still costs soldiers.
- Move/spawn/validation: crates and pickups scroll and are culled, `vx` movement and sideways culling, crate spawns, zombie ids deterministic, `validateStage` rejects bad crates.
- Renderer: crate and pickup labels, tank mode draws no soldier arcs, HUD text.
- Stage 1 replay snapshot (final state), winnable.

Browser tests (Playwright): the existing four stay green; at most one added smoke check that a crate appears, via the debug hook.

## Workflow

Branch `feature/power-ups` cut from `main`. A commit per red-green-refactor cycle, squashed to one before finishing. Behavior changes and refactors go in separate commits. No Snyk scan in this repo.
