import { describe, expect, it } from "vitest";
import { SQUAD_Y } from "../constants";
import { makeGate, makeState } from "../testing";
import type { Gate } from "../types";
import { squadVsGates } from "./squadVsGates";

const run = (count: number, gate: Partial<Gate>) =>
  squadVsGates(
    makeState({ squad: { x: 200, count }, gates: [makeGate({ kind: "squad", y: SQUAD_Y, ...gate })] }),
  );

describe("squadVsGates", () => {
  it("adds soldiers and consumes the gate", () => {
    const next = run(5, { op: "add", value: 3 });
    expect(next.squad.count).toBe(8);
    expect(next.gates).toHaveLength(0);
  });

  it("subtracts soldiers", () => {
    expect(run(5, { op: "sub", value: -3 }).squad.count).toBe(2);
  });

  it("never drops below zero", () => {
    expect(run(2, { op: "sub", value: -10 }).squad.count).toBe(0);
  });

  it("multiplies soldiers", () => {
    expect(run(5, { op: "mul", value: 3 }).squad.count).toBe(15);
  });

  it("does not trigger when the squad is outside the gate horizontally", () => {
    const next = run(5, { op: "add", value: 3, x: 50, width: 60 });
    expect(next.squad.count).toBe(5);
    expect(next.gates).toHaveLength(1);
  });

  it("does not trigger before the gate reaches the squad", () => {
    const next = run(5, { op: "add", value: 3, y: SQUAD_Y - 100 });
    expect(next.squad.count).toBe(5);
    expect(next.gates).toHaveLength(1);
  });

  it("ignores bullet gates", () => {
    const next = run(5, { kind: "bullet", op: "add", value: 3 });
    expect(next.squad.count).toBe(5);
    expect(next.gates).toHaveLength(1);
  });

  it("applies several gates in order", () => {
    const next = squadVsGates(
      makeState({
        squad: { x: 200, count: 5 },
        gates: [
          makeGate({ id: 1, kind: "squad", y: SQUAD_Y, op: "mul", value: 2 }),
          makeGate({ id: 2, kind: "squad", y: SQUAD_Y, op: "add", value: 1 }),
        ],
      }),
    );
    expect(next.squad.count).toBe(11);
  });
});
