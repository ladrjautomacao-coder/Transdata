import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Download, Gauge, Layers, MapPin, RefreshCw, SearchX, Truck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Kpi } from "@/components/agendamento/AgendaShared";
import { CargaGerentes } from "@/components/dashboard/CargaGerentes";
import { EvolucaoFrota } from "@/components/dashboard/EvolucaoFrota";
import { EvolucaoSolucoes } from "@/components/dashboard/EvolucaoSolucoes";
import { FiltrosDashboard } from "@/components/dashboard/FiltrosDashboard";
import { ListaProjetos } from "@/components/dashboard/ListaProjetos";
import { MapaEstados } from "@/components/dashboard/MapaEstados";
import { SolucoesLista } from "@/components/dashboard/SolucoesLista";
import { StatusProjetos } from "@/components/dashboard/StatusProjetos";
import { numero } from "@/components/dashboard/cores";
import { useAuth } from "@/contexts/AuthContext";
import {
  FILTROS_PADRAO, SEM_GERENTE, cargaPorGerente, contarStatus, csvProjetos, descartado, evolucaoFrota, evolucaoSolucoes, filtrar, frotaDe, porEstado,
  porSolucao, solucoesDe, temFiltro, type ChaveFiltro, type DashProject, type FiltrosDash,
} from "@/lib/dashboard";
import { errorMessage } from "@/lib/implantationScheduling";
import { statusLabels } from "@/lib/statusLabels";

const SELECT = `id, company_name, project_code, city, state, contract_date, d_zero_date, status, sub_phase, fleet_size, is_pilot,
  complementary_sale, complementary_fleet, implemented_fleet, reached_implemented, manager_id,
  manager:team_members!projects_manager_id_fkey(full_name), project_solutions(solution:solutions(name))`;

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ordenar = (xs: Iterable<string>) => Array.from(new Set(xs)).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));

/**
 * Dashboard dos projetos: filtros, os números principais, status, carga dos gerentes, frota,
 * soluções, estados e a lista dos projetos. Ao vivo: muda quando um projeto muda no portal.
 * Cada bloco ignora o próprio filtro (mostra tudo e destaca o escolhido) e clicar nele filtra o painel.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [projetos, setProjetos] = useState<DashProject[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [f, setF] = useState<FiltrosDash>(FILTROS_PADRAO);
  const [visao, setVisao] = useState<FiltrosDash | null>(null);
  const chaveVisao = user ? `dashboard:visao:${user.id}` : null;

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("projects").select(SELECT).order("company_name");
    if (error) throw error;
    setProjetos(((data ?? []) as unknown as DashProject[]).filter(p => !descartado(p)));
    setAtualizadoEm(new Date());
    setErro(null);
  }, []);
  const recarregar = useCallback(() => { carregar().catch(e => setErro(errorMessage(e))); }, [carregar]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setProjetos([]); return; }
    recarregar();
  }, [authLoading, user, recarregar]);

  // ao vivo: um projeto que muda no portal atualiza o painel sem piscar a tela
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => { clearTimeout(timer); timer = setTimeout(() => { carregar().catch(() => { /* mantém o que já está na tela */ }); }, 600); };
    const canal = supabase.channel("dashboard-projetos").on("postgres_changes", { event: "*", schema: "public", table: "projects" }, atualizar).subscribe();
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { clearTimeout(timer); supabase.removeChannel(canal); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [user, carregar]);

  // visão salva: os filtros com que o Dashboard abre para esta pessoa (neste navegador)
  useEffect(() => {
    if (!chaveVisao) return;
    try {
      const v = JSON.parse(localStorage.getItem(chaveVisao) ?? "null") as Partial<FiltrosDash> | null;
      if (v) { const n = { ...FILTROS_PADRAO, ...v }; setVisao(n); setF(n); }
    } catch { /* ignore */ }
  }, [chaveVisao]);

  const mudar = useCallback((k: ChaveFiltro, v: string | null) => setF(atual => ({ ...atual, [k]: v ?? (k === "de" || k === "ate" ? null : k === "busca" ? "" : "all") })), []);
  const limpar = () => setF(FILTROS_PADRAO);

  const todos = useMemo(() => projetos ?? [], [projetos]);
  const base = useMemo(() => filtrar(todos, f), [todos, f]);
  const ate = (f.ate ?? hojeIso()).slice(0, 7);
  const opcoes = useMemo(() => ({
    solucoes: ordenar(todos.flatMap(solucoesDe)),
    estados: ordenar(todos.map(p => p.state)),
    cidades: ordenar(todos.filter(p => f.estado === "all" || p.state === f.estado).map(p => p.city)),
    gerentes: [...ordenar(todos.map(p => p.manager?.full_name ?? "")), ...(todos.some(p => !p.manager?.full_name) ? [SEM_GERENTE] : [])],
  }), [todos, f.estado]);
  const periodoTotal = useMemo(() => {
    if (!todos.length) return null;
    const ds = todos.map(p => p.contract_date.slice(0, 10)).sort();
    return { de: ds[0], ate: ds[ds.length - 1] };
  }, [todos]);

  const salvarVisao = () => {
    if (!chaveVisao) return;
    try { localStorage.setItem(chaveVisao, JSON.stringify(f)); } catch { /* ignore */ }
    setVisao(f);
    toast.success("Visão salva", { description: temFiltro(f) ? "O Dashboard vai abrir com estes filtros." : "O Dashboard vai abrir sem filtros." });
  };
  const esquecerVisao = () => {
    if (!chaveVisao) return;
    try { localStorage.removeItem(chaveVisao); } catch { /* ignore */ }
    setVisao(null);
    toast("Visão apagada", { description: "O Dashboard volta a abrir sem filtros." });
  };
  const visaoAtual = !!visao && JSON.stringify(visao) === JSON.stringify(f);

  const exportar = () => {
    const url = URL.createObjectURL(new Blob([csvProjetos(base, statusLabels)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `dashboard-projetos-${hojeIso()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Planilha com ${base.length} ${base.length === 1 ? "projeto" : "projetos"} baixada`, { description: temFiltro(f) ? "Só os projetos que passam nos filtros. Abre no Excel." : "Abre no Excel." });
  };

  const cabecalho = (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          Dados ao vivo{atualizadoEm ? ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Painel de inteligência dos projetos: status, carga dos gerentes, frota e soluções implantadas.</p>
      </div>
      {projetos && projetos.length > 0 && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {visaoAtual
            ? <Button variant="outline" onClick={esquecerVisao} title="O Dashboard abre com estes filtros. Clique para deixar de abrir assim."><BookmarkCheck className="mr-1.5 h-4 w-4 text-primary" />Visão salva</Button>
            : <Button variant="outline" onClick={salvarVisao} title="O Dashboard passa a abrir com estes filtros"><Bookmark className="mr-1.5 h-4 w-4" />Salvar visão</Button>}
          <Button onClick={exportar} disabled={!base.length}><Download className="mr-1.5 h-4 w-4" />Exportar planilha</Button>
        </div>
      )}
    </div>
  );

  if (erro && !projetos) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        {cabecalho}
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          <span className="min-w-0 flex-1">Não foi possível carregar os projetos. {erro}</span>
          <Button size="sm" variant="outline" onClick={recarregar}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
        </div>
      </div>
    );
  }
  if (!projetos) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        {cabecalho}
        <Skeleton className="h-[148px] rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const st = contarStatus(base);
  const frota = base.reduce((a, p) => a + frotaDe(p), 0);
  const comFrota = base.filter(p => frotaDe(p) > 0).length;
  const estados = new Set(base.map(p => p.state).filter(Boolean)).size;
  const plural = (n: number, s: string) => `${n} ${s.toLowerCase()}${n === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-5 pb-8">
      {cabecalho}

      {/* primeiros passos: só para quem ainda não tem nenhum projeto */}
      {projetos.length === 0 && (
        <div className="rounded-xl border border-l-4 border-l-primary bg-card p-5 shadow-sm">
          <h2 className="mb-1 font-semibold">Bem-vindo! Vamos configurar seu primeiro projeto</h2>
          <p className="mb-4 text-sm text-muted-foreground">Dois passos rápidos para começar a usar o sistema de verdade.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">1. Cadastre seu primeiro projeto</p>
                <p className="mb-2 text-xs text-muted-foreground">Nome da empresa cliente, cidade, datas e equipe.</p>
                <Button size="sm" onClick={() => navigate("/projetos/novo")}>Cadastrar projeto</Button>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">2. Adicione sua equipe</p>
                <p className="mb-2 text-xs text-muted-foreground">Gerentes e executivos que vão trabalhar nos projetos.</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/admin/equipe")}>Ver equipe</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {projetos.length > 0 && (
        <>
          <FiltrosDashboard f={f} mudar={mudar} limpar={limpar} opcoes={opcoes} periodoTotal={periodoTotal} />

          {!base.length ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card px-6 py-12 text-center shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><SearchX className="h-6 w-6" /></span>
              <div>
                <p className="font-semibold">Nenhum projeto com estes filtros</p>
                <p className="text-sm text-muted-foreground">Tire algum filtro para ver os números do painel.</p>
              </div>
              <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi stacked icon={Layers} label="Total de projetos" value={numero(base.length)} tone="bg-primary/10 text-primary"
                  caption={`${st.implantacao} em ${statusLabels.implantacao.toLowerCase()} · ${plural(st.encerrado, statusLabels.encerrado)}`}
                  info="Projetos que passam nos filtros. Cancelado e Piloto reprovado não entram em nenhum número do Dashboard. Quem já chegou a Implementado conta como Implementado." />
                <Kpi stacked icon={MapPin} label="Estados atendidos" value={estados} tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  caption="com ao menos um projeto" info="Estados com pelo menos um projeto entre os que passam nos filtros." />
                <Kpi stacked icon={Truck} label="Frota total" value={numero(frota)} tone="bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  caption={`veículos · soma dos ${numero(base.length)} projetos`} info="Soma das frotas dos projetos, contando a frota da venda complementar." />
                <Kpi stacked icon={Gauge} label="Frota média por projeto" value={comFrota ? numero(Math.round(frota / comFrota)) : "—"} tone="bg-sky-500/15 text-sky-700 dark:text-sky-300"
                  caption="veículos · projetos com frota" info="Frota total dividida pelos projetos que têm frota cadastrada." />
              </div>

              <StatusProjetos ps={filtrar(todos, f, "status")} selecionado={f.status} onSelecionar={s => mudar("status", s)} />

              <CargaGerentes linhas={cargaPorGerente(filtrar(todos, f, "gerente"))} selecionado={f.gerente} onSelecionar={g => mudar("gerente", g)}
                podeAtribuir={isAdmin} onAtribuir={id => navigate("/projetos/novo", { state: { gerenteId: id } })} />

              <div className="grid gap-5 lg:grid-cols-3">
                <EvolucaoFrota className="lg:col-span-2" dados={evolucaoFrota(base, ate)} />
                <SolucoesLista lista={porSolucao(filtrar(todos, f, "solucao"))} selecionado={f.solucao} onSelecionar={s => mudar("solucao", s)} />
              </div>

              <EvolucaoSolucoes dados={evolucaoSolucoes(base, ate)} />

              <MapaEstados contagem={porEstado(filtrar(todos, f, "estado"))} selecionado={f.estado} onSelecionar={uf => { mudar("estado", uf); mudar("cidade", null); }} />

              <ListaProjetos ps={base} onAbrir={id => navigate(`/projetos/${id}`, { state: { from: "/" } })} />
            </>
          )}
        </>
      )}
    </div>
  );
}
