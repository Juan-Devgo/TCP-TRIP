import type { SubField } from "../../types";
import type { EditorProps } from "./types";
import { labelCls, inputCls, btnSmCls } from "./editorStyles";
import { TYPE_CONFIG, generateSubId } from "./utils";
import IconX from "../../../../shared/icons/IconX";
import IconPlus from "../../../../shared/icons/IconPlus";
import SubFieldTypeSelector from "./SubFieldTypeSelector";

export default function CompositeEditor({ field, onChange }: EditorProps) {
  const totalBits = field.sizeBytes * 8;
  const subFields: SubField[] = field.subFields ?? [];
  const allocatedBits = subFields.reduce((sum, sf) => sum + sf.sizeBits, 0);
  const remainingBits = totalBits - allocatedBits;

  const fillPct = Math.min(100, (allocatedBits / totalBits) * 100);
  const isExact = allocatedBits === totalBits;
  const isOver = allocatedBits > totalBits;

  const fillBarColor = isOver ? "bg-red-500" : isExact ? "bg-emerald-500" : "bg-amber-500";
  const statusColor = isOver ? "text-red-400" : isExact ? "text-emerald-400" : "text-amber-400";
  const statusText = isOver
    ? `${allocatedBits} / ${totalBits} bits — excede por ${allocatedBits - totalBits}`
    : isExact
      ? `${allocatedBits} / ${totalBits} bits — completo`
      : `${allocatedBits} / ${totalBits} bits — faltan ${remainingBits}`;

  function addSubField() {
    const newSf: SubField = {
      id: generateSubId(),
      name: `Sub ${subFields.length + 1}`,
      type: "uint",
      sizeBits: Math.max(1, remainingBits > 0 ? remainingBits : 1),
      meaning: "",
    };
    onChange({ subFields: [...subFields, newSf] });
  }

  function updateSubField(index: number, updates: Partial<SubField>) {
    const updated = subFields.map((sf, i) =>
      i === index ? { ...sf, ...updates } : sf,
    );
    onChange({ subFields: updated });
  }

  function removeSubField(index: number) {
    onChange({ subFields: subFields.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3">
      {/* Size control */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className={labelCls}>Tamaño total:</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={16}
            value={field.sizeBytes}
            onChange={(e) => {
              const sz = Math.max(1, Math.min(16, Number(e.target.value) || 1));
              onChange({ sizeBytes: sz });
            }}
            className={`${inputCls} w-16 text-fuchsia-400 text-center`}
          />
          <span className="text-zinc-500 text-sm">bytes</span>
          <span className="text-zinc-600 text-sm">({totalBits} bits totales)</span>
        </div>
      </div>

      {/* Fill progress bar */}
      <div className="space-y-1">
        <span className={`text-xs font-mono ${statusColor}`}>{statusText}</span>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
          <div
            className={`h-full rounded-full transition-all duration-200 ${fillBarColor}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Sub-field list */}
      <div className="space-y-2">
        {subFields.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-3 border border-dashed border-zinc-700 rounded-lg">
            Sin subcampos. Agrega uno para comenzar.
          </p>
        )}
        {subFields.map((sf, i) => {
          const sfCfg = TYPE_CONFIG[sf.type];
          return (
            <div
              key={sf.id}
              className={`flex items-start gap-2 border rounded-lg p-2 ${sfCfg.border} ${sfCfg.bg}`}
            >
              <span className="text-zinc-600 text-[10px] font-mono w-4 text-right shrink-0 mt-1.5">
                {i + 1}
              </span>
              <div className="flex-1 grid grid-cols-1 gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="text"
                    value={sf.name}
                    onChange={(e) => updateSubField(i, { name: e.target.value })}
                    placeholder="Nombre"
                    className={`bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm ${sfCfg.text} outline-none focus:border-zinc-600 font-mono w-24`}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={sf.sizeBits}
                      onChange={(e) =>
                        updateSubField(i, {
                          sizeBits: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={`bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm ${sfCfg.text} outline-none font-mono w-14 text-center`}
                    />
                    <span className="text-zinc-600 text-[10px]">bits</span>
                  </div>
                </div>
                <SubFieldTypeSelector
                  value={sf.type}
                  onChange={(t) => updateSubField(i, { type: t })}
                />
                <input
                  type="text"
                  value={sf.meaning}
                  onChange={(e) => updateSubField(i, { meaning: e.target.value })}
                  placeholder="Significado del subcampo…"
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-400 outline-none focus:border-zinc-600 w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => removeSubField(i)}
                className="text-red-500/60 hover:text-red-400 transition-colors shrink-0 mt-1"
                title="Eliminar subcampo"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addSubField}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 text-md transition-all duration-200 cursor-pointer"
      >
        <IconPlus className="w-4 h-4" />
        Agregar subcampo
      </button>

      {/* Visual proportional preview */}
      {subFields.length > 0 && (
        <div>
          <label className={`${labelCls} block mb-1`}>Distribución de bits:</label>
          <div className="flex h-9 rounded-lg overflow-hidden border border-fuchsia-700/30">
            {subFields.map((sf) => {
              const pct = totalBits > 0 ? (sf.sizeBits / totalBits) * 100 : 0;
              const sfCfg = TYPE_CONFIG[sf.type];
              return (
                <div
                  key={sf.id}
                  title={`${sf.name} · ${sf.type} · ${sf.sizeBits} bits`}
                  className={`flex flex-col items-center justify-center ${sfCfg.bg} border-r ${sfCfg.border} last:border-r-0 overflow-hidden px-px`}
                  style={{ width: `${pct}%` }}
                >
                  <span className={`text-sm font-mono ${sfCfg.text} truncate leading-none text-center`}>
                    {sf.name.length > 6 ? sf.name.slice(0, 6) : sf.name}
                  </span>
                  <span className={`text-xs font-mono ${sfCfg.text} opacity-60 leading-none`}>
                    {sf.sizeBits}b
                  </span>
                </div>
              );
            })}
            {remainingBits > 0 && (
              <div
                title={`${remainingBits} bits sin asignar`}
                className="flex flex-col items-center justify-center bg-zinc-900/80 border-l-2 border-dashed border-fuchsia-700/50 overflow-hidden"
                style={{ width: `${(remainingBits / totalBits) * 100}%` }}
              >
                <span className="text-sm font-mono text-zinc-400 leading-none">libre</span>
                <span className="text-xs font-mono text-zinc-700/60 leading-none">{remainingBits}b</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!isExact && subFields.length > 0 && (
        <p
          className={`text-sm font-mono px-2.5 py-1.5 rounded border ${
            isOver
              ? "text-red-400 bg-red-900/20 border-red-800/50"
              : "text-amber-400 bg-amber-900/20 border-amber-800/50"
          }`}
        >
          {isOver
            ? `Los subcampos suman ${allocatedBits}b pero el campo tiene solo ${totalBits}b. Reduce el tamaño o elimina subcampos.`
            : `Quedan ${remainingBits} bits sin asignar de los ${totalBits}b totales.`}
        </p>
      )}
    </div>
  );
}
