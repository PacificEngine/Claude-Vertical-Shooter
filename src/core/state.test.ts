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
    expect(state.crates).toEqual([]);
    expect(state.pickups).toEqual([]);
    expect(state.power).toBeNull();
    expect(state.nextId).toBe(0);
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
