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
    expect(next.zombies).toEqual([{ id: 0, x: 100, y: SPAWN_Y, hp: 3, speed: 40 }]);
    expect(next.stage.spawnCursor).toBe(1);
  });

  it("gives zombies unique sequential ids and advances nextId", () => {
    const wave: Spawn = { at: 0, type: "zombieWave", count: 3, hp: 1, speed: 30, spread: [0, 400] };
    const next = spawnRule(withSpawns([wave], 0, { nextId: 7 }));
    expect(next.zombies.map((z) => z.id)).toEqual([7, 8, 9]);
    expect(next.nextId).toBe(10);
  });

  it("does not spend ids on zombies dropped by the MAX_ZOMBIES cap", () => {
    const crowd = Array.from({ length: MAX_ZOMBIES }, () => makeZombie());
    const next = spawnRule(withSpawns([zombie], 5, { zombies: crowd, nextId: 4 }));
    expect(next.nextId).toBe(4);
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

  it("spawns a crate at the top once, with its contents", () => {
    const crate: Spawn = { at: 5, type: "crate", x: 150, hp: 4, power: "tank" };
    const once = spawnRule(withSpawns([crate], 5));
    expect(once.crates).toEqual([{ x: 150, y: SPAWN_Y, hp: 4, power: "tank" }]);
    expect(spawnRule(once).crates).toHaveLength(1);
  });

  it("drops zombies beyond MAX_ZOMBIES but still consumes the spawn", () => {
    const crowd = Array.from({ length: MAX_ZOMBIES }, () => makeZombie());
    const next = spawnRule(withSpawns([zombie], 5, { zombies: crowd }));
    expect(next.zombies).toHaveLength(MAX_ZOMBIES);
    expect(next.stage.spawnCursor).toBe(1);
  });
});
