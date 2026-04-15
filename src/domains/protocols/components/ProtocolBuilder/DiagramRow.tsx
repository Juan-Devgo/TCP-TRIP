import type { ReactNode } from "react";
import type { FieldSegment } from "./types";
import SegmentCell from "./SegmentCell";

interface DiagramRowProps {
  segments: FieldSegment[];
  totalBits: number;
  rowIndex: number;
}

export default function DiagramRow({ segments, totalBits, rowIndex }: DiagramRowProps) {
  const cells: ReactNode[] = [];
  let cursor = 0;

  for (const seg of segments) {
    if (seg.startBitInRow > cursor) {
      const gapPct = ((seg.startBitInRow - cursor) / 32) * 100;
      cells.push(
        <div
          key={`gap-${cursor}`}
          className="h-16 bg-zinc-800/20 border-x border-dashed border-zinc-700/30"
          style={{ width: `${gapPct}%` }}
        />,
      );
    }
    cells.push(
      <SegmentCell key={`${seg.field.id}-${seg.startBitInRow}`} segment={seg} />,
    );
    cursor = seg.startBitInRow + seg.widthBits;
  }

  const rowStart = rowIndex * 32;
  const rowActualEnd = Math.min(totalBits - rowStart, 32);
  if (cursor < rowActualEnd) {
    const remPct = ((rowActualEnd - cursor) / 32) * 100;
    cells.push(
      <div
        key="rem"
        className="h-16 bg-zinc-800/20 border-x border-dashed border-zinc-700/30"
        style={{ width: `${remPct}%` }}
      />,
    );
  }

  return <div className="flex w-full">{cells}</div>;
}
