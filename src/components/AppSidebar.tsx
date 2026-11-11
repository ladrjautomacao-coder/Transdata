import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { SidebarNavGroup } from "@/components/sidebar/SidebarNav";
import { gruposDoMenu, type SidebarBadges } from "@/components/sidebar/menu";
import { cn } from "@/lib/utils";

export type { SidebarBadges } from "@/components/sidebar/menu";

/**
 * Lateral do portal no roxo da marca, abaixo da faixa superior (a marca, a conta e o botão de
 * recolher ficam na faixa). Recolhida, mostra só os ícones dos grupos.
 */
export function AppSidebar({ badges = {} }: { badges?: SidebarBadges }) {
  const { isSuperAdmin } = useAuth();
  const { can } = usePermissions();
  const { state, isMobile } = useSidebar();
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

  return (
    <Sidebar
      collapsible="icon"
      // no computador a lateral começa abaixo da faixa superior (h-14)
      className="lateral-marca border-r-0 md:top-14 md:h-[calc(100svh-3.5rem)]"
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
      {!collapsed && (
        <div className="shrink-0 px-3 pb-1 pt-4">
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

      <SidebarContent className={cn("gap-0 px-2 pb-4", collapsed ? "pt-3" : "pt-1")}>
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
    </Sidebar>
  );
}
