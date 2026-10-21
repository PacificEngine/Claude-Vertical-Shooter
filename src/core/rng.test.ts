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
