import type { FieldSegment } from "./types";
import { TYPE_CONFIG } from "./utils";
import FlagsSegmentCell from "./FlagsSegmentCell";
import CompositeSegmentCell from "./CompositeSegmentCell";

function getFieldDisplayValue(field: FieldSegment["field"]): string {
  switch (field.type) {
    case "uint":
      return `uint${field.sizeBytes * 8}`;
    case "ascii":
      return field.asciiFixedSize ? `${field.sizeBytes}B` : "var";
    case "hex":
      return field.asciiFixedSize ? `${field.sizeBytes}B` : "var";
    case "ipv4":
      return "A.B.C.D";
    case "enum": {
      const count = field.enumOptions?.length ?? 0;
      return `${count} vals`;
    }
    case "padding":
      return `0x${(field.paddingByte ?? 0)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()}×${field.sizeBytes}`;
    case "flags":
      return "";
    case "composite": {
      const count = field.subFields?.length ?? 0;
      return `{${count} sub}`;
    }
    default:
      return "";
  }
}

export default function SegmentCell({ segment }: { segment: FieldSegment }) {
  const { field, widthBits, isStart, isEnd } = segment;

  if (field.type === "flags") return <FlagsSegmentCell segment={segment} />;
  if (field.type === "composite") return <CompositeSegmentCell segment={segment} />;

  const config = TYPE_CONFIG[field.type];
  const pct = (widthBits / 32) * 100;
  const displayValue = getFieldDisplayValue(field);

  const borderL = isStart ? `border-l-2 ${config.border}` : "border-l border-zinc-700/30";
  const borderR = isEnd ? `border-r-2 ${config.border}` : "border-r border-zinc-700/30";

  return (
    <div
      title={`${field.name}${displayValue ? " · " + displayValue : ""}${field.meaning ? " — " + field.meaning : ""}`}
      className={`relative flex flex-col items-center justify-center h-16 ${config.bg} ${borderL} ${borderR} overflow-hidden`}
      style={{ width: `${pct}%` }}
    >
      {!isStart && (
        <div className="absolute top-0 left-0 border-l-10 border-l-zinc-600/60 border-b-10 border-b-transparent" />
      )}
      {!isEnd && (
        <div className="absolute top-0 right-0 border-r-10 border-r-zinc-600/60 border-b-10 border-b-transparent" />
      )}
      <span className={`${config.text} text-xs font-mono font-bold leading-tight truncate w-full text-center px-1`}>
        {field.name}
      </span>
      {displayValue && (
        <span className="text-zinc-400 text-[10px] font-mono leading-none truncate w-full text-center px-1 mt-0.5">
          {displayValue.length > 16 ? displayValue.slice(0, 14) + "…" : displayValue}
        </span>
      )}
    </div>
  );
}
