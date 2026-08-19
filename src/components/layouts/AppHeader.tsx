import { LanguageToggle } from "@/components/LanguageToggle";
import { TabBar } from "@/components/layouts/TabBar";
import { ModeToggle } from "@/components/ModeToggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-16.25 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 py-2 text-sidebar-foreground">
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="h-4! data-vertical:self-center bg-sidebar-foreground/40"
      />

      <TabBar />

      <Separator
        orientation="vertical"
        className="h-4! data-vertical:self-center bg-sidebar-foreground/40"
      />
      <div className="flex shrink-0 items-center gap-2">
        <ModeToggle />
        <LanguageToggle />
      </div>
    </header>
  );
}
