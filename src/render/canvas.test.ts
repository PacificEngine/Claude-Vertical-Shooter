import { describe, expect, it } from "vitest";
import { MAX_VISIBLE } from "../core/constants";
import { makeBullet, makeCrate, makeGate, makePickup, makeState } from "../core/testing";
import type { GameState } from "../core/types";
import { draw, gateLabel, powerLabel } from "./canvas";

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

describe("powerLabel", () => {
  it("names every power-up", () => {
    expect(["tank", "spread", "shield", "rapid", "pierce", "bomb"].map((k) => powerLabel(k as never))).toEqual([
      "TANK", "SPRD", "SHLD", "RAPD", "PRCE", "BOMB",
    ]);
  });
});

describe("draw with power-ups", () => {
  it("labels crates with their contents and hit points", () => {
    const shown = texts(render(makeState({ crates: [makeCrate({ power: "tank", hp: 4 })] })));
    expect(shown).toContain("TANK");
    expect(shown).toContain("4");
  });

  it("labels pickups without using arcs", () => {
    const calls = render(makeState({ squad: { x: 200, count: 0 }, pickups: [makePickup({ power: "bomb" })] }));
    expect(texts(calls)).toContain("BOMB");
    expect(calls.filter((c) => c.name === "arc")).toHaveLength(0);
  });

  it("draws the squad as a tank, not soldier circles, and keeps the count", () => {
    const calls = render(
      makeState({ squad: { x: 200, count: 7 }, power: { kind: "tank", remaining: 4, charges: 0 } }),
    );
    expect(calls.filter((c) => c.name === "arc")).toHaveLength(0);
    expect(texts(calls)).toContain("7");
  });

  it("shows the HUD with the power name and a time bar", () => {
    const calls = render(makeState({ power: { kind: "rapid", remaining: 4, charges: 0 } }));
    expect(texts(calls)).toContain("RAPD");
    expect(calls.some((c) => c.name === "fillRect" && c.args[2] === 50)).toBe(true); // 4s of 8s on a 100-wide bar
  });

  it("shows shield charges and an outline", () => {
    const calls = render(makeState({ power: { kind: "shield", remaining: 5, charges: 3 } }));
    expect(texts(calls)).toContain("SHLD");
    expect(texts(calls)).toContain("3 left");
    expect(calls.some((c) => c.name === "strokeRect")).toBe(true);
  });

  it("shows no power HUD when nothing is active", () => {
    const shown = texts(render(makeState()));
    expect(shown).not.toContain("TANK");
    expect(shown).not.toContain("RAPD");
  });

  it("draws bullets of every kind", () => {
    const calls = render(
      makeState({
        bullets: [makeBullet(), makeBullet({ pierce: true }), makeBullet({ splash: 40 })],
      }),
    );
    expect(calls.filter((c) => c.name === "fillRect").length).toBeGreaterThanOrEqual(3);
  });
});
