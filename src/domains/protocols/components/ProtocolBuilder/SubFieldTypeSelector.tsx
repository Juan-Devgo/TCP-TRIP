import type { SubFieldType } from "../../types";
import { TYPE_CONFIG } from "./utils";

const SUB_FIELD_TYPES: SubFieldType[] = [
  "uint",
  "flags",
  "ascii",
  "hex",
  "padding",
  "enum",
];

export default function SubFieldTypeSelector({
  value,
  onChange,
}: {
  value: SubFieldType;
  onChange: (t: SubFieldType) => void;
}) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {SUB_FIELD_TYPES.map((t) => {
        const cfg = TYPE_CONFIG[t];
        const isSelected = t === value;
        return (
          <button
            key={t}
            type="button"
            title={cfg.labelFull}
            onClick={() => onChange(t)}
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer select-none ${
              isSelected
                ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                : "bg-zinc-900 border-zinc-700 text-zinc-600 hover:border-zinc-600"
            }`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
