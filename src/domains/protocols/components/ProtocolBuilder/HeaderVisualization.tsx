import { useMemo } from "react";
import type { Protocol, ProtocolField } from "../../types";
import { TYPE_CONFIG, getFieldBitSize, computeFieldOffsets } from "./utils";
import type { FieldSegment } from "./types";
import BitRuler from "./BitRuler";
import DiagramRow from "./DiagramRow";

function computeRowSegments(
  fields: ProtocolField[],
  offsets: number[],
  rowIndex: number,
): FieldSegment[] {
  const rowStart = rowIndex * 32;
  const rowEnd = rowStart + 32;
  const segments: FieldSegment[] = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!;
    const fieldStart = offsets[i]!;
    const fieldEnd = fieldStart + getFieldBitSize(field);

    if (fieldEnd <= rowStart || fieldStart >= rowEnd) continue;

    const segStart = Math.max(fieldStart, rowStart);
    const segEnd = Math.min(fieldEnd, rowEnd);

    segments.push({
      field,
      startBitInRow: segStart - rowStart,
      widthBits: segEnd - segStart,
      isStart: fieldStart >= rowStart,
      isEnd: fieldEnd <= rowEnd,
      bitOffsetInField: segStart - fieldStart,
    });
  }

  return segments;
}

export default function HeaderVisualization({ protocol }: { protocol: Protocol }) {
  const { fields } = protocol;

  const { offsets, totalBits, numRows } = useMemo(() => {
    if (fields.length === 0)
      return { offsets: [] as number[], totalBits: 0, numRows: 0 };
    const offsets = computeFieldOffsets(fields);
    const last = fields[fields.length - 1]!;
    const totalBits = offsets[fields.length - 1]! + getFieldBitSize(last);
    const numRows = Math.max(1, Math.ceil(totalBits / 32));
    return { offsets, totalBits, numRows };
  }, [fields]);

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-zinc-500 text-sm font-mono">
        Sin campos definidos
      </div>
    );
  }

  const totalBytes = totalBits / 8;

  return (
    <div className="space-y-3">
      {/* Summary badge */}
      <div className="text-center">
        <span className="text-zinc-300 text-xs font-mono bg-zinc-800/60 px-4 py-1.5 rounded-full border border-zinc-700/50">
          {totalBytes % 1 === 0 ? totalBytes : totalBytes.toFixed(2)} bytes ·{" "}
          {totalBits} bits total
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-130">
          <BitRuler />
          {Array.from({ length: numRows }, (_, rowIndex) => {
            const segments = computeRowSegments(fields, offsets, rowIndex);
            return (
              <div key={rowIndex}>
                <div className="h-px bg-zinc-600/70" />
                <DiagramRow
                  segments={segments}
                  totalBits={totalBits}
                  rowIndex={rowIndex}
                />
              </div>
            );
          })}
          <div className="h-px bg-zinc-600/70" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        {(
          Object.entries(TYPE_CONFIG) as [
            keyof typeof TYPE_CONFIG,
            (typeof TYPE_CONFIG)[keyof typeof TYPE_CONFIG],
          ][]
        ).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm shrink-0 ${cfg.dot}`} />
            <span className="text-zinc-400 text-xs font-mono">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
