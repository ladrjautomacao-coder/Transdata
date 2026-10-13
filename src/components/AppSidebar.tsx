import { useMemo, useState } from "react";
import {
  FolderKanban, LayoutDashboard, HardHat, BookOpenCheck, Users, LogOut, ShieldCheck,
  Settings, KeyRound, LifeBuoy, Wallet, ChevronsLeft, Search, MoreVertical, UserRound, Eye, FileUp, Building2, Tag,
  CalendarPlus, CalendarRange, BookOpen, ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar, SidebarContent, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarNavGroup, type NavItem } from "@/components/sidebar/SidebarNav";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";

interface NavGroupDef {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

/** Badges are driven by state so they can be wired to live counters later. */
export interface SidebarBadges {
  financeiro?: number;
  suporte?: number;
  projects?: number;
}

export function AppSidebar({ badges = {} }: { badges?: SidebarBadges }) {
  const { signOut, profile, isAdmin, isSuperAdmin } = useAuth();
  const { can } = usePermissions();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const collapsed = state === "collapsed" && !isMobile;

  const groups: NavGroupDef[] = useMemo(() => [
    {
      label: "Projetos",
      icon: FolderKanban,
      items: [
        { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard", end: true },
        { title: "Gestão de Projetos", url: "/projetos", icon: FolderKanban, module: "projects", badge: badges.projects },
        { title: "Visão Comercial", url: "/comercial", icon: Eye, module: "visao_comercial" },
      ],
    },
    {
      label: "Implantação",
      icon: HardHat,
      items: [
        { title: "Report IMP", url: "/implantacao/report-imp", icon: FileUp, module: "report_imp" },
        { title: "Solicitação de agenda", url: "/implantacao/solicitacoes", icon: CalendarPlus, module: "agenda_solicitacao" },
        { title: "Aprovação de agenda", url: "/implantacao/aprovacao", icon: ClipboardCheck, module: "agenda_solicitacao", action: "approve" },
        { title: "Calendário", url: "/implantacao/calendario", icon: CalendarRange, module: "agenda_calendario" },
      ],
    },
    {
      label: "Gestão de Contratos",
      icon: Wallet,
      items: [{ title: "Gestão de Contratos", url: "/financeiro", icon: Wallet, module: "financeiro", badge: badges.financeiro }],
    },
    {
      label: "Suporte Técnico",
      icon: LifeBuoy,
      items: [
        { title: "Suporte Técnico", url: "/suporte", icon: LifeBuoy, module: "suporte", badge: badges.suporte },
        { title: "Acervo Técnico", url: "/acervo", icon: BookOpen, module: "acervo" },
      ],
    },
    {
      label: "Administração",
      icon: Settings,
      items: [
        { title: "Equipe", url: "/admin/equipe", icon: Users, module: "admin_team" },
        { title: "Usuários", url: "/admin/usuarios", icon: ShieldCheck, module: "admin_users" },
        { title: "Permissões", url: "/admin/permissoes", icon: KeyRound, module: "admin_users" },
        { title: "Configurações", url: "/admin/configuracoes", icon: Settings, module: "admin_settings" },
        { title: "Personalização", url: "/admin/tipos-projeto", icon: Tag, module: "admin_settings" },
        { title: "Manual do Sistema", url: "/manual", icon: BookOpenCheck, module: "admin_manual" },
      ],
    },
  ], [badges.financeiro, badges.suporte, badges.projects]);

  const visibleGroups = groups
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        can(i.module, i.action ?? "view") &&
        (query.trim() === "" || i.title.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    }))
    .filter(g => g.items.length > 0);

  const branding = useTenantBranding();
  const name = profile?.full_name || "Usuário";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "U";
  const roleLabel = isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Usuário";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{
        fontFamily: "'Source Sans 3', sans-serif",
        // Valores em src/index.css (--app-sidebar-*): claro = branco da marca, escuro = tema escuro.
        "--sidebar-background": "var(--app-sidebar-background)",
        "--sidebar-foreground": "var(--app-sidebar-foreground)",
        "--sidebar-primary": "var(--app-sidebar-primary)",
        "--sidebar-primary-foreground": "var(--app-sidebar-primary-foreground)",
        "--sidebar-accent": "var(--app-sidebar-accent)",
        "--sidebar-accent-foreground": "var(--app-sidebar-accent-foreground)",
        "--sidebar-border": "var(--app-sidebar-border)",
        "--sidebar-ring": "var(--app-sidebar-ring)",
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className={`relative flex h-14 shrink-0 items-center overflow-hidden bg-[#4b1768] text-white ${collapsed ? "justify-center px-0" : "px-3"}`}>
        <div className={`relative z-10 flex min-w-0 items-center gap-2.5 ${collapsed ? "" : "flex-1"}`}>
          {/* object-contain: logos não quadrados (ex.: marca com texto) aparecem inteiros, sem recorte */}
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.portalName}
              className={`shrink-0 rounded-md object-contain ${collapsed ? "h-9 w-9" : "h-10 w-10"}`}
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15 text-white">
              <Building2 className="h-5 w-5" />
            </div>
          )}
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold tracking-wide text-white">{branding.portalName}</span>
                <span className="truncate text-[10px] uppercase tracking-[0.12em] text-white/65">Sistema de gestão</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label="Recolher menu"
                className="ml-auto h-7 w-7 text-white/75 hover:bg-white/15 hover:text-white"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

      </div>

      {!collapsed && (
        <div className="shrink-0 bg-white px-3 pb-3 pt-2 dark:bg-sidebar">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no menu..."
              className="h-8 rounded-md border-slate-200 bg-white pl-8 text-xs text-slate-800 placeholder:text-slate-500 focus-visible:ring-sidebar-ring dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground dark:placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <SidebarContent className="bg-white dark:bg-sidebar">
        {visibleGroups.map(g => (
          <SidebarNavGroup
            key={g.label}
            label={g.label}
            icon={g.icon}
            items={g.items}
            forceExpanded={query.trim() !== ""}
          />
        ))}
        {visibleGroups.length === 0 && !collapsed && (
          <p className="px-4 py-3 text-xs text-sidebar-foreground/40">Nenhum item encontrado.</p>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border bg-white p-2 dark:bg-sidebar">
        <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-slate-800 dark:text-sidebar-foreground">{name}</span>
                <span className="truncate text-[10px] text-slate-500 dark:text-muted-foreground">{roleLabel}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Opções da conta"
                    className="ml-auto h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-sidebar-primary dark:text-muted-foreground dark:hover:bg-sidebar-accent"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-44">
                  <DropdownMenuItem onClick={() => navigate("/admin/equipe")}>
                    <UserRound className="mr-2 h-4 w-4" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/configuracoes")}>
                    <Settings className="mr-2 h-4 w-4" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
