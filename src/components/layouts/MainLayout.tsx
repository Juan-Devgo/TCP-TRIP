import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/layouts/AppHeader";
import { SidebarProvider } from "../ui/sidebar";
import { TooltipProvider } from "../ui/tooltip";

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
          {/* typeset is scoped to the content only: its `ul`/`li` rules would
              otherwise put list markers on the sidebar menus. */}
          <main className="typeset typeset-docs m-auto w-full max-w-[42em]">
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
