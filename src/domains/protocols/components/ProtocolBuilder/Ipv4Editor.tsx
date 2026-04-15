import type { EditorProps } from "./types";
import InfoNote from "./InfoNote";

export default function Ipv4Editor(_: EditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <span className="font-mono text-cyan-400">4 bytes</span>
        <span className="text-zinc-600">·</span>
        <span>Tamaño fijo — formato A.B.C.D</span>
      </div>
      <InfoNote>
        La dirección IPv4 concreta se introduce al crear el encabezado.
      </InfoNote>
    </div>
  );
}
