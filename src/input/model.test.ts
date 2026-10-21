import { describe, expect, it } from "vitest";
import { KEY_SPEED, WORLD_WIDTH } from "../core/constants";
import { InputModel } from "./model";

describe("InputModel", () => {
  it("starts at the centre of the lane", () => {
    expect(new InputModel().update(0.1).targetX).toBe(WORLD_WIDTH / 2);
  });

  it("follows the pointer", () => {
    const input = new InputModel();
    input.setPointer(80);
    expect(input.update(0.1).targetX).toBe(80);
  });

  it("nudges right while a right key is held", () => {
    const input = new InputModel();
    input.keyDown("ArrowRight");
    expect(input.update(0.1).targetX).toBeCloseTo(WORLD_WIDTH / 2 + KEY_SPEED * 0.1);
  });

  it("nudges left for A and ArrowLeft, case-insensitively", () => {
    const a = new InputModel();
    a.keyDown("A");
    expect(a.update(0.1).targetX).toBeCloseTo(WORLD_WIDTH / 2 - KEY_SPEED * 0.1);
    const arrow = new InputModel();
    arrow.keyDown("ArrowLeft");
    expect(arrow.update(0.1).targetX).toBeCloseTo(WORLD_WIDTH / 2 - KEY_SPEED * 0.1);
  });

  it("stops when the key is released", () => {
    const input = new InputModel();
    input.keyDown("d");
    input.update(0.1);
    input.keyUp("d");
    const held = input.update(0.1).targetX;
    expect(input.update(0.1).targetX).toBe(held);
  });

  it("cancels out when both directions are held", () => {
    const input = new InputModel();
    input.keyDown("a");
    input.keyDown("d");
    expect(input.update(0.1).targetX).toBe(WORLD_WIDTH / 2);
  });

  it("keeps the target inside the lane", () => {
    const input = new InputModel();
    input.keyDown("d");
    expect(input.update(10).targetX).toBe(WORLD_WIDTH);
  });

  it("lets the most recent source win", () => {
    const input = new InputModel();
    input.keyDown("d");
    input.update(0.1);
    input.setPointer(40);
    input.keyUp("d");
    expect(input.update(0.1).targetX).toBe(40);
  });

  it("ignores other keys", () => {
    const input = new InputModel();
    input.keyDown(" ");
    expect(input.update(0.1).targetX).toBe(WORLD_WIDTH / 2);
  });

  it("stops nudging after releaseAll", () => {
    const input = new InputModel();
    input.keyDown("d");
    const before = input.update(0.1).targetX;
    input.releaseAll();
    expect(input.update(0.1).targetX).toBe(before);
  });
});
