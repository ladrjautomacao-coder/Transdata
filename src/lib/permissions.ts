export const MODULE_GROUPS = [
  { key: "projetos", label: "Módulo Projetos" },
  { key: "operacao", label: "Outros Módulos" },
  { key: "admin", label: "Administração" },
] as const;

export const MODULES = [
  { key: "dashboard", label: "Dashboard", group: "projetos", actions: ["view"] as const },
  { key: "projects", label: "Gestão de Projetos", group: "projetos", actions: ["view", "create", "edit", "delete", "move_card"] as const },
  { key: "visao_comercial", label: "Visão Comercial (leitura)", group: "projetos", actions: ["view"] as const },
  { key: "implantacao", label: "Implantação", group: "operacao", actions: ["view"] as const },
  { key: "report_imp", label: "Report IMP", group: "operacao", actions: ["view", "create", "delete"] as const },
  { key: "agenda_solicitacao", label: "Solicitação de agenda (Criar = solicitar visita)", group: "operacao", actions: ["view", "create", "approve"] as const },
  { key: "agenda_tecnicos", label: "Agenda — Técnicos (cadastro)", group: "operacao", actions: ["edit"] as const },
  { key: "agenda_calendario", label: "Calendário de implantação", group: "operacao", actions: ["view"] as const },
  { key: "acervo", label: "Acervo Técnico", group: "operacao", actions: ["view"] as const },
  { key: "suporte", label: "Suporte Técnico", group: "operacao", actions: ["view"] as const },
  { key: "financeiro", label: "Gestão de Contratos", group: "operacao", actions: ["view"] as const },
  { key: "admin_team", label: "Admin — Equipe", group: "admin", actions: ["view", "edit"] as const },
  { key: "admin_users", label: "Admin — Usuários / Permissões", group: "admin", actions: ["view", "edit"] as const },
  { key: "admin_settings", label: "Admin — Configurações", group: "admin", actions: ["view", "edit"] as const },
  { key: "admin_manual", label: "Manual do Sistema", group: "admin", actions: ["view"] as const },
] as const;

export const ALL_ACTIONS = ["view", "create", "edit", "delete", "move_card", "approve"] as const;


export const SECTIONS = [
  { key: "identificacao", label: "Identificação" },
  { key: "datas", label: "Datas" },
  { key: "frota", label: "Frota" },
  { key: "solucoes", label: "Soluções / Escopo" },
  { key: "equipamentos", label: "Equipamentos" },
  { key: "integracoes", label: "Integrações" },
  { key: "acompanhamento", label: "Acompanhamento" },
  { key: "anexos", label: "Anexos" },
  { key: "status_kanban", label: "Status / Kanban" },
] as const;

export const ACTION_LABELS: Record<string, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  move_card: "Mover Card",
  approve: "Aprovar",
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  diretoria: "Diretoria",
  comercial: "Comercial",
  projetos: "Projetos",
  suporte_tecnico: "Suporte Técnico",
  relacionamento: "Relacionamento",
  implantacao: "Implantação",
  produtos: "Produtos",
  desenvolvimento: "Desenvolvimento",
  user: "Usuário",
  integration: "Integração (API)",
};

/** Áreas selecionáveis no cadastro e na matriz de permissões. */
export const USER_AREAS = [
  "diretoria", "comercial", "projetos", "suporte_tecnico",
  "relacionamento", "implantacao", "produtos", "desenvolvimento",
] as const;

export const AVAILABLE_ROLES = [
  "super_admin", "admin", ...USER_AREAS, "integration",
] as const;


export type PermModule = typeof MODULES[number]["key"];
export type PermAction = "view" | "create" | "edit" | "delete" | "move_card" | "approve";
export type PermSection = typeof SECTIONS[number]["key"];

export interface PermissionsShape {
  scope?: "all" | "own";
  modules?: Partial<Record<PermModule, Partial<Record<PermAction, boolean>>>>;
  sections?: Partial<Record<PermSection, boolean>>;
}

export function checkPerm(
  perms: PermissionsShape | null | undefined,
  module: PermModule,
  action: PermAction,
  section?: PermSection,
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  if (!perms?.modules) return false;
  const mod = perms.modules[module];
  if (!mod) return false;
  const val = mod[action];
  if (!val) return false;
  if (section && action === "edit" && module === "projects") {
    const s = perms.sections?.[section];
    return s !== false;
  }
  return true;
}
