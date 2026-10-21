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
