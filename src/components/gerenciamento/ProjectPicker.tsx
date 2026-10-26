import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, Briefcase, Building2, ChevronRight, ClipboardList, CornerDownRight, FolderSearch, Info, LayoutGrid, MousePointerClick,
  PauseCircle, RefreshCw, Search, UserRound, Wrench, X, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabels } from "@/lib/statusLabels";
import { formatLocation } from "@/lib/location";
import { fetchGerProjects, type GerProject } from "@/lib/gerenciamento";
import { fetchOpenPendencies, type ProjectPendency } from "@/lib/projectPendencies";
import { errorMessage } from "@/lib/implantationScheduling";
import { subPhasesByStatus } from "@/pages/ProjectManagement";
import { EmptyBlock } from "@/components/agendamento/AgendaShared";

/** As colunas do Kanban, na mesma ordem e cor; "pendente" são os cards filhos em aberto. */
type Fase = "comercial" | "planejamento" | "implantacao" | "encerrado" | "pendente" | "suspenso";
type Status = Exclude<Fase, "pendente">;

const FASES: { id: Fase; icon: LucideIcon; tone: string; faixa: string; borda: string; pill: string }[] = [
  { id: "comercial", icon: Briefcase, tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300", faixa: "bg-blue-500", borda: "border-l-blue-500", pill: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { id: "planejamento", icon: ClipboardList, tone: "bg-primary/10 text-primary", faixa: "bg-primary", borda: "border-l-primary", pill: "bg-primary/10 text-primary" },
  { id: "implantacao", icon: Wrench, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", faixa: "bg-amber-500", borda: "border-l-amber-500", pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  { id: "encerrado", icon: BadgeCheck, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", faixa: "bg-emerald-500", borda: "border-l-emerald-500", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "pendente", icon: CornerDownRight, tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300", faixa: "bg-orange-500", borda: "border-l-orange-500", pill: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { id: "suspenso", icon: PauseCircle, tone: "bg-red-500/15 text-red-700 dark:text-red-300", faixa: "bg-red-500", borda: "border-l-red-500", pill: "bg-red-500/15 text-red-700 dark:text-red-300" },
];
const FASE = Object.fromEntries(FASES.map(f => [f.id, f])) as Record<Fase, (typeof FASES)[number]>;
const nomeFase = (f: Fase) => (f === "pendente" ? "Implantação pendente" : statusLabels[f] ?? f);
const etapaDe = (p: GerProject) => subPhasesByStatus[p.status as Status]?.find(s => s.id === p.sub_phase)?.label ?? null;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FASE_KEY = "gerenciamento:fase";
const lerFase = (): Fase | null => { try { return (sessionStorage.getItem(FASE_KEY) as Fase | null) || null; } catch { return null; } };
const guardarFase = (f: Fase | null) => { try { if (f) sessionStorage.setItem(FASE_KEY, f); else sessionStorage.removeItem(FASE_KEY); } catch { /* ignore */ } };

/** Uma coluna do Kanban: quantos projetos (ou itens pendentes) e em que etapas estão. */
function FaseCard({ fase, total, unidade, etapas, ativo, onClick }: {
  fase: Fase; total: number; unidade: string; etapas: [string, number][]; ativo: boolean; onClick: () => void;
}) {
  const f = FASE[fase];
  const nome = nomeFase(fase);
  const info = fase === "pendente"
    ? "Soluções que ficaram para depois nos projetos (os cards filhos em aberto na coluna Implantação pendente do Kanban). O número conta os itens; ao clicar, aparecem os projetos."
    : `Projetos que estão na coluna "${nome}" do Kanban. Quando o projeto muda de coluna lá, muda aqui na hora.`;
  return (
    <div className="relative">
      <button type="button" onClick={onClick} aria-pressed={ativo}
        className={`group relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pt-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo ? "border-transparent ring-2 ring-primary" : "border-border/60"}`}>
        <span className={`absolute inset-x-0 top-0 h-1 ${f.faixa} ${total ? "" : "opacity-40"}`} aria-hidden />
        <span className="flex items-center gap-2.5 pr-5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${f.tone}`}><f.icon className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{nome}</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-bold leading-none tabular-nums ${total ? "" : "text-muted-foreground/60"}`}>{total}</span>
          <span className="text-xs text-muted-foreground">{total ? unidade : "nenhum"}</span>
        </span>
        {etapas.length > 0 && (
          <span className="flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">
            {etapas.slice(0, 3).map(([nomeEtapa, n]) => (
              <span key={nomeEtapa} title={`${nomeEtapa}: ${n}`} className="flex min-w-0 items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${f.faixa}`} aria-hidden />
                <span className="min-w-0 truncate">{nomeEtapa}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground/80">{n}</span>
              </span>
            ))}
            {etapas.length > 3 && <span className="pl-3">+{etapas.length - 3} etapa{etapas.length - 3 > 1 ? "s" : ""}</span>}
          </span>
        )}
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`O que conta em ${nome}`} className="absolute right-2 top-3 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-64 text-sm">
          <p className="mb-1 font-semibold">{nome}</p>
          <p className="text-muted-foreground">{info}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Primeiro passo do Gerenciamento: os projetos do GP por coluna do Kanban (mesmos nomes, ordem
 * e cores) e, ao clicar numa coluna, a lista para escolher o projeto. Acompanha o Kanban ao vivo.
 */
export function ProjectPicker({ onPick }: { onPick: (id: string) => void }) {
  const [list, setList] = useState<GerProject[] | null>(null);
  const [pendencias, setPendencias] = useState<ProjectPendency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(true);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [fase, setFaseState] = useState<Fase | null>(lerFase);
  const setFase = (f: Fase | null) => { setFaseState(f); guardarFase(f); };

  const buscar = useCallback(() => Promise.all([fetchGerProjects(), fetchOpenPendencies().catch(() => [] as ProjectPendency[])]), []);
  const load = useCallback(() => {
    setList(null); setError(null);
    buscar().then(([ps, pend]) => { setList(ps); setPendencias(pend); }).catch(err => { setError(errorMessage(err)); setList([]); });
  }, [buscar]);
  useEffect(() => {
    load();
    supabase.rpc("get_my_manager_id").then(({ data }) => setManagerId((data as string | null) ?? null));
  }, [load]);

  // ao vivo: projeto que muda de coluna no Kanban (ou volta para esta aba) atualiza as caixas sem piscar a tela
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { buscar().then(([ps, pend]) => { setList(ps); setPendencias(pend); }).catch(() => { /* mantém o que já está na tela */ }); }, 500);
    };
    const canal = supabase.channel("gerenciamento-fases")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, atualizar)
      .subscribe();
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { clearTimeout(timer); supabase.removeChannel(canal); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [buscar]);

  // quem não é GP de nenhum projeto vê todos
  const onlyMine = mine && !!managerId;
  const base = useMemo(() => (list ?? []).filter(p => !onlyMine || p.manager_id === managerId), [list, onlyMine, managerId]);
  const abertasPorProjeto = useMemo(() => {
    const ids = new Set(base.map(p => p.id));
    const m = new Map<string, ProjectPendency[]>();
    for (const x of pendencias) if (ids.has(x.project_id)) m.set(x.project_id, [...(m.get(x.project_id) ?? []), x]);
    return m;
  }, [base, pendencias]);

  const resumo = useMemo(() => {
    const out = {} as Record<Fase, { total: number; etapas: [string, number][] }>;
    for (const { id } of FASES) {
      const contar = new Map<string, number>();
      let total = 0;
      if (id === "pendente") {
        for (const xs of abertasPorProjeto.values()) for (const x of xs) { total++; contar.set(x.title, (contar.get(x.title) ?? 0) + 1); }
      } else {
        const ordem = (subPhasesByStatus[id] ?? []).map(s => s.label);
        for (const p of base) if (p.status === id) { total++; const e = etapaDe(p); if (e) contar.set(e, (contar.get(e) ?? 0) + 1); }
        out[id] = { total, etapas: [...contar].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0])) };
        continue;
      }
      out[id] = { total, etapas: [...contar].sort((a, b) => b[1] - a[1]) };
    }
    return out;
  }, [base, abertasPorProjeto]);

  const q = norm(query.trim());
  const linhas = useMemo(() => {
    if (!fase && !q) return [];
    const daFase = !fase ? base : fase === "pendente" ? base.filter(p => abertasPorProjeto.has(p.id)) : base.filter(p => p.status === fase);
    return daFase.filter(p => !q || norm(`${p.company_name} ${p.project_code ?? ""} ${p.city}`).includes(q));
  }, [base, fase, q, abertasPorProjeto]);

  const ferramentas = (
    <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {managerId && (
        <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Quais projetos">
          {[{ v: true, l: "Meus projetos" }, { v: false, l: "Todos" }].map(o => (
            <button key={o.l} type="button" onClick={() => setMine(o.v)} aria-pressed={mine === o.v}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${mine === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o.l}</button>
          ))}
        </div>
      )}
      <div className="relative min-w-0 flex-1 basis-56 sm:w-72 sm:flex-none sm:basis-auto">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por cliente, código ou cidade" className="h-9 bg-card pl-9" aria-label="Buscar projeto" />
      </div>
    </div>
  );

  const tituloLista = fase
    ? `${nomeFase(fase)} · ${linhas.length} projeto${linhas.length === 1 ? "" : "s"}${q ? " com essa busca" : ""}`
    : `Busca em todas as fases · ${linhas.length} projeto${linhas.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><LayoutGrid className="h-4 w-4 text-primary" />{onlyMine ? "Seus projetos por fase" : "Todos os projetos por fase"}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
            <span>As fases são as colunas do Kanban. Clique numa fase para ver os projetos.</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Ao vivo com o Kanban
            </span>
          </p>
        </div>
        {ferramentas}
      </div>

      {list === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{FASES.map(f => <Skeleton key={f.id} className="h-[148px] rounded-xl" />)}</div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          <span className="flex-1">Não foi possível carregar os projetos. {error}</span>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <EmptyBlock icon={FolderSearch} title="Nenhum projeto cadastrado" text="Cadastre o projeto em Gestão de Projetos para começar o gerenciamento." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {FASES.map(f => (
              <FaseCard key={f.id} fase={f.id} total={resumo[f.id].total} etapas={resumo[f.id].etapas}
                unidade={f.id === "pendente" ? (resumo[f.id].total === 1 ? "item pendente" : "itens pendentes") : resumo[f.id].total === 1 ? "projeto" : "projetos"}
                ativo={fase === f.id} onClick={() => setFase(fase === f.id ? null : f.id)} />
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            {!fase && !q ? (
              <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MousePointerClick className="h-5 w-5" /></span>
                <span>Clique numa fase acima para listar os projetos dela, ou busque pelo nome do cliente.</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                  {fase ? (() => { const F = FASE[fase]; return <span className={`flex h-7 w-7 items-center justify-center rounded-md ${F.tone}`}><F.icon className="h-4 w-4" /></span>; })()
                    : <Search className="h-4 w-4 text-primary" />}
                  <h3 className="text-sm font-semibold">{tituloLista}</h3>
                  {fase && (
                    <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs text-muted-foreground" onClick={() => setFase(null)}>
                      <X className="mr-1 h-3.5 w-3.5" />Fechar lista
                    </Button>
                  )}
                </div>
                {linhas.length === 0 ? (
                  <EmptyBlock icon={FolderSearch}
                    title={q ? "Nenhum projeto com essa busca" : `Nenhum projeto em ${nomeFase(fase!)}`}
                    text={q ? "Confira o nome do cliente ou o código, ou procure em todos os projetos." : onlyMine ? "Você não tem projetos nesta fase do Kanban agora." : "Nenhum projeto está nesta fase do Kanban agora."}
                    action={q ? <Button variant="outline" size="sm" onClick={() => { setQuery(""); setMine(false); }}>Limpar busca</Button> : undefined} />
                ) : (
                  <ul className="divide-y">
                    {linhas.map(p => {
                      const status = (p.status in FASE ? p.status : "suspenso") as Status;
                      const pend = abertasPorProjeto.get(p.id) ?? [];
                      // na lista de uma fase, a pílula mostra a etapa do Kanban; na busca, a fase
                      const etiqueta = fase && fase !== "pendente" ? etapaDe(p) : nomeFase(status);
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => onPick(p.id)}
                            className={`flex w-full items-center gap-3 border-l-[3px] px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none ${FASE[fase === "pendente" ? "pendente" : status].borda}`}>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">{p.company_name}</span>
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {p.project_code && <span className="truncate font-mono">{p.project_code}</span>}
                                <span>{formatLocation(p.city, p.state, p.country_code)}</span>
                                <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{p.manager?.full_name ?? "Sem GP"}</span>
                              </span>
                              {fase === "pendente" && pend.length > 0 && (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {pend.map(x => <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300"><CornerDownRight className="h-3 w-3" />{x.title}</span>)}
                                </span>
                              )}
                            </span>
                            {etiqueta && <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline ${FASE[status].pill}`}>{etiqueta}</span>}
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
