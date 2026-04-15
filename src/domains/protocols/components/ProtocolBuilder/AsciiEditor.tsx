import type { EditorProps } from "./types";
import { labelCls, inputCls } from "./editorStyles";
import InfoNote from "./InfoNote";

export default function AsciiEditor({ field, onChange }: EditorProps) {
  const fixed = field.asciiFixedSize ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className={labelCls}>Tamaño fijo:</label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={fixed}
            onChange={(e) => onChange({ asciiFixedSize: e.target.checked })}
            className="peer sr-only"
          />
          <span className="relative w-9 h-5 rounded-full bg-zinc-700 border border-zinc-600 inline-flex items-center transition-colors peer-checked:bg-emerald-700 peer-checked:border-emerald-600">
            <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-zinc-300 transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
          </span>
        </label>
        {fixed ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={256}
              value={field.sizeBytes}
              onChange={(e) =>
                onChange({
                  sizeBytes: Math.max(1, Math.min(256, Number(e.target.value) || 1)),
                })
              }
              className={`${inputCls} w-16 text-emerald-400 text-center`}
            />
            <span className="text-zinc-500 text-sm">bytes</span>
          </div>
        ) : (
          <span className="text-zinc-600 text-sm">
            Tamaño determinado por el contenido al crear el encabezado
          </span>
        )}
      </div>
      <InfoNote>El texto ASCII se introduce al crear el encabezado.</InfoNote>
    </div>
  );
}
