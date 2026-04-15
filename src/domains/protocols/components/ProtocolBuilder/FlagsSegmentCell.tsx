import type { FieldSegment } from "./types";

export default function FlagsSegmentCell({ segment }: { segment: FieldSegment }) {
  const { field, widthBits, bitOffsetInField } = segment;
  const pct = (widthBits / 32) * 100;
  const bits = (field.flagBits ?? []).slice(
    bitOffsetInField,
    bitOffsetInField + widthBits,
  );

  return (
    <div className="flex h-16 overflow-hidden" style={{ width: `${pct}%` }}>
      {bits.map((bit, i) => (
        <div
          key={i}
          title={`${bit.name}${bit.reserved ? " (reservado)" : ""}`}
          className={`flex-1 flex items-center justify-center border-r border-zinc-700/60 last:border-r-0 ${
            bit.reserved
              ? "bg-zinc-700/40 text-zinc-400"
              : "bg-amber-900/50 text-amber-300"
          }`}
        >
          <span className="text-sm font-mono font-bold leading-none truncate px-px">
            {bit.reserved ? "R" : bit.name.slice(0, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}
