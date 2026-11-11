import { useMemo, useState } from "react";
import { LogOut, Settings, ChevronsLeft, Search, MoreVertical, UserRound, Building2 } from "lucide-react";
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
import { SidebarNavGroup } from "@/components/sidebar/SidebarNav";
import { gruposDoMenu, type SidebarBadges } from "@/components/sidebar/menu";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { cn } from "@/lib/utils";

export type { SidebarBadges } from "@/components/sidebar/menu";

/**
 * Lateral do portal no roxo da marca: começa na cor do fundo do logo (o logo se funde com ela) e
 * escurece para baixo (.lateral-marca em src/index.css). Recolhida, mostra só o "T" do logo e os grupos.
 */
export function AppSidebar({ badges = {} }: { badges?: SidebarBadges }) {
  const { signOut, profile, isAdmin, isSuperAdmin } = useAuth();
  const { can } = usePermissions();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const collapsed = state === "collapsed" && !isMobile;

  const groups = useMemo(() => gruposDoMenu(badges), [badges]);

  const visibleGroups = groups
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        (i.superAdminOnly ? isSuperAdmin : !!i.module && can(i.module, i.action ?? "view")) &&
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
      className="lateral-marca border-r-0"
      style={{
        // Valores em src/index.css (--app-sidebar-*): roxo da marca nos dois temas.
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
      {/* Logo: o fundo roxo do logo é a cor de cima da lateral */}
      <div className={cn("relative flex shrink-0 items-center", collapsed ? "h-16 justify-center" : "h-[76px] px-2")}>
        {branding.logoUrl ? (
          collapsed ? (
            <span
              role="img"
              aria-label={branding.portalName}
              className="h-8 w-[25px] shrink-0 bg-no-repeat"
              // só o "T" do logo (o nome começa logo à direita dele)
              style={{ backgroundImage: `url(${branding.logoUrl})`, backgroundSize: "100px auto", backgroundPosition: "-3px -30px" }}
            />
          ) : (
            <img src={branding.logoUrl} alt={branding.portalName} className="h-[68px] w-full max-w-[200px] object-cover object-[50%_60%]" />
          )
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15 text-white">
            <Building2 className="h-5 w-5" />
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Recolher menu"
            title="Recolher menu"
            className="absolute right-2 top-2 h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/55" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no menu"
              aria-label="Buscar no menu"
              className="h-9 rounded-lg border-white/15 bg-white/[0.08] pl-8 text-[13px] text-white placeholder:text-white/55 focus-visible:ring-1 focus-visible:ring-orange-300/70 focus-visible:ring-offset-0"
            />
          </div>
        </div>
      )}

      <SidebarContent className="gap-0 px-2 pb-2">
        {visibleGroups.map(g => (
          <SidebarNavGroup
            key={g.label}
            label={g.label}
            icon={g.icon}
            items={g.items}
            collapsible={g.collapsible}
            forceExpanded={query.trim() !== ""}
          />
        ))}
        {visibleGroups.length === 0 && !collapsed && (
          <p className="px-3 py-3 text-xs text-white/55">Nenhum item encontrado.</p>
        )}
      </SidebarContent>

      {/* Quem está usando */}
      <SidebarFooter className="border-t border-white/10 p-3">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marca-laranja to-marca-rosa text-[11px] font-bold text-white" title={collapsed ? name : undefined}>
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold text-white">{name}</span>
                <span className="flex items-center gap-1.5 truncate text-[11px] text-white/60">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{roleLabel} · online
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Opções da conta"
                    className="ml-auto h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
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
