import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowUpDown, CheckCircle2, FileText, Gauge, Layers, Loader2, Lock, LockOpen, RefreshCw, Rocket, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { statusLabels } from "@/lib/statusLabels";
import { formatLocation } from "@/lib/location";
import { subPhasesByStatus } from "@/pages/ProjectManagement";
import { errorMessage } from "@/lib/implantationScheduling";
import {
  MODULO_01, ORDEM_PADRAO, dataHoraBr, fetchCoordenadorImplantacao, fetchGerProject, fetchModulo01, modulo01Vazio, salvarModulo01, situacao, solutionsOf,
  type Atividade, type AtividadeId, type GerProject, type Modulo01Estado, type SituacaoAtividade,
} from "@/lib/gerenciamento";
import { MODULO_02, fetchModulo02, modulo02Vazio, salvarModulo02, situacao02, type Modulo02Estado } from "@/lib/modulo02";
import { montarTap, type DadosTap } from "@/lib/tap";
import { MedidorModulo } from "./MedidorModulo";
import { TapDialog } from "./TapDialog";
import { Modulo01 } from "./Modulo01";
import { Modulo02, ReuniaoPe } from "./Modulo02";
import { juntarGravacoes, useModuloGravado, type Gravacao } from "./useModuloGravado";

// Ordem em discussão com os GPs: fica guardada neste navegador até virar a ordem oficial
const ORDEM_KEY = "gerenciamento:modulo01:ordem";
const TRAVA_KEY = "gerenciamento:modulo01:ordem-travada";
function lerOrdem(): AtividadeId[] {
  try {
    const salva = JSON.parse(localStorage.getItem(ORDEM_KEY) ?? "null") as AtividadeId[] | null;
    if (salva && salva[0] === ORDEM_PADRAO[0]) {
      const ordem = salva.filter(id => ORDEM_PADRAO.includes(id));
      if (new Set(ordem).size === ordem.length) {
        // atividade nova (que a ordem salva não conhece) entra logo depois da que vem antes dela na ordem padrão
        ORDEM_PADRAO.forEach((id, i) => { if (!ordem.includes(id)) ordem.splice(ordem.indexOf(ORDEM_PADRAO[i - 1]) + 1, 0, id); });
        return ordem;
      }
    }
  } catch { /* ignore */ }
  return ORDEM_PADRAO;
}
const guardar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

/** Anel de progresso do módulo (feitas / aplicáveis). */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={`${done} de ${total} atividades feitas`}>
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-primary-foreground/20" />
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-primary-foreground transition-[stroke-dashoffset] duration-500"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-bold tabular-nums">{done}/{total}</span>
        <span className="mt-0.5 text-[10px] font-medium opacity-80">feitas</span>
      </span>
    </div>
  );
}

/** Situação da gravação automática dos módulos no banco. */
function SituacaoGravacao({ g, onTentar }: { g: Gravacao; onTentar: () => void }) {
  if (g.status === "salvando") {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</span>;
  }
  if (g.status === "erro") {
    return (
      <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Não foi possível salvar as últimas marcações.
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onTentar}><RefreshCw className="mr-1 h-3.5 w-3.5" />Tentar de novo</Button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Cada marcação dos módulos é gravada no banco automaticamente.">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      {g.em ? `Salvo no banco · ${dataHoraBr(g.em)}` : "Salvo automaticamente a cada marcação"}
    </span>
  );
}

type ModuloNum = "01" | "02";

/** Um módulo na lista de módulos do projeto, com o andamento. */
function CartaoModulo({ numero, nome, feitas, total, ativo, aberto, onClick }: {
  numero: string; nome: string; feitas: number; total: number; ativo: boolean; aberto: boolean; onClick: () => void;
}) {
  const completo = total > 0 && feitas === total;
  return (
    <button type="button" aria-current={ativo ? "page" : undefined} aria-expanded={ativo ? aberto : undefined} onClick={onClick}
      title={!ativo ? `Abrir o módulo ${numero}` : aberto ? "Voltar ao medidor do módulo" : "Abrir as atividades do módulo"}
      className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${ativo
        ? "border-primary bg-primary/[0.06] ring-1 ring-primary hover:bg-primary/[0.1]"
        : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03]"}`}>
      <span className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{numero}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{nome}</span>
        {completo
          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Módulo concluído" />
          : <span className="text-xs font-semibold tabular-nums text-primary">{feitas}/{total}</span>}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-primary/15">
        <span className={`block h-full rounded-full transition-[width] duration-500 ${completo ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
      </span>
    </button>
  );
}

/** Destaque do módulo aberto: nome, próximo passo e o anel de progresso. */
function DestaqueModulo({ numero, nome, resumo, proxima, feitas, total, children }: {
  numero: string; nome: string; resumo: string; proxima?: string; feitas: number; total: number; children?: ReactNode;
}) {
  return (
    <section aria-labelledby="ger-mod-titulo" className="flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-sm sm:p-6">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">Módulo {numero}</p>
        <h2 id="ger-mod-titulo" className="text-xl font-bold sm:text-2xl">{nome}</h2>
        <p className="mt-1 max-w-xl text-sm opacity-85">{resumo}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-2.5 py-1.5 text-[13px] font-medium">
            <Rocket className="h-4 w-4" />{proxima ? <>Próximo passo: <b>{proxima}</b></> : "Módulo concluído"}
          </p>
          {children}
        </div>
      </div>
      <ProgressRing done={feitas} total={total} />
    </section>
  );
}

/** Feitas, aplicáveis e a próxima atividade de um módulo. */
function andamento<Id extends string>(lista: { a: Atividade<Id>; sit: SituacaoAtividade }[]) {
  const aplicaveis = lista.filter(x => x.sit !== "naoaplica");
  return {
    feitas: aplicaveis.filter(x => x.sit === "feito").length,
    total: aplicaveis.length,
    proxima: aplicaveis.find(x => x.sit !== "feito")?.a,
  };
}

/** O projeto escolhido: cabeçalho, módulos e o módulo aberto (?modulo=02; sem ele, o 01). */
export function ProjectWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const modulo: ModuloNum = params.get("modulo") === "02" ? "02" : "01";
  const [project, setProject] = useState<GerProject | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // cada módulo é gravado sozinho no banco a cada mudança
  const m1 = useModuloGravado<Modulo01Estado>(e => salvarModulo01(id, e), modulo01Vazio);
  const m2 = useModuloGravado<Modulo02Estado>(e => salvarModulo02(id, e), modulo02Vazio);
  const estado = m1.estado;

  const [ordem, setOrdem] = useState<AtividadeId[]>(lerOrdem);
  const [travada, setTravada] = useState<boolean>(() => { try { return localStorage.getItem(TRAVA_KEY) === "true"; } catch { return false; } });
  const mover = (id: AtividadeId, dir: -1 | 1) => setOrdem(o => {
    const i = o.indexOf(id), j = i + dir;
    if (i < 1 || j < 1 || j >= o.length) return o; // o 1º (cadastro no portal) não sai do lugar
    const n = [...o]; [n[i], n[j]] = [n[j], n[i]];
    guardar(ORDEM_KEY, n);
    return n;
  });
  const restaurar = () => { setOrdem(ORDEM_PADRAO); guardar(ORDEM_KEY, ORDEM_PADRAO); };
  const alternarTrava = () => setTravada(t => { guardar(TRAVA_KEY, !t); return !t; });
  const ordemMudou = ordem.some((id, i) => id !== ORDEM_PADRAO[i]);

  const { carregar: carregar1, descarregar: descarregar1 } = m1;
  const { carregar: carregar2, descarregar: descarregar2 } = m2;
  const load = useCallback(() => {
    setProject(undefined); setError(null); descarregar1(); descarregar2();
    // o projeto e o que já foi marcado nos módulos chegam juntos: sem os módulos, a tela não abre
    // (evita gravar um módulo vazio por cima do que está no banco)
    Promise.all([fetchGerProject(id), fetchModulo01(id), fetchModulo02(id)])
      .then(([p, a, b]) => {
        carregar1(a.estado, a.salvoEm);
        carregar2(b.estado, b.salvoEm);
        setProject(p);
      })
      .catch(err => { setError(errorMessage(err)); setProject(null); });
  }, [id, carregar1, descarregar1, carregar2, descarregar2]);
  useEffect(load, [load]);
  // ao abrir o projeto, o módulo aparece no medidor; a lista de atividades só abre quando o GP pede
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  // TAP: foto do módulo no clique em "Gerar documento TAP" (o diálogo gera o PDF)
  const [tap, setTap] = useState<DadosTap | null>(null);
  const abrir = (atividadeId?: string) => { setFoco(atividadeId ?? null); setAberto(true); };
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(() => {
      const alvo = foco ? document.getElementById(`ger-atv-${foco}`) : document.getElementById("ger-mod-titulo");
      alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [aberto, foco]);
  // o módulo de cada vez: clicar no aberto alterna medidor e atividades; outro módulo abre no medidor
  const escolherModulo = (m: ModuloNum) => {
    if (m === modulo) { if (aberto) setAberto(false); else abrir(); return; }
    const n = new URLSearchParams(params);
    if (m === "01") n.delete("modulo"); else n.set("modulo", m);
    setParams(n);
    setAberto(false);
  };
  // sem esqueleto: a tela e o que o GP preencheu continuam onde estão
  const reler = () => fetchGerProject(id).then(p => { if (p) setProject(p); });

  const back = <Button variant="ghost" size="sm" className="-ml-2 h-8 w-fit text-muted-foreground" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Trocar projeto</Button>;

  if (project === undefined) {
    return <div className="flex flex-col gap-5">{back}<Skeleton className="h-20 rounded-xl" /><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-96 rounded-xl" /></div>;
  }
  if (!project) {
    return (
      <div className="flex flex-col gap-5">
        {back}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          <span className="flex-1">{error ? `Não foi possível abrir o projeto. ${error}` : "Projeto não encontrado. Ele pode ter sido excluído."}</span>
          {error && <Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>}
        </div>
      </div>
    );
  }

  const lista01 = ordem.map(id => MODULO_01.atividades.find(a => a.id === id)!).map(a => ({ a, sit: situacao(a.id, estado, project, ordem) }));
  const and01 = andamento(lista01);
  const lista02 = MODULO_02.atividades.map(a => ({ a, sit: situacao02(a.id, m2.estado) }));
  const and02 = andamento(lista02);
  const phase = project.sub_phase ? subPhasesByStatus[project.status as keyof typeof subPhasesByStatus]?.find(s => s.id === project.sub_phase)?.label : null;
  const solucoes = solutionsOf(project);
  const statusNome = statusLabels[project.status as keyof typeof statusLabels] ?? project.status;
  const gerarTapCom = async (atual: Modulo01Estado) => {
    // sem o coordenador (erro na busca), o TAP sai com a linha de assinatura em branco e o GP é avisado
    const coordenador = await fetchCoordenadorImplantacao().catch(err => {
      toast.warning("Não foi possível buscar o Coordenador de Implantação na Equipe.", { description: `A assinatura sai sem nome. ${errorMessage(err)}` });
      return null;
    });
    setTap(montarTap({
      project, estado: atual, ordem, emitidoPor: profile?.full_name ?? "—", fase: phase ? `${statusNome} · ${phase}` : statusNome, coordenador,
    }));
  };
  const gerarTap = () => { void gerarTapCom(estado); };
  const DOC_TAP = {
    botao: "Gerar documento TAP",
    bloqueado: "O documento TAP (Termo de Abertura do Projeto) é liberado quando o módulo chegar a 100%.",
    concluido: "Gere o documento TAP para assinatura.",
  };
  const userName = profile?.full_name ?? "Você";
  const voltarAoMedidor = (
    <Button variant="ghost" size="sm" className="-mb-1 -ml-2 h-8 w-fit text-muted-foreground" onClick={() => setAberto(false)}>
      <Gauge className="mr-1.5 h-4 w-4" />Voltar ao medidor do módulo
    </Button>
  );
  const reuniaoPe = m2.estado.contato.registradoEm ? m2.estado.contato.reuniaoPe : null;

  return (
    <div className="flex flex-col gap-5">
      {back}
      {/* Header */}
      <div className="-mt-2 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gerenciamento</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">Em desenvolvimento · só Super Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.company_name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {project.project_code && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{project.project_code}</span>}
            <span>{formatLocation(project.city, project.state, project.country_code)}</span>
            <span>· <b className="font-semibold text-primary">{phase ?? statusLabels[project.status as keyof typeof statusLabels] ?? project.status}</b></span>
            <span>· GP {project.manager?.full_name ?? "não definido"}</span>
          </p>
          {solucoes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {solucoes.map(s => <span key={s} className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] font-medium">{s}</span>)}
            </div>
          )}
        </div>
        <div className="ml-auto">
          <SituacaoGravacao g={juntarGravacoes([m1.gravacao, m2.gravacao])} onTentar={() => { m1.salvarAgora(); m2.salvarAgora(); }} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Módulos do projeto */}
        <nav aria-label="Módulos do projeto" className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Módulos do projeto</p>
          <CartaoModulo numero={MODULO_01.numero} nome={MODULO_01.nome} feitas={and01.feitas} total={and01.total}
            ativo={modulo === "01"} aberto={aberto} onClick={() => escolherModulo("01")} />
          <CartaoModulo numero={MODULO_02.numero} nome={MODULO_02.nome} feitas={and02.feitas} total={and02.total}
            ativo={modulo === "02"} aberto={aberto} onClick={() => escolherModulo("02")} />
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-[13px] text-muted-foreground">
            <Layers className="h-4 w-4 shrink-0" />Próximos módulos: em definição
          </div>
        </nav>

        {modulo === "01" ? (!aberto ? (
          <MedidorModulo numero={MODULO_01.numero} nome={MODULO_01.nome} resumo={MODULO_01.resumo}
            atividades={lista01} onAbrir={abrir} documento={DOC_TAP} onGerarDocumento={gerarTap} />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {voltarAoMedidor}
            <DestaqueModulo numero={MODULO_01.numero} nome={MODULO_01.nome} resumo={MODULO_01.resumo} proxima={and01.proxima?.titulo} feitas={and01.feitas} total={and01.total}>
              {!and01.proxima && (
                <Button size="sm" className="h-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={gerarTap}>
                  <FileText className="mr-1.5 h-4 w-4" />{DOC_TAP.botao}
                </Button>
              )}
            </DestaqueModulo>

            {/* Ordem das atividades: em ajuste com os GPs até a definição oficial */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 ${travada ? "border-border/60 bg-card" : "border-dashed border-primary/40 bg-primary/[0.04]"}`}>
              {travada ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ArrowUpDown className="h-4 w-4 shrink-0 text-primary" />}
              <p className="min-w-0 flex-1 basis-60 text-[13px]">
                {travada
                  ? <><b>Ordem travada.</b> <span className="text-muted-foreground">As atividades não podem mais ser movidas.</span></>
                  : <><b>Ordem em ajuste.</b> <span className="text-muted-foreground">Use as setas de cada atividade para subir ou descer enquanto a ordem é definida com os GPs. O que fica abaixo do checklist depende dele.</span></>}
              </p>
              <div className="flex flex-wrap gap-2">
                {!travada && ordemMudou && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={restaurar}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Ordem original</Button>}
                <Button variant="outline" size="sm" className="h-8 bg-background text-xs" onClick={alternarTrava}>
                  {travada ? <><LockOpen className="mr-1.5 h-3.5 w-3.5" />Destravar ordem</> : <><Lock className="mr-1.5 h-3.5 w-3.5" />Travar ordem</>}
                </Button>
              </div>
            </div>

            <Modulo01 project={project} estado={estado} onChange={u => m1.setEstado(u)} userName={userName}
              ordem={ordem} travada={travada} onMover={mover} onAtualizarProjeto={reler} onGerarTap={e => void gerarTapCom(e)} />
          </div>
        )) : (!aberto ? (
          <MedidorModulo numero={MODULO_02.numero} nome={MODULO_02.nome} resumo={MODULO_02.resumo}
            atividades={lista02} onAbrir={abrir} rotuloBloqueado="Esperando outra etapa"
            destaque={<ReuniaoPe reuniaoPe={reuniaoPe} />} />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {voltarAoMedidor}
            <DestaqueModulo numero={MODULO_02.numero} nome={MODULO_02.nome} resumo={MODULO_02.resumo} proxima={and02.proxima?.titulo} feitas={and02.feitas} total={and02.total}>
              <ReuniaoPe reuniaoPe={reuniaoPe} sobreMarca />
            </DestaqueModulo>
            <Modulo02 project={project} estado={m2.estado} onChange={u => m2.setEstado(u)} userName={userName} emailCliente={estado.carrier.para} />
          </div>
        ))}
      </div>
      <TapDialog dados={tap} onOpenChange={o => { if (!o) setTap(null); }} />
    </div>
  );
}
