import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ModeToggle } from "@/components/ModeToggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-16.25 shrink-0 items-center justify-between gap-4 border-b border-sidebar-border bg-sidebar px-4 py-2 text-sidebar-foreground">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <br />
        <Separator
          orientation="vertical"
          className="h-4! data-vertical:self-center bg-sidebar-foreground/40"
        />
        <br />
        <AppBreadcrumb />
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <LanguageToggle />
      </div>
    </header>
  );
}
