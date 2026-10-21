import { describe, expect, it } from "vitest";
import { soldierOffsets } from "./formation";

describe("soldierOffsets", () => {
  it("places one soldier at the centre", () => {
    expect(soldierOffsets(1)).toEqual([{ dx: 0, dy: 0 }]);
  });

  it("centres each row, with a partial last row", () => {
    expect(soldierOffsets(3)).toEqual([
      { dx: -7, dy: 0 },
      { dx: 7, dy: 0 },
      { dx: 0, dy: 14 },
    ]);
  });

  it("returns nothing for zero soldiers", () => {
    expect(soldierOffsets(0)).toEqual([]);
  });
});
