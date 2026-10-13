import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
  module: PermModule;
  /** Ação exigida para o item aparecer (padrão: "view"). */
  action?: PermAction;
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
          className="group/nav flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 border-l-[3px] border-transparent transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950 dark:text-sidebar-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
          activeClassName="!bg-[#f1e8f6] !text-[#4b1768] font-semibold !border-[#4b1768] dark:!bg-primary/15 dark:!text-primary dark:!border-primary"
        >
          <item.icon className="h-4 w-4 shrink-0 transition-colors group-hover/nav:text-[#4b1768] group-[.font-semibold]/nav:text-[#4b1768] dark:group-hover/nav:text-primary dark:group-[.font-semibold]/nav:text-primary" />
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
  forceExpanded = false,
}: {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { state, isMobile } = useSidebar();
  if (items.length === 0) return null;
  const isExpanded = expanded || forceExpanded;

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
              className="flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-[#f8f4fb] text-[#4b1768] shadow-sm transition-colors hover:bg-[#f1e8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b1768] data-[state=open]:bg-[#f1e8f6] dark:border-sidebar-border dark:bg-sidebar-accent dark:text-primary dark:hover:bg-primary/15 dark:focus-visible:ring-primary dark:data-[state=open]:bg-primary/15"
            >
              <Icon className="h-5 w-5 shrink-0" />
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
                  <item.icon className="h-4 w-4 shrink-0" />
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

  return (
    <UISidebarGroup className="py-[3px]">
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setExpanded((value) => !value)}
          className={`group/folder flex min-h-11 w-full items-center px-3 text-left text-[#4b1768] ${isExpanded ? "border-b" : ""} border-[#4b1768]/15 bg-[#f8f4fb] transition-colors hover:bg-[#f1e8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4b1768] dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-accent-foreground dark:hover:bg-primary/15 dark:focus-visible:ring-primary group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:px-0`}
        >
          <span className="flex w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[15px] font-semibold leading-tight group-data-[collapsible=icon]:hidden">{label}</span>
            <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-data-[collapsible=icon]:hidden ${isExpanded ? "rotate-180" : ""}`} />
          </span>
        </button>
        {isExpanded && (
          <SidebarGroupContent className="p-2 group-data-[collapsible=icon]:p-1">
            <SidebarMenu>
              {items.map((item) => (
                <SidebarItem key={item.url} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        )}
      </div>
    </UISidebarGroup>
  );
}
