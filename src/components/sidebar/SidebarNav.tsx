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

export function SidebarItem({ item }: { item: NavItem }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} className="h-auto">
        <NavLink
          to={item.url}
          end={item.end}
          className="group/nav flex items-center gap-2 rounded-md px-3 py-1.5 text-slate-700 border-l-[3px] border-transparent transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950 dark:text-sidebar-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
          activeClassName="!bg-[#f1e8f6] !text-[#4b1768] font-semibold !border-[#4b1768] dark:!bg-primary/15 dark:!text-primary dark:!border-primary"
        >
          <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 transition-colors group-hover/nav:text-[#4b1768] group-[.font-semibold]/nav:text-[#4b1768] dark:group-hover/nav:text-primary dark:group-[.font-semibold]/nav:text-primary" />
          <span className="truncate">{item.title}</span>
          {typeof item.badge === "number" && item.badge > 0 && (
            <span
              className={cn(
                "ml-auto min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none",
                "bg-slate-200 text-slate-700 dark:bg-sidebar-accent dark:text-sidebar-foreground",
                "group-[.font-semibold]/nav:bg-[#4b1768] group-[.font-semibold]/nav:text-white",
                "dark:group-[.font-semibold]/nav:bg-primary dark:group-[.font-semibold]/nav:text-primary-foreground",
                "group-data-[collapsible=icon]:hidden",
              )}
            >
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
                "flex h-10 w-full items-center justify-center rounded-md border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b1768] dark:focus-visible:ring-primary",
                hasActive
                  ? "border-[#4b1768] bg-[#4b1768] text-white hover:bg-[#5c1f7f] dark:border-primary dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                  : "border-slate-200 bg-[#f8f4fb] text-[#4b1768] hover:bg-[#f1e8f6] data-[state=open]:bg-[#f1e8f6] dark:border-sidebar-border dark:bg-sidebar-accent dark:text-primary dark:hover:bg-primary/15 dark:data-[state=open]:bg-primary/15",
              )}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="text-[#4b1768] dark:text-primary">{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {items.map((item) => (
              <DropdownMenuItem key={item.url} asChild className="cursor-pointer">
                <NavLink
                  to={item.url}
                  end={item.end}
                  className="flex items-center gap-2 text-slate-700 dark:text-foreground"
                  activeClassName="!bg-[#f1e8f6] !text-[#4b1768] font-semibold dark:!bg-primary/15 dark:!text-primary"
                >
                  <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="ml-auto min-w-[20px] rounded-full bg-slate-200 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-slate-700 dark:bg-muted dark:text-foreground">
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

  // Título do grupo em destaque, como item de menu: ícone em quadrado + nome em negrito.
  const title = (
    <>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          hasActive
            ? "bg-[#4b1768] text-white dark:bg-primary dark:text-primary-foreground"
            : "bg-[#f1e8f6] text-[#4b1768] dark:bg-primary/15 dark:text-primary",
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="truncate text-[15px] font-bold leading-tight">{label}</span>
    </>
  );
  const titleClassName =
    "flex min-h-9 w-full items-center gap-2.5 rounded-md px-1.5 text-left text-[#4b1768] dark:text-primary";

  return (
    <UISidebarGroup className="border-t border-slate-200 py-2.5 first:border-t-0 dark:border-sidebar-border">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            titleClassName,
            "transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4b1768] dark:hover:bg-sidebar-accent dark:focus-visible:ring-primary",
          )}
        >
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
          className={cn(
            "ml-[19px] mt-1 border-l-2 pl-2",
            hasActive ? "border-[#4b1768] dark:border-primary" : "border-slate-200 dark:border-sidebar-border",
          )}
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
