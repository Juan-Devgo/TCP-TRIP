import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layouts/MainLayout";

export function App() {
  return (
    <MainLayout>
      <h1>tcp-trip</h1>
      <p>React 19 + Tailwind 4 + shadcn/ui</p>
      <Button>Listo</Button>
    </MainLayout>
  );
}
