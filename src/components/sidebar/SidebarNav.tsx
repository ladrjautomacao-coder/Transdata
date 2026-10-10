import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  SidebarGroup as UISidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { PermModule } from "@/lib/permissions";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  module: PermModule;
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
          className="group/nav flex items-center gap-2 rounded-md px-2.5 py-2 text-slate-700 border-l-[3px] border-transparent transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950"
          activeClassName="!bg-[#f1e8f6] !text-[#4b1768] font-semibold !border-[#4b1768]"
        >
          <item.icon className="h-4 w-4 shrink-0 transition-colors group-hover/nav:text-[#4b1768] group-[.font-semibold]/nav:text-[#4b1768]" />
          <span className="truncate">{item.title}</span>
          {typeof item.badge === "number" && item.badge > 0 && (
            <span
              className={cn(
                "ml-auto min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none",
                "bg-slate-200 text-slate-700",
                "group-[.font-semibold]/nav:bg-[#4b1768] group-[.font-semibold]/nav:text-white",
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
  if (items.length === 0) return null;
  const isExpanded = expanded || forceExpanded;

  return (
    <UISidebarGroup className="py-1.5">
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setExpanded((value) => !value)}
          className="group/folder flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1 border-b border-[#4b1768]/15 bg-[#f8f4fb] px-2 py-2 text-center text-[#4b1768] transition-colors hover:bg-[#f1e8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4b1768] group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:border-b-0"
        >
          <span className="flex w-full items-center justify-center gap-1.5">
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-base font-semibold leading-tight group-data-[collapsible=icon]:hidden">{label}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform group-data-[collapsible=icon]:hidden ${isExpanded ? "rotate-180" : ""}`} />
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
