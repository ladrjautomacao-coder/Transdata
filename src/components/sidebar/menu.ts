import {
  FolderKanban, LayoutDashboard, HardHat, BookOpenCheck, Users, ShieldCheck, Settings, KeyRound, LifeBuoy, Wallet,
  Eye, FileUp, Tag, CalendarPlus, CalendarRange, BookOpen, ClipboardCheck, LayoutGrid, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { URL_GESTAO_OPERACIONAL } from "@/lib/gestaoOperacional";
import type { NavItem } from "./SidebarNav";

export interface NavGroupDef {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Título recolhível; os demais grupos ficam sempre abertos. */
  collapsible?: boolean;
}

/** Badges are driven by state so they can be wired to live counters later. */
export interface SidebarBadges {
  financeiro?: number;
  suporte?: number;
  projects?: number;
}

/**
 * O menu do portal (sem filtro de permissão): a lateral filtra pelo que cada um pode ver e o
 * caminho de navegação do topo usa os mesmos nomes.
 */
export function gruposDoMenu(badges: SidebarBadges = {}): NavGroupDef[] {
  return [
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
        { title: "Agenda técnica", url: "/implantacao/calendario", icon: CalendarRange, module: "agenda_calendario" },
        { title: "Área do Implantador", url: "/implantacao/implantador", icon: HardHat, module: "area_implantador" },
      ],
    },
    {
      // em desenvolvimento: só o Super Admin vê; as áreas abrem pelos quadrantes da página, como em Projetos
      label: "Gestão Operacional",
      icon: Workflow,
      items: [
        { title: "Visão geral", url: URL_GESTAO_OPERACIONAL, icon: LayoutGrid, superAdminOnly: true },
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
      collapsible: true,
      items: [
        { title: "Equipe", url: "/admin/equipe", icon: Users, module: "admin_team" },
        { title: "Usuários", url: "/admin/usuarios", icon: ShieldCheck, module: "admin_users" },
        { title: "Permissões", url: "/admin/permissoes", icon: KeyRound, module: "admin_users" },
        { title: "Configurações", url: "/admin/configuracoes", icon: Settings, module: "admin_settings" },
        { title: "Personalização", url: "/admin/tipos-projeto", icon: Tag, module: "admin_settings" },
        { title: "Manual do Sistema", url: "/manual", icon: BookOpenCheck, module: "admin_manual" },
      ],
    },
  ];
}

/** O item do menu da tela atual (o de caminho mais longo que combina) e o grupo dele. */
export function itemDoMenu(pathname: string): { grupo: NavGroupDef; item: NavItem } | null {
  let melhor: { grupo: NavGroupDef; item: NavItem } | null = null;
  for (const grupo of gruposDoMenu()) {
    for (const item of grupo.items) {
      const combina = item.url === "/" ? pathname === "/" : pathname === item.url || pathname.startsWith(`${item.url}/`);
      if (combina && (!melhor || item.url.length > melhor.item.url.length)) melhor = { grupo, item };
    }
  }
  return melhor;
}
