import type { ProtocolField, DocLink } from "../../types";
import { TYPE_CONFIG, getFieldBitSize } from "./utils";
import TypeIcon from "../../../../shared/icons/TypeIcon";
import IconChevron from "../../../../shared/icons/IconChevron";
import IconChevronUp from "../../../../shared/icons/IconChevronUp";
import IconLink from "../../../../shared/icons/IconLink";
import IconExternalLink from "../../../../shared/icons/IconExternalLink";
import IconX from "../../../../shared/icons/IconX";
import IconPlus from "../../../../shared/icons/IconPlus";
import IconCopy from "../../../../shared/icons/IconCopy";
import IconTrash from "../../../../shared/icons/IconTrash";
import FieldEditor from "./FieldEditor";

interface FieldRowProps {
  field: ProtocolField;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  offsetBits: number;
  onToggleEdit: () => void;
  onChange: (updates: Partial<ProtocolField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}

const btnCls =
  "flex items-center justify-center w-9 h-9 rounded border transition-all duration-150 cursor-pointer select-none text-xs";

export default function FieldRow({
  field,
  index,
  isFirst,
  isLast,
  isEditing,
  offsetBits,
  onToggleEdit,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: FieldRowProps) {
  const cfg = TYPE_CONFIG[field.type];
  const offsetBytes = offsetBits / 8;
  const sizeBits = getFieldBitSize(field);
  const docLinkCount = field.docLinks?.length ?? 0;

  const isComposite = field.type === "composite";
  const subCount = isComposite ? (field.subFields?.length ?? 0) : 0;
  const allocatedBits = isComposite
    ? (field.subFields ?? []).reduce((sum, sf) => sum + sf.sizeBits, 0)
    : 0;
  const totalBitsForComposite = field.sizeBytes * 8;
  const compositeComplete = allocatedBits === totalBitsForComposite;

  function addDocLink() {
    const newLink: DocLink = { label: "", url: "" };
    onChange({ docLinks: [...(field.docLinks ?? []), newLink] });
  }

  function updateDocLink(i: number, updates: Partial<DocLink>) {
    const links = [...(field.docLinks ?? [])];
    links[i] = { ...links[i]!, ...updates };
    onChange({ docLinks: links });
  }

  function removeDocLink(i: number) {
    onChange({ docLinks: (field.docLinks ?? []).filter((_, idx) => idx !== i) });
  }

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${cfg.border} ${isEditing ? cfg.bg : "bg-zinc-900/50"}`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggleEdit}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors cursor-pointer text-left"
      >
        <span className="text-zinc-400 font-mono text-sm w-5 shrink-0 text-right">
          {index + 1}
        </span>
        <TypeIcon type={field.type} className="w-6 h-6" />

        <div className="flex-1 min-w-0">
          <span className="text-white text-sm font-medium truncate block">{field.name}</span>
          {field.meaning && (
            <span className="text-zinc-400 text-xs truncate block">{field.meaning}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-zinc-400 text-sm font-mono hidden sm:block">
            Offset: +{offsetBytes % 1 === 0 ? offsetBytes : offsetBytes.toFixed(1)}B
          </span>

          {isComposite ? (
            <span
              className={`text-sm font-mono bg-zinc-900 border px-3.5 py-2.5 rounded ${
                compositeComplete
                  ? "border-emerald-700/50 text-emerald-400"
                  : "border-amber-700/50 text-amber-400"
              }`}
            >
              {subCount} sub · {allocatedBits}/{totalBitsForComposite}b
            </span>
          ) : (
            <span className={`${cfg.text} text-sm font-mono bg-zinc-900 border ${cfg.border} px-3.5 py-2.5 rounded`}>
              {field.sizeBytes}B · {sizeBits}b
            </span>
          )}

          {docLinkCount > 0 && (
            <span className="text-blue-500/70 text-sm font-mono border border-blue-700/30 bg-blue-900/20 px-3.5 py-2.5 rounded flex items-center gap-0.5">
              <IconLink className="w-4 h-4" />
              {docLinkCount}
            </span>
          )}
        </div>

        <IconChevron
          className={`w-6 h-6 text-zinc-500 transition-transform shrink-0 ${isEditing ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded editor */}
      {isEditing && (
        <div className="border-t border-zinc-700/50">
          {/* Action buttons */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-700/30">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Mover arriba"
              className={`${btnCls} bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <IconChevronUp className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              title="Mover abajo"
              className={`${btnCls} bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <IconChevron className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-zinc-700 mx-0.5" />
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicar campo"
              className={`${btnCls} bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
            >
              <IconCopy className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              title="Eliminar campo"
              className={`${btnCls} bg-red-900/30 border-red-700/50 text-red-400 hover:bg-red-900/50 ml-auto`}
            >
              <IconTrash className="w-5 h-5" />
            </button>
          </div>

          {/* Name + meaning editable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 py-3">
            <div>
              <label className="text-zinc-400 text-sm font-medium block mb-1">Nombre</label>
              <input
                type="text"
                value={field.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm font-medium block mb-1">Significado</label>
              <input
                type="text"
                value={field.meaning}
                onChange={(e) => onChange({ meaning: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-300 text-sm outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          {/* Type-specific structural editor */}
          <div className="px-3 pb-3">
            <div className="border-t border-zinc-800 pt-3">
              <FieldEditor field={field} onChange={onChange} />
            </div>
          </div>

          {/* Documentation links */}
          <div className="px-3 pb-3 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-[10px] font-medium flex items-center gap-1">
                <IconLink className="w-3 h-3" />
                Documentación
              </span>
              <button
                type="button"
                onClick={addDocLink}
                className="text-zinc-600 hover:text-zinc-400 text-[10px] flex items-center gap-1 transition-colors"
              >
                <IconPlus className="w-2.5 h-2.5" />
                Enlace
              </button>
            </div>
            {(field.docLinks ?? []).map((link, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={link.label}
                  placeholder="Etiqueta"
                  onChange={(e) => updateDocLink(i, { label: e.target.value })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:border-zinc-500 w-28"
                />
                <input
                  type="url"
                  value={link.url}
                  placeholder="https://..."
                  onChange={(e) => updateDocLink(i, { url: e.target.value })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-500 flex-1"
                />
                {link.url && (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                    title="Abrir enlace"
                  >
                    <IconExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => removeDocLink(i)}
                  className="text-red-500/60 hover:text-red-400 transition-colors shrink-0"
                  title="Eliminar enlace"
                >
                  <IconX className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
