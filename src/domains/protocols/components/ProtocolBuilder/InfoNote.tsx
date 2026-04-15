import type { ReactNode } from "react";

export default function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] text-zinc-600 bg-zinc-900/50 border border-zinc-800 rounded-lg px-2.5 py-2 font-mono">
      {children}
    </p>
  );
}
