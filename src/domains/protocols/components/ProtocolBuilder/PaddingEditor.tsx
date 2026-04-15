import { useState } from "react";
import type { EditorProps } from "./types";
import { labelCls, inputCls } from "./editorStyles";

export default function PaddingEditor({ field, onChange }: EditorProps) {
  const padByte = field.paddingByte ?? 0x00;
  const [hexInput, setHexInput] = useState(
    padByte.toString(16).padStart(2, "0").toUpperCase(),
  );

  function handleHexByte(val: string) {
    const clean = val.replace(/[^0-9A-Fa-f]/g, "").slice(0, 2);
    setHexInput(clean.toUpperCase());
    if (clean.length === 2) {
      onChange({ paddingByte: parseInt(clean, 16) });
    } else if (clean.length === 0) {
      onChange({ paddingByte: 0x00 });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label className={labelCls}>Tamaño:</label>
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
            className={`${inputCls} w-16 text-zinc-400 text-center`}
          />
          <span className="text-zinc-500 text-sm">bytes</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className={labelCls}>Byte de relleno (estructural):</label>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 font-mono text-sm">0x</span>
          <input
            type="text"
            value={hexInput}
            maxLength={2}
            onChange={(e) => handleHexByte(e.target.value)}
            className={`${inputCls} w-14 text-zinc-400 text-center uppercase`}
          />
          <span className="text-zinc-600 text-sm">({padByte} dec)</span>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: Math.min(field.sizeBytes, 16) }, (_, i) => (
          <code
            key={i}
            className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700"
          >
            {padByte.toString(16).padStart(2, "0").toUpperCase()}
          </code>
        ))}
        {field.sizeBytes > 16 && (
          <span className="text-zinc-600 text-sm self-end">
            +{field.sizeBytes - 16} más…
          </span>
        )}
      </div>
    </div>
  );
}
