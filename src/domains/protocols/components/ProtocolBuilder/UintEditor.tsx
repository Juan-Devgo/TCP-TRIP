import type { EditorProps } from "./types";
import { labelCls, inputCls } from "./editorStyles";

export default function UintEditor({ field, onChange }: EditorProps) {
  const maxValue = Math.pow(2, field.sizeBytes * 8) - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label className={labelCls}>Tamaño:</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={8}
            value={field.sizeBytes}
            onChange={(e) => {
              const sz = Math.max(1, Math.min(8, Number(e.target.value) || 1));
              onChange({ sizeBytes: sz });
            }}
            className={`${inputCls} w-16 text-blue-400 text-center`}
          />
          <span className="text-zinc-500 text-sm">bytes</span>
          <span className="text-zinc-600 text-sm">
            ({field.sizeBytes * 8} bits · máx {maxValue.toLocaleString()})
          </span>
        </div>
      </div>
    </div>
  );
}
