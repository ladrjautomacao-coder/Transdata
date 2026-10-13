import { formatLocation } from "@/lib/location";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, FolderKanban, List, BookOpen, Plus, Building2, Users, ShieldCheck, Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

interface ProjectItem {
  id: string;
  company_name: string;
  city: string;
  state: string | null;
  country_code: string | null;
  status: string;
  sub_phase: string | null;
  manager: { full_name: string } | null;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { can } = usePermissions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || projects.length > 0) return;
    supabase
      .from("projects")
      .select("id, company_name, city, state, country_code, status, sub_phase, manager:team_members!projects_manager_id_fkey(full_name)")
      .order("company_name")
      .then(({ data }) => setProjects((data as unknown as ProjectItem[]) || []));
  }, [open, projects.length]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar projeto, cidade, gestor ou ação… (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/projetos/gestao")}>
            <FolderKanban className="mr-2 h-4 w-4" /> Kanban de Projetos
          </CommandItem>
          <CommandItem onSelect={() => go("/projetos/lista")}>
            <List className="mr-2 h-4 w-4" /> Lista de Projetos
          </CommandItem>
          {can("acervo", "view") && (
            <CommandItem onSelect={() => go("/acervo")}>
              <BookOpen className="mr-2 h-4 w-4" /> Acervo Técnico
            </CommandItem>
          )}
          <CommandItem onSelect={() => go("/manual")}>
            <BookOpen className="mr-2 h-4 w-4" /> Manual do Sistema
          </CommandItem>
          {isAdmin && (
            <>
              <CommandItem onSelect={() => go("/projetos/novo")}>
                <Plus className="mr-2 h-4 w-4" /> Cadastrar Novo Projeto
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/equipe")}>
                <Users className="mr-2 h-4 w-4" /> Equipe
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/produtos")}>
                <Package className="mr-2 h-4 w-4" /> Produtos
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/usuarios")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Usuários
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Projetos (${projects.length})`}>
              {projects.map(p => (
                <CommandItem
                  key={p.id}
                  value={`${p.company_name} ${p.city} ${p.state || ""} ${p.country_code || ""} ${p.manager?.full_name || ""}`}
                  onSelect={() => go(`/projetos/${p.id}`)}
                >
                  <Building2 className="mr-2 h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-sm">{p.company_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatLocation(p.city, p.state, p.country_code)}
                      {p.manager?.full_name ? ` · ${p.manager.full_name}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
