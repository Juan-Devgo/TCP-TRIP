import { useState, useEffect, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { $authStore } from "@clerk/astro/client";
import HeaderVisualization from "../ProtocolBuilder/HeaderVisualization";
import type { Protocol, ProtocolField } from "../../types";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, any>;

interface UserResult {
  id: string;
  displayName: string;
  email: string;
  imageUrl: string;
}

// ─── Field value editors ──────────────────────────────────────────────────────

function UintValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: number;
  onChange: (v: number) => void;
}) {
  const max = Math.pow(2, field.sizeBytes * 8) - 1;
  return (
    <div>
      <label className="text-zinc-400 text-[10px] font-medium block mb-1">
        Valor (0–{max})
      </label>
      <input
        type="number"
        min={0}
        max={max}
        value={value ?? 0}
        onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value))))}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
      />
      <span className="text-zinc-600 text-[10px] font-mono">
        0x{(value ?? 0).toString(16).toUpperCase().padStart(field.sizeBytes * 2, "0")}
      </span>
    </div>
  );
}

function FlagsValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: boolean[];
  onChange: (v: boolean[]) => void;
}) {
  const bits = field.flagBits ?? [];
  const vals: boolean[] = value ?? bits.map(() => false);

  return (
    <div>
      <label className="text-zinc-400 text-[10px] font-medium block mb-2">Flags</label>
      <div className="flex flex-wrap gap-2">
        {bits.map((bit, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const next = [...vals];
              next[i] = !next[i];
              onChange(next);
            }}
            className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
              bit.reserved
                ? "opacity-40 cursor-not-allowed bg-zinc-800 border-zinc-700 text-zinc-500"
                : vals[i]
                ? "bg-amber-600/40 border-amber-500 text-amber-200"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
            disabled={bit.reserved}
          >
            {bit.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function AsciiValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: string;
  onChange: (v: string) => void;
}) {
  const maxLen = field.asciiFixedSize ? field.sizeBytes : undefined;
  return (
    <div>
      <label className="text-zinc-400 text-[10px] font-medium block mb-1">
        Texto ASCII{maxLen ? ` (máx. ${maxLen} chars)` : ""}
      </label>
      <input
        type="text"
        maxLength={maxLen}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
      />
    </div>
  );
}

function HexValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: string;
  onChange: (v: string) => void;
}) {
  const maxChars = field.sizeBytes * 2;
  return (
    <div>
      <label className="text-zinc-400 text-[10px] font-medium block mb-1">
        Hex (máx. {maxChars} dígitos)
      </label>
      <input
        type="text"
        maxLength={maxChars}
        value={value ?? ""}
        placeholder={"0".repeat(maxChars)}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, maxChars))}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm font-mono outline-none focus:border-zinc-500 uppercase"
      />
    </div>
  );
}

function Ipv4ValueEditor({
  value,
  onChange,
}: {
  value: [number, number, number, number];
  onChange: (v: [number, number, number, number]) => void;
}) {
  const octets: [number, number, number, number] = value ?? [0, 0, 0, 0];
  return (
    <div>
      <label className="text-zinc-400 text-[10px] font-medium block mb-1">
        Dirección IPv4
      </label>
      <div className="flex items-center gap-1">
        {octets.map((oct, i) => (
          <span key={i} className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={255}
              value={oct}
              onChange={(e) => {
                const next = [...octets] as [number, number, number, number];
                next[i] = Math.min(255, Math.max(0, Number(e.target.value)));
                onChange(next);
              }}
              className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-sm text-center outline-none focus:border-zinc-500"
            />
            {i < 3 && <span className="text-zinc-500">.</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function EnumValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: number;
  onChange: (v: number) => void;
}) {
  const options = field.enumOptions ?? [];
  return (
    <div>
      <label className="text-zinc-400 text-[10px] font-medium block mb-1">
        Valor
      </label>
      <select
        value={value ?? options[0]?.value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} ({opt.value})
          </option>
        ))}
      </select>
    </div>
  );
}

function CompositeValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const subFields = field.subFields ?? [];
  const vals = value ?? {};

  return (
    <div className="space-y-3">
      {subFields.map((sf) => (
        <div key={sf.id} className="pl-3 border-l border-zinc-700">
          <label className="text-zinc-400 text-[10px] font-medium block mb-1">
            {sf.name} ({sf.sizeBits}b)
          </label>
          {sf.type === "uint" && (
            <input
              type="number"
              min={0}
              max={Math.pow(2, sf.sizeBits) - 1}
              value={vals[sf.id] ?? 0}
              onChange={(e) =>
                onChange({ ...vals, [sf.id]: Math.min(Math.pow(2, sf.sizeBits) - 1, Math.max(0, Number(e.target.value))) })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
            />
          )}
          {sf.type === "flags" && (
            <input
              type="number"
              min={0}
              max={Math.pow(2, sf.sizeBits) - 1}
              value={vals[sf.id] ?? 0}
              onChange={(e) =>
                onChange({ ...vals, [sf.id]: Number(e.target.value) })
              }
              className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
            />
          )}
          {sf.type === "ascii" && (
            <input
              type="text"
              value={vals[sf.id] ?? ""}
              onChange={(e) => onChange({ ...vals, [sf.id]: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
            />
          )}
          {(sf.type === "hex" || sf.type === "padding") && (
            <input
              type="text"
              value={vals[sf.id] ?? ""}
              placeholder="00"
              onChange={(e) =>
                onChange({
                  ...vals,
                  [sf.id]: e.target.value.replace(/[^0-9A-Fa-f]/g, ""),
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm font-mono outline-none focus:border-zinc-500 uppercase"
            />
          )}
          {sf.type === "enum" && (
            <input
              type="number"
              min={0}
              max={Math.pow(2, sf.sizeBits) - 1}
              value={vals[sf.id] ?? 0}
              onChange={(e) => onChange({ ...vals, [sf.id]: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldValueEditor({
  field,
  value,
  onChange,
}: {
  field: ProtocolField;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (field.type) {
    case "uint":
      return <UintValueEditor field={field} value={value} onChange={onChange} />;
    case "flags":
      return <FlagsValueEditor field={field} value={value} onChange={onChange} />;
    case "ascii":
      return <AsciiValueEditor field={field} value={value} onChange={onChange} />;
    case "hex":
      return <HexValueEditor field={field} value={value} onChange={onChange} />;
    case "ipv4":
      return <Ipv4ValueEditor value={value} onChange={onChange} />;
    case "enum":
      return <EnumValueEditor field={field} value={value} onChange={onChange} />;
    case "padding":
      return (
        <p className="text-zinc-600 text-xs italic">
          Relleno automático — byte 0x{(field.paddingByte ?? 0).toString(16).padStart(2, "0").toUpperCase()}
        </p>
      );
    case "composite":
      return <CompositeValueEditor field={field} value={value} onChange={onChange} />;
  }
}

// ─── User search ──────────────────────────────────────────────────────────────

function UserSearchInput({
  onSelect,
}: {
  onSelect: (user: UserResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { users?: UserResult[] };
        setResults(data.users ?? []);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <label className="text-zinc-400 text-[10px] font-medium block mb-1">
        Destinatario (busca por email)
      </label>
      <input
        type="email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="correo@ejemplo.com"
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500"
      />
      {searching && (
        <p className="text-zinc-500 text-[10px] mt-1 animate-pulse">Buscando...</p>
      )}
      {results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setQuery(u.email);
                setResults([]);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-700 transition-colors text-left"
            >
              {u.imageUrl ? (
                <img src={u.imageUrl} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-300">
                  {u.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-zinc-200 text-xs font-medium">{u.displayName}</p>
                <p className="text-zinc-500 text-[10px]">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {!searching && query.length >= 3 && results.length === 0 && (
        <p className="text-zinc-600 text-[10px] mt-1">Sin resultados. Prueba con otro email.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  protocol: Protocol;
  onClose?: () => void;
}

export default function HeaderCreator({ protocol, onClose }: Props) {
  const auth = useStore($authStore);
  const [values, setValues] = useState<FieldValues>({});
  const [recipient, setRecipient] = useState<UserResult | null>(null);
  const [payload, setPayload] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize default values
  useEffect(() => {
    const defaults: FieldValues = {};
    for (const field of protocol.fields) {
      switch (field.type) {
        case "uint":
          defaults[field.id] = 0;
          break;
        case "flags":
          defaults[field.id] = (field.flagBits ?? []).map(() => false);
          break;
        case "ascii":
          defaults[field.id] = "";
          break;
        case "hex":
          defaults[field.id] = "";
          break;
        case "ipv4":
          defaults[field.id] = [0, 0, 0, 0];
          break;
        case "enum":
          defaults[field.id] = field.enumOptions?.[0]?.value ?? 0;
          break;
        case "padding":
          defaults[field.id] = field.paddingByte ?? 0;
          break;
        case "composite":
          defaults[field.id] = {};
          break;
      }
    }
    setValues(defaults);
  }, [protocol]);

  // Build a protocol with instance values applied for the preview diagram
  const previewProtocol: Protocol = {
    ...protocol,
    fields: protocol.fields.map((f) => {
      const v = values[f.id];
      switch (f.type) {
        case "uint":
          return { ...f, uintValue: v ?? 0 };
        case "flags":
          return {
            ...f,
            flagBits: (f.flagBits ?? []).map((bit, i) => ({
              ...bit,
              value: (v as boolean[])?.[i] ?? false,
            })),
          };
        case "ascii":
          return { ...f, asciiValue: v ?? "" };
        case "hex":
          return { ...f, hexValue: v ?? "" };
        case "ipv4":
          return { ...f, ipv4Value: v ?? [0, 0, 0, 0] };
        case "enum":
          return { ...f, enumSelected: v };
        default:
          return f;
      }
    }),
  };

  async function handleSend() {
    if (!recipient) {
      setError("Selecciona un destinatario.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: recipient.id,
          protocolId: (protocol as any).id ?? null,
          headerValues: values,
          payload,
          protocolSnapshot: protocol,
          toDisplayName: recipient.displayName,
        }),
      });
      if (!res.ok) throw new Error("Error al enviar el mensaje.");
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-zinc-300">
        <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-medium">¡Mensaje enviado!</p>
        <p className="text-zinc-500 text-sm text-center">
          El encabezado de <span className="text-white">{protocol.name}</span> fue enviado a{" "}
          <span className="text-amber-300">{recipient?.displayName}</span>.
        </p>
        <div className="flex gap-3 mt-2">
          <a href="/messages" className="text-xs text-blue-400 underline hover:text-blue-300">
            Ver mensajes
          </a>
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-500 underline hover:text-zinc-300">
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">Crear encabezado</h2>
          <p className="text-zinc-400 text-sm mt-0.5">{protocol.name}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Field value editors */}
      <div className="space-y-4">
        <h3 className="text-zinc-300 text-sm font-semibold">Valores de los campos</h3>
        {protocol.fields.map((field) => (
          <div
            key={field.id}
            className="bg-zinc-900/60 rounded-xl border border-zinc-800 px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white text-sm font-medium">{field.name}</span>
              <span className="text-zinc-600 text-[10px] font-mono">{field.type} · {field.sizeBytes}B</span>
            </div>
            {field.meaning && (
              <p className="text-zinc-500 text-[10px] mb-2">{field.meaning}</p>
            )}
            <FieldValueEditor
              field={field}
              value={values[field.id]}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Preview toggle */}
      <button
        type="button"
        onClick={() => setShowPreview((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm transition-all"
      >
        <span>Vista previa del diagrama</span>
        <svg
          className={`w-4 h-4 transition-transform ${showPreview ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {showPreview && (
        <div className="bg-zinc-900/40 rounded-xl border border-zinc-800 p-4">
          <HeaderVisualization protocol={previewProtocol} />
        </div>
      )}

      {/* Send section */}
      {auth.userId && (
        <div className="bg-zinc-900/40 rounded-xl border border-zinc-800 p-4 space-y-4">
          <h3 className="text-zinc-300 text-sm font-semibold">Enviar encabezado</h3>

          <UserSearchInput onSelect={setRecipient} />

          {recipient && (
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-zinc-300 text-xs">{recipient.displayName} ({recipient.email})</span>
              <button onClick={() => setRecipient(null)} className="ml-auto text-zinc-600 hover:text-zinc-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div>
            <label className="text-zinc-400 text-[10px] font-medium block mb-1">
              Mensaje (opcional)
            </label>
            <textarea
              rows={3}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Escribe un mensaje adicional..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !recipient}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-700/70 hover:bg-amber-700 border border-amber-600/50 hover:border-amber-500 text-amber-200 hover:text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="animate-pulse">Enviando...</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Enviar encabezado
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
