import { useState, useEffect, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { $authStore } from "@clerk/astro/client";
import HeaderVisualization from "../../../protocols/components/ProtocolBuilder/HeaderVisualization";
import type { Protocol } from "../../../protocols/types";

interface SavedProtocol extends Protocol {
  updatedAt: string;
  isPublic: boolean;
  shareCode: string | null;
}

type View = "list" | "diagram";

function CopyIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function HeaderIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

export default function MyProtocolsList() {
  const auth = useStore($authStore);
  const [protocols, setProtocols] = useState<SavedProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<Record<string, View>>({});
  const [shareStatus, setShareStatus] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProtocols = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/protocols");
      if (!res.ok) throw new Error("Error al cargar protocolos");
      const data = (await res.json()) as any[];
      setProtocols(
        data.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt) })),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.userId) fetchProtocols();
  }, [auth.userId, fetchProtocols]);

  async function handleShare(protocol: SavedProtocol) {
    if (protocol.shareCode) {
      // Already shared — copy link
      const url = `${window.location.origin}/protocols/${protocol.shareCode}`;
      await navigator.clipboard.writeText(url);
      setShareStatus((s) => ({ ...s, [protocol.id]: "copied" }));
      setTimeout(
        () => setShareStatus((s) => ({ ...s, [protocol.id]: "" })),
        2000,
      );
      return;
    }

    try {
      const res = await fetch(`/api/protocols/${protocol.id}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const { shareCode } = (await res.json()) as { shareCode: string };
      setProtocols((ps) =>
        ps.map((p) =>
          p.id === protocol.id ? { ...p, shareCode, isPublic: true } : p,
        ),
      );
      const url = `${window.location.origin}/protocols/${shareCode}`;
      await navigator.clipboard.writeText(url);
      setShareStatus((s) => ({ ...s, [protocol.id]: "copied" }));
      setTimeout(
        () => setShareStatus((s) => ({ ...s, [protocol.id]: "" })),
        2000,
      );
    } catch {
      setShareStatus((s) => ({ ...s, [protocol.id]: "error" }));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este protocolo? Esta acción no se puede deshacer."))
      return;
    setDeletingId(id);
    try {
      await fetch(`/api/protocols/${id}`, { method: "DELETE" });
      setProtocols((ps) => ps.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function toggleView(id: string) {
    setActiveView((v) => ({
      ...v,
      [id]: v[id] === "diagram" ? "list" : "diagram",
    }));
  }

  if (auth.userId === undefined) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <span className="animate-pulse">Cargando...</span>
      </div>
    );
  }

  if (auth.userId === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-400">
        <svg
          className="w-12 h-12 text-zinc-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="text-sm">
          Inicia sesión para ver tus protocolos guardados.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <span className="animate-pulse text-sm">Cargando protocolos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchProtocols}
          className="text-xs text-zinc-500 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-500">
        <svg
          className="w-12 h-12 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm text-center max-w-xs">
          No tienes protocolos guardados. Crea uno en el{" "}
          <a
            href="/protocol-creator"
            className="text-amber-400 underline hover:text-amber-300"
          >
            Constructor de Protocolos
          </a>
          .
        </p>
      </div>
    );
  }

  const btnBase =
    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer select-none";

  return (
    <div className="space-y-6">
      {protocols.map((protocol) => {
        const view = activeView[protocol.id] ?? "list";
        const isDeleting = deletingId === protocol.id;
        const copyMsg = shareStatus[protocol.id];

        return (
          <div
            key={protocol.id}
            className="bg-linear-to-br from-zinc-800 to-zinc-900 rounded-2xl border border-zinc-700/50 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-700/40">
              <div className="min-w-0">
                <h2 className="text-white font-semibold text-base truncate">
                  {protocol.name}
                </h2>
                {protocol.description && (
                  <p className="text-zinc-400 text-xs mt-0.5 line-clamp-1">
                    {protocol.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-zinc-600 text-[10px] font-mono">
                    {protocol.fields.length} campos ·{" "}
                    {protocol.fields
                      .reduce(
                        (acc, f) =>
                          acc +
                          (f.sizeBits != null ? f.sizeBits / 8 : f.sizeBytes),
                        0,
                      )
                      .toFixed(0)}{" "}
                    bytes
                  </span>
                  <span className="text-zinc-700 text-[10px]">
                    {new Date(protocol.updatedAt).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {protocol.shareCode && (
                    <span className="text-emerald-500 text-[10px] font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      público
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleView(protocol.id)}
                  className={`${btnBase} bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white`}
                  title={view === "diagram" ? "Ver lista" : "Ver diagrama RFC"}
                >
                  <EyeIcon />
                  {view === "diagram" ? "Lista" : "Diagrama"}
                </button>

                <a
                  href={`/protocol-creator?load=${protocol.id}`}
                  className={`${btnBase} bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white`}
                  title="Editar protocolo"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Editar
                </a>

                <button
                  onClick={() => handleShare(protocol)}
                  className={`${btnBase} ${
                    copyMsg === "copied"
                      ? "bg-emerald-900/40 border-emerald-600/50 text-emerald-300"
                      : "bg-blue-900/40 border-blue-700/50 text-blue-300 hover:bg-blue-800/50 hover:border-blue-500"
                  }`}
                  title="Compartir"
                >
                  {copyMsg === "copied" ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <ShareIcon />
                      {protocol.shareCode ? "Copiar enlace" : "Compartir"}
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDelete(protocol.id)}
                  disabled={isDeleting}
                  className={`${btnBase} bg-red-900/30 border-red-700/50 text-red-400 hover:bg-red-900/50 disabled:opacity-50`}
                  title="Eliminar"
                >
                  <TrashIcon />
                  {isDeleting ? "..." : ""}
                </button>
              </div>
            </div>

            {/* Body: diagram or field list */}
            <div className="p-4 md:p-6">
              {view === "diagram" ? (
                <HeaderVisualization protocol={protocol} />
              ) : (
                <div className="space-y-1.5">
                  {protocol.fields.map((field, i) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800"
                    >
                      <span className="text-zinc-600 text-[10px] font-mono w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-zinc-200 text-sm font-medium truncate">
                        {field.name}
                      </span>
                      <span className="text-zinc-500 text-xs truncate flex-1">
                        {field.meaning}
                      </span>
                      <span className="text-zinc-600 text-[10px] font-mono shrink-0">
                        {field.type} · {field.sizeBytes}B
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
