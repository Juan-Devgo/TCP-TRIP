import { AppSidebar } from "@/components/common/AppSidebar";
import { AppHeader } from "@/components/layouts/AppHeader";
import { ContentToolbar } from "@/components/layouts/ContentToolbar";
import { findPage } from "@/config/navigation";
import { useTabs } from "@/context/TabsProvider";
import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

interface MainLayoutProps {
  className?: string;
  children: React.ReactNode;
}

export function MainLayout({ className, children }: MainLayoutProps) {
  const { activeTab } = useTabs();
  // A canvas page (the protocol diagram) drops the reading-width column; only
  // the tab on screen can decide it, since the hidden ones stay mounted here.
  const wide = activeTab ? Boolean(findPage(activeTab.rootPath)?.wide) : false;

  return (
    <div className={className}>
      <SidebarProvider>
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          {/* Spans the full content column so the tool actions sit in its
              top-right corner, outside the reading-width constraint below. */}
          <ContentToolbar />
          {/* typeset is scoped to the content only: its `ul`/`li` rules would
              otherwise put list markers on the sidebar menus. */}
          <main
            className={cn(
              "typeset typeset-docs m-auto w-full",
              wide ? "max-w-none px-4" : "max-w-[42em]",
            )}
          >
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
