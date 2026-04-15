import type { EnumOption } from "../../types";
import type { EditorProps } from "./types";
import { labelCls, inputCls, btnSmCls } from "./editorStyles";
import IconX from "../../../../shared/icons/IconX";
import IconPlus from "../../../../shared/icons/IconPlus";
import InfoNote from "./InfoNote";

export default function EnumEditor({ field, onChange }: EditorProps) {
  const options: EnumOption[] = field.enumOptions ?? [];

  function addOption() {
    const nextVal =
      options.length > 0 ? Math.max(...options.map((o) => o.value)) + 1 : 0;
    onChange({
      enumOptions: [...options, { value: nextVal, label: `Opción ${nextVal}` }],
    });
  }

  function updateOption(index: number, updates: Partial<EnumOption>) {
    const newOptions = options.map((o, i) =>
      i === index ? { ...o, ...updates } : o,
    );
    onChange({ enumOptions: newOptions });
  }

  function removeOption(index: number) {
    onChange({ enumOptions: options.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label className={labelCls}>Tamaño:</label>
        <select
          value={field.sizeBytes}
          onChange={(e) => onChange({ sizeBytes: Number(e.target.value) })}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-orange-400 text-sm outline-none"
        >
          <option value={1}>1 byte (0–255)</option>
          <option value={2}>2 bytes (0–65535)</option>
        </select>
      </div>

      <div>
        <label className={`${labelCls} block mb-2`}>Valores posibles (estructura):</label>
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                value={opt.value}
                onChange={(e) => updateOption(i, { value: Number(e.target.value) || 0 })}
                className={`${inputCls} w-16 text-orange-400 text-center`}
                placeholder="Val"
              />
              <span className="text-zinc-600 text-sm">→</span>
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(i, { label: e.target.value })}
                className={`${inputCls} flex-1 text-orange-300`}
                placeholder="Etiqueta"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className={`${btnSmCls} bg-red-900/30 border-red-700/50 text-red-400 hover:bg-red-900/50`}
              >
                <IconX className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className={`${btnSmCls} mt-2 bg-orange-900/30 border-orange-700/50 text-orange-400 hover:bg-orange-900/50`}
        >
          <IconPlus className="w-3 h-3" />
          Agregar opción
        </button>
      </div>

      <InfoNote>El valor seleccionado se elige al crear el encabezado.</InfoNote>
    </div>
  );
}
