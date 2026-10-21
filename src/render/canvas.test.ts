import { describe, expect, it } from "vitest";
import { MAX_VISIBLE } from "../core/constants";
import { makeGate, makeState } from "../core/testing";
import type { GameState } from "../core/types";
import { draw, gateLabel } from "./canvas";

function fakeContext() {
  const calls: { name: string; args: unknown[] }[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, name: string) => (...args: unknown[]) => {
        calls.push({ name, args });
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const render = (state: GameState) => {
  const { ctx, calls } = fakeContext();
  draw(ctx, state, { width: 800, height: 1400 });
  return calls;
};
const texts = (calls: { name: string; args: unknown[] }[]) =>
  calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);

describe("gateLabel", () => {
  it("formats each op", () => {
    expect(gateLabel({ op: "add", value: 5 })).toBe("+5");
    expect(gateLabel({ op: "sub", value: -100 })).toBe("-100");
    expect(gateLabel({ op: "mul", value: 2 })).toBe("x2");
  });
});

describe("draw", () => {
  it("draws one circle per visible soldier", () => {
    const calls = render(makeState({ squad: { x: 200, count: 3 } }));
    expect(calls.filter((c) => c.name === "arc")).toHaveLength(3);
  });

  it("caps drawn soldiers at MAX_VISIBLE", () => {
    const calls = render(makeState({ squad: { x: 200, count: 500 } }));
    expect(calls.filter((c) => c.name === "arc")).toHaveLength(MAX_VISIBLE);
  });

  it("labels gates and shows the squad count", () => {
    const calls = render(
      makeState({ squad: { x: 200, count: 7 }, gates: [makeGate({ op: "mul", value: 3 })] }),
    );
    expect(texts(calls)).toContain("x3");
    expect(texts(calls)).toContain("7");
  });

  it("shows no overlay while playing", () => {
    const shown = texts(render(makeState()));
    expect(shown).not.toContain("GAME OVER");
    expect(shown).not.toContain("YOU WIN");
  });

  it("shows overlays when the game ends", () => {
    expect(texts(render(makeState({ status: "lost" })))).toContain("GAME OVER");
    const won = texts(render(makeState({ status: "won" })));
    expect(won).toContain("YOU WIN");
    expect(won).toContain("Tap or press any key to restart");
  });
});
