import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Signal } from "lucide-react";
import { ProjectFiltersProvider } from "@/contexts/ProjectFiltersContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertsBell } from "@/components/AlertsBell";
import { CommandPalette } from "@/components/CommandPalette";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";

export function AppLayout() {
  const { portalName } = useTenantBranding();

  return (
    <ProjectFiltersProvider>
    <SidebarProvider>
      <CommandPalette />
      <AssistantWidget />
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="relative flex h-14 items-center gap-2 bg-[#4b1768] px-3 text-white md:px-4">
            <SidebarTrigger className="mr-1 text-white hover:bg-white/15 hover:text-white md:mr-4" />
            <div className="flex-1 text-center">
              <span className="truncate text-sm font-semibold tracking-wide text-white md:text-base">{portalName}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-3">
              <AlertsBell />
              <ThemeToggle />
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                <Signal className="h-3 w-3 text-white animate-pulse" />
                <span className="font-medium uppercase tracking-wider text-white/75">Sistema Online</span>
              </div>
            </div>
          </header>
          <div className="flex-1 p-3 md:p-6 overflow-auto bg-background">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
    </ProjectFiltersProvider>
  );
}

