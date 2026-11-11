import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ProjectFiltersProvider } from "@/contexts/ProjectFiltersContext";
import { CommandPalette } from "@/components/CommandPalette";
import { FaixaPortal } from "@/components/layout/FaixaPortal";

/**
 * Moldura do portal: a faixa superior de ponta a ponta (FaixaPortal) e, abaixo dela, a lateral roxa
 * da marca e a tela.
 */
export function AppLayout() {
  const location = useLocation();

  return (
    <ProjectFiltersProvider>
    <SidebarProvider>
      <CommandPalette />
      <div className="flex min-h-svh w-full flex-col">
        <FaixaPortal />
        <div className="flex w-full flex-1">
          {/* a lateral fica fixa abaixo da faixa; este bloco só reserva a largura dela */}
          <div className="shrink-0 self-start md:h-[calc(100svh-3.5rem)] md:overflow-hidden">
            <AppSidebar />
          </div>
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-auto bg-background p-3 md:p-6">
              {/* erro numa tela não derruba o portal: menu e faixa continuam, e trocar de tela limpa o erro */}
              <AppErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </AppErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </ProjectFiltersProvider>
  );
}
