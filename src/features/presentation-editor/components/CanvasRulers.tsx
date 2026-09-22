import type { PresentationCanvas } from "@/lib/presentations/contract";
import { cn } from "@/lib/utils";

/** Ruler thickness in **screen** pixels: it does not zoom with the slide. */
export const RULER_SIZE = 18;

/** A tick every 100 canvas units, a number every 200 — 1920 stays readable. */
const TICK = 100;
const LABEL_EVERY = 200;

/**
 * The rulers around the canvas.
 *
 * They read in **canvas units** (the coordinates the document stores), not in
 * screen pixels, so a teacher lining two slides up by eye can instead line them
 * up by number — and the numbers are the same ones the inspector shows.
 *
 * The selected element paints a band on both rulers. That is the part that
 * actually guides: it shows where the element starts and ends on each axis
 * while it is being dragged.
 */
export function CanvasRulers({
  axis,
  canvas,
  scale,
  from,
  to,
}: {
  axis: "x" | "y";
  canvas: PresentationCanvas;
  /** Screen pixels per canvas unit. */
  scale: number;
  /** The selected element's extent on this axis, in canvas units. */
  from?: number;
  to?: number;
}) {
  const length = axis === "x" ? canvas.width : canvas.height;
  const ticks: number[] = [];
  for (let at = 0; at <= length; at += TICK) ticks.push(at);

  const band =
    from === undefined || to === undefined
      ? null
      : { start: Math.min(from, to) * scale, size: Math.abs(to - from) * scale };

  return (
    <div
      aria-hidden
      className={cn(
        "bg-muted/40 text-muted-foreground relative overflow-hidden text-[9px] select-none",
        axis === "x" ? "border-b" : "border-r",
        "border-border",
      )}
      style={
        axis === "x"
          ? { height: RULER_SIZE, width: length * scale }
          : { width: RULER_SIZE, height: length * scale }
      }
    >
      {band && (
        <div
          className="bg-primary/25 absolute"
          style={
            axis === "x"
              ? { left: band.start, width: band.size, top: 0, bottom: 0 }
              : { top: band.start, height: band.size, left: 0, right: 0 }
          }
        />
      )}

      {ticks.map((at) => {
        const labelled = at % LABEL_EVERY === 0;
        const offset = at * scale;

        return (
          <div key={at}>
            <div
              className="bg-border absolute"
              style={
                axis === "x"
                  ? { left: offset, top: labelled ? 0 : RULER_SIZE / 2, bottom: 0, width: 1 }
                  : { top: offset, left: labelled ? 0 : RULER_SIZE / 2, right: 0, height: 1 }
              }
            />
            {labelled && at > 0 && (
              <span
                className="absolute font-mono leading-none"
                style={
                  axis === "x"
                    ? { left: offset + 2, top: 1 }
                    : // The vertical ruler is too narrow for a number lying
                      // flat, so it reads along the ruler instead.
                      {
                        top: offset + 2,
                        left: 1,
                        transform: "rotate(90deg)",
                        transformOrigin: "left top",
                      }
                }
              >
                {at}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
