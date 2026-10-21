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
