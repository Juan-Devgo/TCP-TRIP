import { useState, useCallback, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { $authStore } from "@clerk/astro/client";
import type { Protocol, ProtocolField } from "../../types";
import { getFieldBitSize, computeFieldOffsets } from "./utils";
import HeaderVisualization from "./HeaderVisualization";
import FieldRow from "./FieldRow";
import AddFieldPanel from "./AddFieldPanel";
import IconChevron from "../../../../shared/icons/IconChevron";
import IconX from "../../../../shared/icons/IconX";
import IconLightning from "../../../../shared/icons/IconLightning";
import IconDownload from "../../../../shared/icons/IconDownload";
import IconSave from "../../../../shared/icons/IconSave";
import IconCheck from "../../../../shared/icons/IconCheck";
import IconShare from "../../../../shared/icons/IconShare";
import IconDocument from "../../../../shared/icons/IconDocument";
import IconColumns from "../../../../shared/icons/IconColumns";
import IconClipboard from "../../../../shared/icons/IconClipboard";
import IconPlus from "../../../../shared/icons/IconPlus";

// ─── Initial TCP structural example (no instance values) ──────────────────────

const INITIAL_PROTOCOL: Protocol = {
  id: "tcp-simplified",
  name: "TCP Simplificado",
  description: "Versión educativa del encabezado TCP (primeros 20 bytes)",
  fields: [
    { id: "f1", name: "Source Port", type: "uint", sizeBytes: 2, meaning: "Puerto de origen" },
    { id: "f2", name: "Dest Port", type: "uint", sizeBytes: 2, meaning: "Puerto de destino" },
    { id: "f3", name: "Seq Number", type: "uint", sizeBytes: 4, meaning: "Número de secuencia del primer byte de datos" },
    { id: "f4", name: "Ack Number", type: "uint", sizeBytes: 4, meaning: "Número del siguiente byte esperado (ACK)" },
    {
      id: "f5",
      name: "Header + Flags",
      type: "composite",
      sizeBytes: 2,
      meaning: "Data offset, reservados y flags de control",
      subFields: [
        { id: "sf1", name: "Offset", type: "uint", sizeBits: 4, meaning: "Longitud del encabezado en palabras de 32 bits" },
        { id: "sf2", name: "RES", type: "padding", sizeBits: 6, meaning: "Reservado (siempre 0)" },
        { id: "sf3", name: "URG", type: "flags", sizeBits: 1, meaning: "Puntero urgente válido" },
        { id: "sf4", name: "ACK", type: "flags", sizeBits: 1, meaning: "Campo de acuse de recibo válido" },
        { id: "sf5", name: "PSH", type: "flags", sizeBits: 1, meaning: "Empujar datos a la aplicación" },
        { id: "sf6", name: "RST", type: "flags", sizeBits: 1, meaning: "Reiniciar la conexión" },
        { id: "sf7", name: "SYN", type: "flags", sizeBits: 1, meaning: "Sincronizar números de secuencia" },
        { id: "sf8", name: "FIN", type: "flags", sizeBits: 1, meaning: "Fin de datos del emisor" },
      ],
    },
    { id: "f6", name: "Window Size", type: "uint", sizeBytes: 2, meaning: "Tamaño de la ventana de recepción en bytes" },
    { id: "f7", name: "Checksum", type: "hex", sizeBytes: 2, meaning: "Suma de verificación del segmento TCP", asciiFixedSize: true },
    { id: "f8", name: "Urgent Ptr", type: "uint", sizeBytes: 2, meaning: "Puntero a datos urgentes (válido si URG=1)" },
  ],
  createdAt: new Date(),
};

// ─── ProtocolBuilder ──────────────────────────────────────────────────────────

export default function ProtocolBuilder() {
  const auth = useStore($authStore);
  const [protocol, setProtocol] = useState<Protocol>(INITIAL_PROTOCOL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDiagram, setShowDiagram] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("load");
    if (!loadId) return;
    fetch(`/api/protocols/${loadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setProtocol({ ...data, createdAt: new Date(data.createdAt) });
          setSavedId(data.id);
          setShareCode(data.shareCode ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const offsets = computeFieldOffsets(protocol.fields);
  const totalBits = protocol.fields.reduce((s, f) => s + getFieldBitSize(f), 0);
  const totalBytes = totalBits / 8;

  const updateField = useCallback(
    (id: string, updates: Partial<ProtocolField>) => {
      setProtocol((p) => ({
        ...p,
        fields: p.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      }));
    },
    [],
  );

  const removeField = useCallback((id: string) => {
    setProtocol((p) => ({ ...p, fields: p.fields.filter((f) => f.id !== id) }));
    setEditingId((prev) => (prev === id ? null : prev));
  }, []);

  const moveField = useCallback((id: string, dir: -1 | 1) => {
    setProtocol((p) => {
      const idx = p.fields.findIndex((f) => f.id === id);
      if (idx === -1) return p;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= p.fields.length) return p;
      const fields = [...p.fields];
      [fields[idx]!, fields[newIdx]!] = [fields[newIdx]!, fields[idx]!];
      return { ...p, fields };
    });
  }, []);

  const duplicateField = useCallback((id: string) => {
    setProtocol((p) => {
      const idx = p.fields.findIndex((f) => f.id === id);
      if (idx === -1) return p;
      const copy = { ...p.fields[idx]!, id: crypto.randomUUID(), name: p.fields[idx]!.name + " (copia)" };
      const fields = [...p.fields];
      fields.splice(idx + 1, 0, copy);
      return { ...p, fields };
    });
  }, []);

  const addField = useCallback((field: ProtocolField) => {
    setProtocol((p) => ({ ...p, fields: [...p.fields, field] }));
    setShowAdd(false);
    setEditingId(field.id);
  }, []);

  function handleExportJson() {
    const data = JSON.stringify(protocol, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${protocol.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadExample() {
    setProtocol({ ...INITIAL_PROTOCOL, createdAt: new Date() });
    setEditingId(null);
    setShowAdd(false);
  }

  function handleClearAll() {
    setProtocol((p) => ({ ...p, fields: [] }));
    setEditingId(null);
    setShowAdd(false);
  }

  async function handleSave(): Promise<string | null> {
    if (!auth.userId) return null;
    setSaveStatus("saving");
    try {
      let res: Response;
      let resolvedId = savedId;
      if (savedId) {
        res = await fetch(`/api/protocols/${savedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: protocol.name, description: protocol.description, fields: protocol.fields }),
        });
      } else {
        res = await fetch("/api/protocols", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: protocol.name, description: protocol.description, fields: protocol.fields }),
        });
        if (res.ok) {
          const data = await res.json();
          resolvedId = data.id;
          setSavedId(data.id);
          window.history.replaceState({}, "", `/protocol-creator?load=${data.id}`);
        }
      }
      setSaveStatus(res.ok ? "saved" : "error");
      setTimeout(() => setSaveStatus("idle"), 2500);
      return res.ok ? resolvedId : null;
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
      return null;
    }
  }

  async function handleShare() {
    const id = savedId ?? (await handleSave());
    if (!id) return;
    try {
      const res = await fetch(`/api/protocols/${id}/share`, { method: "POST" });
      if (!res.ok) return;
      const { shareCode: code } = await res.json();
      setShareCode(code);
      const url = `${window.location.origin}/protocols/${code}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {}
  }

  return (
    <section className="flex justify-center min-h-screen p-4 pt-8">
      <div className="w-full max-w-7xl space-y-4">
        <div className="bg-linear-to-br from-zinc-800 to-zinc-900 rounded-2xl p-4 border border-zinc-700/50 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-white text-2xl font-bold mb-1">Constructor de Protocolos</h1>
            <p className="text-zinc-400 text-sm">
              Edita los campos del protocolo para construir tu propio protocolo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1">Nombre del protocolo</label>
              <input
                type="text"
                value={protocol.name}
                onChange={(e) => setProtocol((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-semibold outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1">Descripción</label>
              <input
                type="text"
                value={protocol.description}
                onChange={(e) => setProtocol((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descripción corta del protocolo..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-300 text-sm outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-zinc-700/50">
            <div className="flex items-center gap-4">
              <span className="text-zinc-300 text-sm">
                <span className="text-white font-mono font-bold">{protocol.fields.length}</span> campos
              </span>
              <span className="text-zinc-300 text-sm">
                <span className="text-amber-300 font-mono font-bold">
                  {totalBytes % 1 === 0 ? totalBytes : totalBytes.toFixed(2)}
                </span>{" "}
                bytes
              </span>
              <span className="text-zinc-400 text-sm font-mono">({totalBits} bits)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 bg-red-700/70 hover:bg-red-700 border border-red-600/50 hover:border-red-500 text-red-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none"
              >
                <IconX className="w-3.5 h-3.5" />
                Limpiar
              </button>
              <button
                type="button"
                onClick={handleLoadExample}
                className="flex items-center gap-1.5 bg-emerald-700/70 hover:bg-emerald-700 border border-emerald-600/50 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none"
              >
                <IconLightning className="w-3.5 h-3.5" />
                Cargar ejemplo
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1.5 bg-blue-700/70 hover:bg-blue-700 border border-blue-600/50 hover:border-blue-500 text-blue-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none"
              >
                <IconDownload className="w-3.5 h-3.5" />
                Exportar JSON
              </button>

              {auth.userId && (
                <>
                  <div className="h-4 w-px bg-zinc-700 mx-1" />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveStatus === "saving"}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer select-none disabled:opacity-60 ${
                      saveStatus === "saved"
                        ? "bg-emerald-900/40 border-emerald-600/50 text-emerald-300"
                        : saveStatus === "error"
                          ? "bg-red-900/40 border-red-600/50 text-red-300"
                          : "bg-zinc-700/70 hover:bg-zinc-700 border-zinc-600/50 hover:border-zinc-500 text-zinc-200 hover:text-white"
                    }`}
                  >
                    {saveStatus === "saving" ? (
                      <span className="animate-pulse">Guardando…</span>
                    ) : saveStatus === "saved" ? (
                      <>
                        <IconCheck className="w-3.5 h-3.5" />
                        Guardado
                      </>
                    ) : (
                      <>
                        <IconSave className="w-3.5 h-3.5" />
                        {savedId ? "Actualizar" : "Guardar"}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer select-none ${
                      shareCopied
                        ? "bg-emerald-900/40 border-emerald-600/50 text-emerald-300"
                        : "bg-fuchsia-900/40 hover:bg-fuchsia-900/60 border-fuchsia-700/50 hover:border-fuchsia-500 text-fuchsia-300 hover:text-white"
                    }`}
                  >
                    {shareCopied ? (
                      <>
                        <IconCheck className="w-3.5 h-3.5" />
                        ¡Enlace copiado!
                      </>
                    ) : (
                      <>
                        <IconShare className="w-3.5 h-3.5" />
                        {shareCode ? "Copiar enlace" : "Compartir"}
                      </>
                    )}
                  </button>

                  <a
                    href="/my-protocols"
                    className="flex items-center gap-1.5 bg-amber-700/40 hover:bg-amber-700/60 border border-amber-700/50 hover:border-amber-500 text-amber-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 select-none"
                  >
                    <IconDocument className="w-3.5 h-3.5" />
                    Mis protocolos
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Full-width field editor ── */}
        <div className="bg-linear-to-br from-zinc-800 to-zinc-900 rounded-2xl border border-zinc-700/50 shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between">
            <h2 className="text-zinc-200 text-sm font-semibold">Campos del protocolo</h2>
            <span className="text-zinc-300 text-sm font-mono">{protocol.fields.length} campos</span>
          </div>

          <div className="p-3 space-y-2">
            {protocol.fields.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-300">
                <IconClipboard className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">Sin campos. Agrega uno para comenzar.</p>
              </div>
            )}

            {protocol.fields.map((field, index) => (
              <FieldRow
                key={field.id}
                field={field}
                index={index}
                isFirst={index === 0}
                isLast={index === protocol.fields.length - 1}
                isEditing={editingId === field.id}
                offsetBits={offsets[index] ?? 0}
                onToggleEdit={() => setEditingId((prev) => (prev === field.id ? null : field.id))}
                onChange={(updates) => updateField(field.id, updates)}
                onRemove={() => removeField(field.id)}
                onMoveUp={() => moveField(field.id, -1)}
                onMoveDown={() => moveField(field.id, 1)}
                onDuplicate={() => duplicateField(field.id)}
              />
            ))}

            {showAdd ? (
              <AddFieldPanel onAdd={addField} onCancel={() => setShowAdd(false)} />
            ) : (
              <button
                type="button"
                onClick={() => { setShowAdd(true); setEditingId(null); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 text-md transition-all duration-200 cursor-pointer"
              >
                <IconPlus className="w-4 h-4" />
                Agregar campo
              </button>
            )}
          </div>
        </div>

        {/* ── Header visualization — collapsible, full width ── */}
        <div className="bg-linear-to-br from-zinc-800 to-zinc-900 rounded-2xl border border-zinc-700/50 shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDiagram((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-700/20 transition-colors cursor-pointer"
          >
            <h2 className="text-zinc-200 text-sm font-semibold flex items-center gap-2">
              <IconColumns className="w-4 h-4 text-zinc-400" />
              Visualización de encabezado
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 text-[10px] font-mono">estilo IETF RFC · 32 bits/fila</span>
              <IconChevron
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${showDiagram ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {showDiagram && (
            <div className="border-t border-zinc-700/50 p-4 md:p-6">
              <HeaderVisualization protocol={protocol} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
