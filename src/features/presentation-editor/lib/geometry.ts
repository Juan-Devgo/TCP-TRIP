/**
 * Canvas geometry the editor needs outside Konva — pure, so it is tested
 * without a stage.
 */

/** The alignment grid, in canvas units. The rulers tick on the same lines. */
export const GRID = 120;

/**
 * The angles the transformer's rotate handle settles on: every 45°, caught
 * within `ROTATION_SNAP_TOLERANCE` of each.
 */
export const ROTATION_SNAPS = Array.from({ length: 8 }, (_unused, index) => index * 45);
export const ROTATION_SNAP_TOLERANCE = 10;

export type Box = { x: number; y: number; width: number; height: number; rotation: number };

export type Bounds = { left: number; top: number; right: number; bottom: number };

/**
 * The axis-aligned box a rotated element actually covers.
 *
 * Konva turns a node around its own origin — the element's top-left corner,
 * `(x, y)` — so a rotated box is its four corners turned around that point.
 * Reading `x … x + width` instead is what made a turned element's ruler band
 * drift off to the right of the element.
 */
export function rotatedBounds(box: Box): Bounds {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const corners = [
    [0, 0],
    [box.width, 0],
    [box.width, box.height],
    [0, box.height],
  ].map(([dx = 0, dy = 0]) => ({
    x: box.x + dx * cos - dy * sin,
    y: box.y + dx * sin + dy * cos,
  }));

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

/** The box between two corners of a drag, whichever way it was drawn. */
export function marquee(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Bounds {
  return {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x),
    bottom: Math.max(from.y, to.y),
  };
}

/** Whether two boxes overlap at all — touching the marquee is enough to be in it. */
export function intersects(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}
