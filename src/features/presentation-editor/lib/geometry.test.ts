import { describe, expect, test } from "bun:test";

import {
  intersects,
  marquee,
  rotatedBounds,
  ROTATION_SNAPS,
} from "@/features/presentation-editor/lib/geometry";

function rounded(bounds: ReturnType<typeof rotatedBounds>) {
  return Object.fromEntries(
    Object.entries(bounds).map(([key, value]) => [key, Math.round(value)]),
  );
}

describe("rotatedBounds", () => {
  test("an upright box covers exactly itself", () => {
    expect(rotatedBounds({ x: 10, y: 20, width: 100, height: 50, rotation: 0 })).toEqual({
      left: 10,
      top: 20,
      right: 110,
      bottom: 70,
    });
  });

  test("a quarter turn swings the box down-left of its top-left corner", () => {
    // Konva rotates clockwise around (x, y): the width now runs downwards and
    // the height sticks out to the left.
    expect(
      rounded(rotatedBounds({ x: 100, y: 100, width: 200, height: 50, rotation: 90 })),
    ).toEqual({ left: 50, top: 100, right: 100, bottom: 300 });
  });

  test("a half turn covers the mirror of the box", () => {
    expect(
      rounded(rotatedBounds({ x: 300, y: 300, width: 100, height: 40, rotation: 180 })),
    ).toEqual({ left: 200, top: 260, right: 300, bottom: 300 });
  });
});

test("rotation snaps every 45 degrees", () => {
  expect(ROTATION_SNAPS).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
});

describe("the selection marquee", () => {
  test("is the same box whichever way it is drawn", () => {
    expect(marquee({ x: 50, y: 10 }, { x: 0, y: 40 })).toEqual({
      left: 0,
      top: 10,
      right: 50,
      bottom: 40,
    });
  });

  test("catches what it overlaps and misses what it does not", () => {
    const area = marquee({ x: 0, y: 0 }, { x: 100, y: 100 });

    expect(intersects(area, { left: 90, top: 90, right: 200, bottom: 200 })).toBe(true);
    expect(intersects(area, { left: 101, top: 0, right: 200, bottom: 50 })).toBe(false);
  });
});
