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
