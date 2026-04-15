import { useState, useEffect, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { $authStore } from "@clerk/astro/client";
import HeaderVisualization from "../../../protocols/components/ProtocolBuilder/HeaderVisualization";
import type { Protocol } from "../../../protocols/types";

interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  protocolId: string | null;
  headerValues: Record<string, any>;
  payload: string;
  createdAt: string;
  readAt: string | null;
  protocolSnapshot: Protocol | null;
  fromDisplayName: string | null;
  toDisplayName: string | null;
}

type Box = "inbox" | "sent";

function EnvelopeIcon({ open = false }: { open?: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function HeaderValueRow({ label, value }: { label: string; value: any }) {
  let display = "";
  if (Array.isArray(value)) {
    // flags or ipv4
    if (value.every((v) => typeof v === "boolean")) {
      // flags
      display = value.map((v: boolean) => (v ? "1" : "0")).join(" ");
    } else {
      // ipv4
      display = (value as number[]).join(".");
    }
  } else if (typeof value === "object" && value !== null) {
    display = JSON.stringify(value);
  } else {
    display = String(value ?? "");
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
      <span className="text-zinc-500 text-xs w-28 shrink-0 truncate">{label}</span>
      <span className="text-zinc-200 text-xs font-mono truncate flex-1">{display}</span>
    </div>
  );
}

function MessageCard({ msg, box, onMarkRead }: { msg: Message; box: Box; onMarkRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = box === "inbox" && !msg.readAt;

  async function handleExpand() {
    setExpanded((v) => !v);
    if (!expanded && isUnread) {
      onMarkRead(msg.id);
      await fetch(`/api/messages/${msg.id}/read`, { method: "POST" }).catch(() => {});
    }
  }

  const protocol = msg.protocolSnapshot;
  const fieldLabels: Record<string, string> = {};
  if (protocol) {
    for (const f of protocol.fields) {
      fieldLabels[f.id] = f.name;
    }
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        isUnread
          ? "border-amber-700/40 bg-amber-950/10"
          : "border-zinc-700/50 bg-zinc-800/30"
      }`}
    >
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700/20 transition-colors text-left"
      >
        {isUnread && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-200 text-sm font-medium">
              {box === "inbox"
                ? (msg.fromDisplayName ?? msg.fromUserId)
                : (msg.toDisplayName ?? msg.toUserId)}
            </span>
            {protocol && (
              <span className="text-zinc-500 text-[10px] font-mono border border-zinc-700 rounded px-1.5 py-0.5">
                {protocol.name}
              </span>
            )}
          </div>
          {msg.payload && (
            <p className="text-zinc-500 text-xs mt-0.5 truncate">{msg.payload}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-zinc-600 text-[10px]">
            {new Date(msg.createdAt).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-700/40 pt-3 space-y-4">
          {/* Header values */}
          {Object.keys(msg.headerValues).length > 0 && (
            <div>
              <h4 className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider mb-2">
                Valores del encabezado
              </h4>
              <div className="space-y-1">
                {Object.entries(msg.headerValues).map(([key, val]) => (
                  <HeaderValueRow key={key} label={fieldLabels[key] ?? key} value={val} />
                ))}
              </div>
            </div>
          )}

          {/* RFC Diagram */}
          {protocol && (
            <div>
              <h4 className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider mb-2">
                Diagrama RFC del protocolo
              </h4>
              <div className="bg-zinc-900/40 rounded-xl border border-zinc-800 p-3">
                <HeaderVisualization protocol={protocol} />
              </div>
            </div>
          )}

          {/* Payload */}
          {msg.payload && (
            <div>
              <h4 className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider mb-2">
                Mensaje
              </h4>
              <p className="text-zinc-300 text-sm bg-zinc-900/40 rounded-xl border border-zinc-800 px-4 py-3">
                {msg.payload}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessagesView() {
  const auth = useStore($authStore);
  const [box, setBox] = useState<Box>("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async (b: Box) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages?box=${b}`);
      if (!res.ok) throw new Error("Error al cargar mensajes");
      setMessages((await res.json()) as Message[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.userId) fetchMessages(box);
  }, [auth.userId, box, fetchMessages]);

  function handleMarkRead(id: string) {
    setMessages((ms) =>
      ms.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m))
    );
  }

  if (auth.userId === undefined) {
    return <div className="flex items-center justify-center py-24 text-zinc-500 animate-pulse text-sm">Cargando...</div>;
  }

  if (auth.userId === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-400">
        <svg className="w-12 h-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-sm">Inicia sesión para ver tus mensajes.</p>
      </div>
    );
  }

  const unreadCount = messages.filter((m) => !m.readAt).length;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-700/50 pb-2">
        <button
          onClick={() => setBox("inbox")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            box === "inbox"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <EnvelopeIcon />
          Recibidos
          {box === "inbox" && unreadCount > 0 && (
            <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setBox("sent")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            box === "sent"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Enviados
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-zinc-500 animate-pulse text-sm">
          Cargando mensajes...
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-400 text-sm">
          {error}
          <button onClick={() => fetchMessages(box)} className="block mx-auto mt-2 text-zinc-500 underline text-xs">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
          <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">
            {box === "inbox" ? "No tienes mensajes recibidos." : "No has enviado mensajes aún."}
          </p>
          {box === "inbox" && (
            <p className="text-xs text-zinc-600 text-center max-w-xs">
              Cuando alguien te envíe un encabezado de protocolo, aparecerá aquí.
            </p>
          )}
        </div>
      )}

      {!loading && !error && messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageCard key={msg.id} msg={msg} box={box} onMarkRead={handleMarkRead} />
          ))}
        </div>
      )}
    </div>
  );
}
