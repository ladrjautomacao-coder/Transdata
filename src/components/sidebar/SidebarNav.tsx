import { NavLink } from "@/components/NavLink";
import { useId, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  SidebarGroup as UISidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { PermAction, PermModule } from "@/lib/permissions";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Módulo de permissão do item (todo item tem um, menos os `superAdminOnly`). */
  module?: PermModule;
  /** Ação exigida para o item aparecer (padrão: "view"). */
  action?: PermAction;
  /** Módulo em desenvolvimento: só o Super Admin vê (rota com SuperAdminRoute). */
  superAdminOnly?: boolean;
  end?: boolean;
  badge?: number;
}

/** Item do menu na lateral roxa: o ativo ganha fundo claro, ícone laranja e um filete no degradê do logo. */
export function SidebarItem({ item }: { item: NavItem }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} className="h-auto">
        <NavLink
          to={item.url}
          end={item.end}
          className="group/nav relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[14px] text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white"
          activeClassName="!bg-white/[0.13] !text-white font-semibold before:absolute before:-left-2 before:bottom-1.5 before:top-1.5 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-marca-laranja before:to-marca-rosa"
        >
          <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-white/55 transition-colors group-hover/nav:text-white group-[.font-semibold]/nav:text-orange-300" />
          <span className="truncate">{item.title}</span>
          {typeof item.badge === "number" && item.badge > 0 && (
            <span className="ml-auto min-w-[20px] rounded-full bg-marca-laranja px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white group-data-[collapsible=icon]:hidden">
              {item.badge}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarNavGroup({
  label,
  icon: Icon,
  items,
  collapsible = false,
  forceExpanded = false,
}: {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Grupo pode ser recolhido pelo título (ex.: Administração). Os demais ficam sempre abertos. */
  collapsible?: boolean;
  forceExpanded?: boolean;
}) {
  const { pathname } = useLocation();
  // Grupo da tela atual: destaca o título e abre o grupo recolhível.
  const hasActive = items.some((item) => matchPath({ path: item.url, end: item.end ?? false }, pathname) !== null);
  const [expanded, setExpanded] = useState(false);
  const { state, isMobile } = useSidebar();
  const contentId = useId();
  if (items.length === 0) return null;
  const isOpen = !collapsible || expanded || hasActive || forceExpanded;

  // Barra recolhida: não cabe a lista dentro dela — os itens abrem num menu
  // flutuante ao lado do ícone do grupo.
  if (state === "collapsed" && !isMobile) {
    return (
      <UISidebarGroup className="py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={label}
              title={label}
              className={cn(
                "relative flex h-10 w-full items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70",
                hasActive
                  ? "bg-white/[0.15] text-orange-300 before:absolute before:-left-2 before:bottom-2 before:top-2 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-marca-laranja before:to-marca-rosa"
                  : "text-white/70 hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white",
              )}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="text-primary">{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {items.map((item) => (
              <DropdownMenuItem key={item.url} asChild className="cursor-pointer">
                <NavLink
                  to={item.url}
                  end={item.end}
                  className="flex items-center gap-2 text-foreground"
                  activeClassName="!bg-primary/10 !text-primary font-semibold"
                >
                  <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="ml-auto min-w-[20px] rounded-full bg-marca-laranja px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </UISidebarGroup>
    );
  }

  // Título do grupo: rótulo pequeno em maiúsculas, discreto, sobre a lateral roxa.
  const title = <span className="truncate">{label}</span>;
  const titleClassName = cn(
    "flex min-h-7 w-full items-center gap-2 rounded-md px-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em]",
    hasActive ? "text-white/70" : "text-white/45",
  );

  return (
    <UISidebarGroup className="px-0 py-1.5">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            titleClassName,
            "transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-300/70",
          )}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {title}
          <ChevronRight
            aria-hidden="true"
            className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-90")}
          />
        </button>
      ) : (
        <div className={titleClassName}>{title}</div>
      )}
      {isOpen && (
        <SidebarGroupContent
          id={contentId}
          className="mt-0.5"
        >
          <SidebarMenu className="gap-0.5">
            {items.map((item) => (
              <SidebarItem key={item.url} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </UISidebarGroup>
  );
}
