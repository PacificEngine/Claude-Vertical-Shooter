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
      rng: state.rng,
      squad: state.squad,
      scrollY: Math.round(state.stage.scrollY * 1000) / 1000,
      gateValues: state.gates.map((g) => g.value),
    }).toMatchSnapshot();
  });
});
