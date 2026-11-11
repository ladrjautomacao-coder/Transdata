import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ProjectFiltersProvider } from "@/contexts/ProjectFiltersContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertsBell } from "@/components/AlertsBell";
import { CommandPalette } from "@/components/CommandPalette";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { InstallAppButton } from "@/pwa/InstallAppButton";
import { Migalhas, MigalhaProvider } from "@/components/layout/Migalhas";
import { abrirBusca } from "@/lib/atalhos";

/**
 * Moldura do portal: lateral roxa da marca e topo claro com o caminho de navegação, a busca (Ctrl+K),
 * o assistente, os avisos e o tema.
 */
export function AppLayout() {
  const { portalName } = useTenantBranding();
  const location = useLocation();
  // trecho que a tela acrescenta ao caminho (ex.: o projeto aberto no Gerenciamento)
  const [migalha, setMigalha] = useState<string | null>(null);

  return (
    <ProjectFiltersProvider>
    <SidebarProvider>
      <CommandPalette />
      <MigalhaProvider value={setMigalha}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center gap-2 border-b bg-card px-3 md:h-16 md:gap-3 md:px-6">
            <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" />
            <div className="min-w-0 flex-1">
              <Migalhas extra={migalha} fallback={portalName} />
            </div>
            <div className="flex shrink-0 items-center gap-1 md:gap-2">
              <button
                type="button"
                onClick={abrirBusca}
                aria-label="Buscar projeto, cidade ou gestor (Ctrl+K)"
                title="Buscar (Ctrl+K)"
                className="flex h-9 w-9 items-center justify-center gap-2 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:w-80 lg:justify-start lg:border lg:border-border lg:bg-background lg:px-3 lg:hover:bg-muted/60"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="hidden truncate text-[13px] lg:inline">Buscar projeto, cidade ou gestor</span>
                <kbd className="ml-auto hidden whitespace-nowrap rounded border border-border bg-card px-1.5 font-sans text-[11px] text-muted-foreground lg:inline">Ctrl K</kbd>
              </button>
              <AssistantWidget />
              <InstallAppButton />
              <AlertsBell />
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 p-3 md:p-6 overflow-auto bg-background">
            {/* erro numa tela não derruba o portal: menu e topo continuam, e trocar de tela limpa o erro */}
            <AppErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>
      </div>
      </MigalhaProvider>
    </SidebarProvider>
    </ProjectFiltersProvider>
  );
}
