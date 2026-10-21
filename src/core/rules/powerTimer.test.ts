import { describe, expect, it } from "vitest";
import { makeState } from "../testing";
import { powerTimer } from "./powerTimer";

describe("powerTimer", () => {
  it("returns the same state when no power-up is active", () => {
    const state = makeState();
    expect(powerTimer(state, 0.1)).toBe(state);
  });

  it("counts the active power-up down", () => {
    const next = powerTimer(makeState({ power: { kind: "rapid", remaining: 5, charges: 0 } }), 0.5);
    expect(next.power).toEqual({ kind: "rapid", remaining: 4.5, charges: 0 });
  });

  it("clears the power-up when time runs out", () => {
    const next = powerTimer(makeState({ power: { kind: "rapid", remaining: 0.05, charges: 0 } }), 0.1);
    expect(next.power).toBeNull();
  });

  it("clears the power-up when the remaining time is exactly used up", () => {
    const next = powerTimer(makeState({ power: { kind: "rapid", remaining: 0.1, charges: 0 } }), 0.1);
    expect(next.power).toBeNull();
  });
});
