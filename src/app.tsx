import { Button } from "@/components/ui/button";

export function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">tcp-trip</h1>
      <p className="text-muted-foreground text-sm">
        React 19 + Tailwind 4 + shadcn/ui
      </p>
      <Button>Listo</Button>
    </main>
  );
}
