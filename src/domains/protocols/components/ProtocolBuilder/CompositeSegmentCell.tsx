import type { SubField } from "../../types";
import type { FieldSegment } from "./types";
import { TYPE_CONFIG } from "./utils";

export default function CompositeSegmentCell({ segment }: { segment: FieldSegment }) {
  const { field, widthBits, bitOffsetInField } = segment;
  const pct = (widthBits / 32) * 100;
  const subFields: SubField[] = field.subFields ?? [];
  const totalFieldBits = field.sizeBytes * 8;

  const segStart = bitOffsetInField;
  const segEnd = bitOffsetInField + widthBits;

  interface VisibleSub {
    sf: SubField;
    widthInSeg: number;
  }

  const visibleSubs: VisibleSub[] = [];
  let pos = 0;
  for (const sf of subFields) {
    const sfStart = pos;
    const sfEnd = pos + sf.sizeBits;
    if (sfEnd > segStart && sfStart < segEnd) {
      const visWidth = Math.min(sfEnd, segEnd) - Math.max(sfStart, segStart);
      visibleSubs.push({ sf, widthInSeg: visWidth });
    }
    pos += sf.sizeBits;
  }

  const assignedBits = subFields.reduce((s, sf) => s + sf.sizeBits, 0);
  const unassignedStart = assignedBits;
  const unassignedEnd = totalFieldBits;
  const unassignedTotal = totalFieldBits - assignedBits;
  let unassignedVisWidth = 0;
  if (
    unassignedTotal > 0 &&
    unassignedEnd > segStart &&
    unassignedStart < segEnd
  ) {
    unassignedVisWidth =
      Math.min(unassignedEnd, segEnd) - Math.max(unassignedStart, segStart);
  }

  return (
    <div
      className="flex h-16 overflow-hidden border-l-2 border-r-2 border-fuchsia-600/50"
      style={{ width: `${pct}%` }}
    >
      {visibleSubs.length === 0 && unassignedVisWidth === 0 ? (
        <div className="flex-1 bg-fuchsia-900/40 flex items-center justify-center">
          <span className="text-fuchsia-400 text-xs font-mono truncate px-1">
            {field.name}
          </span>
        </div>
      ) : (
        <>
          {visibleSubs.map(({ sf, widthInSeg }, i) => {
            const subPct = (widthInSeg / widthBits) * 100;
            const sfCfg = TYPE_CONFIG[sf.type] ?? TYPE_CONFIG.uint;
            return (
              <div
                key={`${sf.id}-${i}`}
                title={`${sf.name} · ${sf.type} · ${sf.sizeBits}b${sf.meaning ? ` — ${sf.meaning}` : ""}`}
                className={`flex flex-col items-center justify-center ${sfCfg.bg} border-r ${sfCfg.border} last:border-r-0 overflow-hidden px-0.5`}
                style={{ width: `${subPct}%` }}
              >
                <span className={`text-sm font-mono font-semibold ${sfCfg.text} leading-none truncate w-full text-center`}>
                  {sf.name.length > 6 ? sf.name.slice(0, 6) : sf.name}
                </span>
                <span className={`text-xs font-mono ${sfCfg.text} opacity-60 leading-none mt-0.5`}>
                  {sf.sizeBits}b
                </span>
              </div>
            );
          })}
          {unassignedVisWidth > 0 && (
            <div
              title={`${unassignedTotal} bits sin asignar`}
              className="flex flex-col items-center justify-center bg-fuchsia-950/60 border-l border-dashed border-fuchsia-600/50 overflow-hidden px-px"
              style={{ width: `${(unassignedVisWidth / widthBits) * 100}%` }}
            >
              <span className="text-xs font-mono text-fuchsia-500 leading-none">?</span>
              <span className="text-[8px] font-mono text-fuchsia-700/60 leading-none mt-0.5">
                {unassignedTotal}b
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
