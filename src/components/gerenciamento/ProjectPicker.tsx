import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, FolderSearch, RefreshCw, Search, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabels } from "@/lib/statusLabels";
import { formatLocation } from "@/lib/location";
import { fetchGerProjects, type GerProject } from "@/lib/gerenciamento";
import { errorMessage } from "@/lib/implantationScheduling";
import { EmptyBlock } from "@/components/agendamento/AgendaShared";

const PHASE_PILL: Record<string, string> = {
  comercial: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  planejamento: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  implantacao: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
  encerrado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  suspenso: "bg-muted text-muted-foreground",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Primeiro passo do Gerenciamento: escolher o projeto. */
export function ProjectPicker({ onPick }: { onPick: (id: string) => void }) {
  const [list, setList] = useState<GerProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(true);
  const [managerId, setManagerId] = useState<string | null>(null);

  const load = () => {
    setList(null); setError(null);
    fetchGerProjects().then(setList).catch(err => { setError(errorMessage(err)); setList([]); });
  };
  useEffect(() => {
    load();
    supabase.rpc("get_my_manager_id").then(({ data }) => setManagerId((data as string | null) ?? null));
  }, []);

  // quem não é GP de nenhum projeto vê todos
  const onlyMine = mine && !!managerId;
  const shown = useMemo(() => {
    const q = norm(query.trim());
    return (list ?? [])
      .filter(p => !onlyMine || p.manager_id === managerId)
      .filter(p => !q || norm(`${p.company_name} ${p.project_code ?? ""} ${p.city}`).includes(q));
  }, [list, query, onlyMine, managerId]);

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <FolderSearch className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Escolha o projeto</h2>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {managerId && (
            <div className="flex rounded-lg border p-0.5" role="group" aria-label="Quais projetos">
              {[{ v: true, l: "Meus projetos" }, { v: false, l: "Todos" }].map(o => (
                <button key={o.l} type="button" onClick={() => setMine(o.v)} aria-pressed={mine === o.v}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${mine === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o.l}</button>
              ))}
            </div>
          )}
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por cliente, código ou cidade" className="h-9 pl-9" aria-label="Buscar projeto" />
          </div>
        </div>
      </div>

      {list === null ? (
        <div className="space-y-2 p-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : error ? (
        <div className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          <span className="flex-1">Não foi possível carregar os projetos. {error}</span>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
        </div>
      ) : shown.length === 0 ? (
        <EmptyBlock icon={FolderSearch} title={list.length ? "Nenhum projeto com essa busca" : "Nenhum projeto cadastrado"}
          text={list.length ? "Confira o nome do cliente ou o código, ou veja todos os projetos." : "Cadastre o projeto em Gestão de Projetos para começar o gerenciamento."}
          action={list.length ? <Button variant="outline" size="sm" onClick={() => { setQuery(""); setMine(false); }}>Limpar busca</Button> : undefined} />
      ) : (
        <ul className="divide-y">
          {shown.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.company_name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {p.project_code && <span className="truncate font-mono">{p.project_code}</span>}
                    <span>{formatLocation(p.city, p.state, p.country_code)}</span>
                    <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{p.manager?.full_name ?? "Sem GP"}</span>
                  </span>
                </span>
                <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline ${PHASE_PILL[p.status] ?? PHASE_PILL.suspenso}`}>{statusLabels[p.status as keyof typeof statusLabels] ?? p.status}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && list.length > 0 && (
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">{shown.length} de {list.length} projetos{onlyMine ? " · só os seus" : ""}</p>
      )}
    </section>
  );
}
