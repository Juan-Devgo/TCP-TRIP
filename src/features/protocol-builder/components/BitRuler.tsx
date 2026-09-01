import { cn } from "@/lib/utils";
import type { RulerWidth } from "@/features/protocol-builder/lib/protocol";

/**
 * The bit scale the diagram is drawn against — a number every four bits and a
 * tick under every bit, the header a student reads at the top of an RFC:
 *
 * ```
 * 0       4       8      12      16      20      24      28      32
 * | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |
 * ```
 *
 * It is one grid of `width` columns, the same grid every diagram row uses, so
 * a field spanning `n` columns lands exactly under the bits it occupies.
 */
export function BitRuler({
  width,
  className,
}: {
  width: RulerWidth;
  className?: string;
}) {
  return (
    // The offsets are repeated in every cell's own label, so a screen reader
    // gains nothing from the marks themselves.
    <div aria-hidden className={cn("relative h-7 select-none", className)}>
      <div
        className="grid h-full"
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: width }, (_, bit) => (
          <div key={bit} className="relative">
            {bit % 4 === 0 && (
              <span
                className={cn(
                  "absolute top-0 font-mono text-[10px] tabular-nums text-muted-foreground",
                  // The number belongs to the line *before* the column, so it
                  // straddles it — except at zero, where it would be clipped.
                  bit === 0 ? "left-0" : "left-0 -translate-x-1/2",
                )}
              >
                {bit}
              </span>
            )}
            <span
              className={cn(
                "absolute bottom-0 left-0 w-px",
                bit % 4 === 0 ? "h-3 bg-foreground/40" : "h-2 bg-border",
              )}
            />
          </div>
        ))}
      </div>

      {/* The closing edge: the ruler's own width, at the far right. */}
      <span className="absolute top-0 right-0 translate-x-1/2 font-mono text-[10px] tabular-nums text-muted-foreground">
        {width}
      </span>
      <span className="absolute right-0 bottom-0 h-3 w-px bg-foreground/40" />
    </div>
  );
}
