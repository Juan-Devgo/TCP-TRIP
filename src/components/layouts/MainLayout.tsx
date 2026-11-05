import { AppSidebar } from "@/components/common/AppSidebar";
import { AppHeader } from "@/components/layouts/AppHeader";
import { ContentToolbar } from "@/components/layouts/ContentToolbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

interface MainLayoutProps {
  className?: string;
  children: React.ReactNode;
}

export function MainLayout({ className, children }: MainLayoutProps) {
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
              otherwise put list markers on the sidebar menus. Width and
              padding are per page (`src/config/pageLayout.ts`), set by
              `TabHost` on each tab panel. */}
          <main className="typeset typeset-docs m-auto w-full">
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
