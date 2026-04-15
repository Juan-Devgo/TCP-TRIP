import { useState } from "react";
import type { ProtocolField, FieldType, FlagBit } from "../../types";
import { TYPE_CONFIG, TYPE_TOOLTIPS, TYPE_DESCRIPTIONS, generateId } from "./utils";
import TypeIcon from "../../../../shared/icons/TypeIcon";
import IconPlus from "../../../../shared/icons/IconPlus";

function getDefaultField(type: FieldType): Partial<ProtocolField> {
  switch (type) {
    case "uint":
      return { sizeBytes: 1 };
    case "flags":
      return {
        sizeBytes: 1,
        sizeBits: 8,
        flagBits: [{ name: "FLG", value: false, reserved: false } as FlagBit],
      };
    case "ascii":
      return { sizeBytes: 4, asciiFixedSize: true };
    case "hex":
      return { sizeBytes: 2, asciiFixedSize: true };
    case "ipv4":
      return { sizeBytes: 4 };
    case "enum":
      return {
        sizeBytes: 1,
        enumOptions: [
          { value: 0, label: "Opción A" },
          { value: 1, label: "Opción B" },
        ],
      };
    case "padding":
      return { sizeBytes: 1, paddingByte: 0x00 };
    case "composite":
      return {
        sizeBytes: 2,
        subFields: [
          { id: generateId(), name: "Sub A", type: "uint", sizeBits: 8, meaning: "Primer subcampo" },
          { id: generateId(), name: "Sub B", type: "uint", sizeBits: 8, meaning: "Segundo subcampo" },
        ],
      };
  }
}

interface AddFieldPanelProps {
  onAdd: (field: ProtocolField) => void;
  onCancel: () => void;
}

const FIELD_TYPES: FieldType[] = [
  "uint", "flags", "ascii", "hex", "ipv4", "enum", "padding", "composite",
];

export default function AddFieldPanel({ onAdd, onCancel }: AddFieldPanelProps) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<FieldType | null>(null);
  const [name, setName] = useState("");
  const [meaning, setMeaning] = useState("");
  const [defaults, setDefaults] = useState<Partial<ProtocolField>>({});

  function handleSelectType(type: FieldType) {
    setSelectedType(type);
    setDefaults(getDefaultField(type));
    setStep("details");
  }

  function handleAdd() {
    if (!selectedType || !name.trim()) return;
    const field: ProtocolField = {
      id: generateId(),
      name: name.trim(),
      type: selectedType,
      meaning: meaning.trim(),
      sizeBytes: defaults.sizeBytes ?? 1,
      ...defaults,
    };
    onAdd(field);
  }

  if (step === "type") {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
        <p className="text-zinc-400 text-sm font-medium">Selecciona el tipo de campo:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FIELD_TYPES.map((type) => {
            const cfg = TYPE_CONFIG[type];
            return (
              <button
                key={type}
                type="button"
                title={TYPE_TOOLTIPS[type]}
                onClick={() => handleSelectType(type)}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border ${cfg.border} ${cfg.bg} hover:opacity-90 transition-opacity cursor-pointer text-left`}
              >
                <TypeIcon type={type} className="w-6 h-6" />
                <span className={`text-xs font-bold font-mono ${cfg.text}`}>{cfg.label}</span>
                <span className="text-zinc-500 text-[10px] leading-tight">{TYPE_DESCRIPTIONS[type]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const cfg = TYPE_CONFIG[selectedType!];

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TypeIcon type={selectedType!} className="w-6 h-6" />
        <span className={`text-sm font-mono font-bold ${cfg.text}`}>{cfg.label}</span>
        <button
          type="button"
          onClick={() => setStep("type")}
          className="text-zinc-600 hover:text-zinc-400 text-xs ml-1"
        >
          (cambiar)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-zinc-400 text-xs font-medium block mb-1">Nombre *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Source Port"
            autoFocus
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-zinc-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-zinc-400 text-xs font-medium block mb-1">Significado</label>
          <input
            type="text"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Ej: Puerto de origen"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-300 text-sm outline-none focus:border-zinc-500 transition-colors"
          />
        </div>
      </div>

      {(selectedType === "uint" || selectedType === "padding") && (
        <div className="flex items-center gap-2">
          <label className="text-zinc-400 text-xs font-medium">Tamaño inicial:</label>
          <input
            type="number"
            min={1}
            max={8}
            value={defaults.sizeBytes ?? 1}
            onChange={(e) =>
              setDefaults((d) => ({
                ...d,
                sizeBytes: Math.max(1, Number(e.target.value) || 1),
              }))
            }
            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 font-mono text-sm outline-none"
          />
          <span className="text-zinc-500 text-xs">bytes</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 bg-emerald-700/70 hover:bg-emerald-700 border border-emerald-600/50 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <IconPlus className="w-3.5 h-3.5" />
          Agregar campo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
