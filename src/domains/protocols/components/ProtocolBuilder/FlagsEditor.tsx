import type { FlagBit } from "../../types";
import type { EditorProps } from "./types";
import { labelCls, inputCls, btnSmCls } from "./editorStyles";
import IconX from "../../../../shared/icons/IconX";
import IconPlus from "../../../../shared/icons/IconPlus";
import InfoNote from "./InfoNote";

export default function FlagsEditor({ field, onChange }: EditorProps) {
  const bits: FlagBit[] = field.flagBits ?? [];
  const totalBits = field.sizeBits ?? field.sizeBytes * 8;

  function updateBit(index: number, updates: Partial<FlagBit>) {
    const newBits = bits.map((b, i) => (i === index ? { ...b, ...updates } : b));
    onChange({ flagBits: newBits });
  }

  function addFlag() {
    const newBit: FlagBit = { name: "FLG", value: false, reserved: false };
    const newBits = [...bits, newBit];
    const newSizeBits = newBits.length;
    onChange({
      flagBits: newBits,
      sizeBits: newSizeBits,
      sizeBytes: Math.ceil(newSizeBits / 8),
    });
  }

  function removeFlag(index: number) {
    const newBits = bits.filter((_, i) => i !== index);
    const newSizeBits = Math.max(1, newBits.length);
    onChange({
      flagBits: newBits,
      sizeBits: newSizeBits,
      sizeBytes: Math.ceil(newSizeBits / 8),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={labelCls}>
          Bits totales:{" "}
          <span className="text-amber-400 font-mono">{totalBits}</span>
        </span>
        <span className={`${labelCls} ml-2`}>
          Tamaño:{" "}
          <span className="text-amber-400 font-mono">{field.sizeBytes} bytes</span>
        </span>
      </div>

      <div className="space-y-1.5">
        {bits.map((bit, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-600 text-sm font-mono w-4 text-right">{i}</span>
            <input
              type="text"
              maxLength={5}
              value={bit.name}
              disabled={bit.reserved}
              onChange={(e) => updateBit(i, { name: e.target.value.toUpperCase() })}
              placeholder="NOM"
              className={`${inputCls} w-16 text-center uppercase ${bit.reserved ? "text-zinc-600 cursor-not-allowed" : "text-amber-300"}`}
            />
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bit.reserved}
                onChange={(e) => updateBit(i, { reserved: e.target.checked })}
                className="sr-only peer"
              />
              <span className="text-[10px] text-zinc-500 peer-checked:text-zinc-400">Reservado</span>
              <span className="w-7 h-3.5 rounded-full bg-zinc-700 border border-zinc-600 transition-colors peer-checked:bg-zinc-500 relative inline-flex items-center">
                <span className="absolute left-0.5 top-0.5 w-2.5 h-2.5 rounded-full bg-zinc-400 transition-transform peer-checked:translate-x-3.5" />
              </span>
            </label>
            <button
              type="button"
              onClick={() => removeFlag(i)}
              className={`${btnSmCls} bg-red-900/30 border-red-700/50 text-red-400 hover:bg-red-900/50 ml-auto`}
              title="Eliminar bit"
            >
              <IconX className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {bits.length > 0 && (
        <div className="flex gap-px flex-wrap pt-1">
          {bits.map((bit, i) => (
            <div
              key={i}
              title={`Bit ${i}: ${bit.name}${bit.reserved ? " (reservado)" : ""}`}
              className={`min-w-6 h-6 px-1 flex items-center justify-center text-[8px] font-mono rounded-sm border ${
                bit.reserved
                  ? "bg-zinc-700/50 border-zinc-600/50 text-zinc-500"
                  : "bg-amber-900/50 border-amber-600/40 text-amber-300"
              }`}
            >
              {bit.reserved ? "R" : bit.name.slice(0, 3)}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addFlag}
        className={`${btnSmCls} bg-amber-900/30 border-amber-700/50 text-amber-400 hover:bg-amber-900/50`}
      >
        <IconPlus className="w-3 h-3" />
        Agregar bit
      </button>

      <InfoNote>Los valores de cada flag (0/1) se definen al crear el encabezado.</InfoNote>
    </div>
  );
}
