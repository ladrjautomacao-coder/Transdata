import { useMemo, useState } from "react";
import {
  FolderKanban, LayoutDashboard, HardHat, BookOpenCheck, Users, LogOut, ShieldCheck,
  Settings, KeyRound, LifeBuoy, Wallet, ChevronsLeft, Search, MoreVertical, UserRound, Eye, FileUp, Building2, Tag,
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
        { title: "Implantação", url: "/implantacao", icon: HardHat, module: "implantacao", end: true },
        { title: "Report IMP", url: "/implantacao/report-imp", icon: FileUp, module: "report_imp" },
      ],
    },
    {
      label: "Financeiro",
      icon: Wallet,
      items: [{ title: "Financeiro", url: "/financeiro", icon: Wallet, module: "financeiro", badge: badges.financeiro }],
    },
    {
      label: "Suporte Técnico",
      icon: LifeBuoy,
      items: [{ title: "Suporte Técnico", url: "/suporte", icon: LifeBuoy, module: "suporte", badge: badges.suporte }],
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
        can(i.module, "view") &&
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
        "--sidebar-background": "0 0% 100%",
        "--sidebar-foreground": "222 18% 18%",
        "--sidebar-primary": "276 63% 28%",
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "276 40% 95%",
        "--sidebar-accent-foreground": "276 63% 24%",
        "--sidebar-border": "220 14% 90%",
        "--sidebar-ring": "276 63% 28%",
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="relative flex h-14 shrink-0 items-center overflow-hidden bg-[#4b1768] px-3 text-white">
        <div className="relative z-10 flex items-center gap-2.5">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.portalName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
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
        <div className="shrink-0 bg-white px-3 pb-3 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no menu..."
              className="h-8 rounded-md border-slate-200 bg-white pl-8 text-xs text-slate-800 placeholder:text-slate-500 focus-visible:ring-sidebar-ring"
            />
          </div>
        </div>
      )}

      <SidebarContent className="bg-white">
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
      <SidebarFooter className="border-t border-sidebar-border bg-white p-2">
        <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-slate-800">{name}</span>
                <span className="truncate text-[10px] text-slate-500">{roleLabel}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Opções da conta"
                    className="ml-auto h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-sidebar-primary"
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
