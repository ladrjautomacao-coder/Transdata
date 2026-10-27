import { useEffect, useRef, useState } from "react";
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
  type AtividadeId, type GerProject, type Modulo01Estado,
} from "@/lib/gerenciamento";
import { montarTap, type DadosTap } from "@/lib/tap";
import { MedidorModulo } from "./MedidorModulo";
import { TapDialog } from "./TapDialog";
import { Modulo01 } from "./Modulo01";

// Ordem em discussão com os GPs: fica guardada neste navegador até virar a ordem oficial
const ORDEM_KEY = "gerenciamento:modulo01:ordem";
const TRAVA_KEY = "gerenciamento:modulo01:ordem-travada";
function lerOrdem(): AtividadeId[] {
  try {
    const salva = JSON.parse(localStorage.getItem(ORDEM_KEY) ?? "null") as AtividadeId[] | null;
    // só aceita a ordem salva se tiver exatamente as atividades atuais
    if (salva && salva.length === ORDEM_PADRAO.length && ORDEM_PADRAO.every(id => salva.includes(id)) && salva[0] === ORDEM_PADRAO[0]) return salva;
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

type Gravacao = { status: "ok" | "salvando" | "erro"; em: string | null };

/** Situação da gravação automática do módulo no banco. */
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
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Cada marcação do módulo é gravada no banco automaticamente.">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      {g.em ? `Salvo no banco · ${dataHoraBr(g.em)}` : "Salvo automaticamente a cada marcação"}
    </span>
  );
}

/** O projeto escolhido: cabeçalho, módulos e o módulo aberto. */
export function ProjectWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const { profile } = useAuth();
  const [project, setProject] = useState<GerProject | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<Modulo01Estado>(modulo01Vazio);

  // Gravação automática: cada mudança do módulo vai ao banco ~0,6 s depois, uma gravação por vez.
  const [gravacao, setGravacao] = useState<Gravacao>({ status: "ok", em: null });
  const gravado = useRef<string | null>(null); // JSON do que está no banco (null: ainda carregando)
  const atual = useRef(estado);
  atual.current = estado;
  const agendada = useRef<number | null>(null);
  const emAndamento = useRef(false);
  const deNovo = useRef(false);
  const salvar = useRef(async () => { /* definida abaixo */ });
  salvar.current = async () => {
    if (agendada.current) { clearTimeout(agendada.current); agendada.current = null; }
    if (emAndamento.current) { deNovo.current = true; return; }
    const snapshot = atual.current, json = JSON.stringify(snapshot);
    if (gravado.current === null || json === gravado.current) return;
    emAndamento.current = true;
    setGravacao(g => ({ ...g, status: "salvando" }));
    try {
      const em = await salvarModulo01(id, snapshot);
      gravado.current = json;
      setGravacao({ status: "ok", em });
    } catch (err) {
      setGravacao(g => ({ ...g, status: "erro" }));
      toast.error("Não foi possível salvar o módulo.", { description: errorMessage(err) });
    } finally {
      emAndamento.current = false;
      // mudou de novo enquanto gravava: grava a versão mais nova
      if (deNovo.current) { deNovo.current = false; void salvar.current(); }
    }
  };
  useEffect(() => {
    if (gravado.current === null || JSON.stringify(estado) === gravado.current) return;
    if (agendada.current) clearTimeout(agendada.current);
    agendada.current = window.setTimeout(() => { void salvar.current(); }, 600);
  }, [estado]);
  useEffect(() => {
    // fechar a aba com marcação ainda não gravada: o navegador pede confirmação
    const aviso = (e: BeforeUnloadEvent) => {
      if (gravado.current !== null && JSON.stringify(atual.current) !== gravado.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", aviso);
    return () => {
      window.removeEventListener("beforeunload", aviso);
      // "Trocar projeto" logo depois de marcar: grava o que estava esperando
      void salvar.current();
    };
  }, []);
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

  const load = () => {
    setProject(undefined); setError(null); gravado.current = null;
    // o projeto e o que já foi marcado no módulo chegam juntos: sem o módulo, a tela não abre
    // (evita gravar um módulo vazio por cima do que está no banco)
    Promise.all([fetchGerProject(id), fetchModulo01(id)])
      .then(([p, m]) => {
        gravado.current = JSON.stringify(m.estado);
        setEstado(m.estado);
        setGravacao({ status: "ok", em: m.salvoEm });
        setProject(p);
      })
      .catch(err => { setError(errorMessage(err)); setProject(null); });
  };
  useEffect(load, [id]);
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

  const emOrdem = ordem.map(id => MODULO_01.atividades.find(a => a.id === id)!);
  const aplicaveis = emOrdem.filter(a => situacao(a.id, estado, project, ordem) !== "naoaplica");
  const feitas = aplicaveis.filter(a => situacao(a.id, estado, project, ordem) === "feito").length;
  const proxima = aplicaveis.find(a => situacao(a.id, estado, project, ordem) !== "feito");
  const phase = project.sub_phase ? subPhasesByStatus[project.status as keyof typeof subPhasesByStatus]?.find(s => s.id === project.sub_phase)?.label : null;
  const solucoes = solutionsOf(project);
  const statusNome = statusLabels[project.status as keyof typeof statusLabels] ?? project.status;
  const gerarTap = async () => {
    // sem o coordenador (erro na busca), o TAP sai com a linha de assinatura em branco e o GP é avisado
    const coordenador = await fetchCoordenadorImplantacao().catch(err => {
      toast.warning("Não foi possível buscar o Coordenador de Implantação na Equipe.", { description: `A assinatura sai sem nome. ${errorMessage(err)}` });
      return null;
    });
    setTap(montarTap({
      project, estado, ordem, emitidoPor: profile?.full_name ?? "—", fase: phase ? `${statusNome} · ${phase}` : statusNome, coordenador,
    }));
  };
  const DOC_TAP = {
    botao: "Gerar documento TAP",
    bloqueado: "O documento TAP (Termo de Abertura do Projeto) é liberado quando o módulo chegar a 100%.",
    concluido: "Gere o documento TAP para assinatura.",
  };

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
        <div className="ml-auto"><SituacaoGravacao g={gravacao} onTentar={() => void salvar.current()} /></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Módulos do projeto */}
        <nav aria-label="Módulos do projeto" className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Módulos do projeto</p>
          <button type="button" aria-current="page" aria-expanded={aberto} onClick={() => (aberto ? setAberto(false) : abrir())}
            title={aberto ? "Voltar ao medidor do módulo" : "Abrir as atividades do módulo"}
            className="flex flex-col gap-2 rounded-xl border border-primary bg-primary/[0.06] p-3 text-left ring-1 ring-primary transition-colors hover:bg-primary/[0.1]">
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">{MODULO_01.numero}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{MODULO_01.nome}</span>
              <span className="text-xs font-semibold tabular-nums text-primary">{feitas}/{aplicaveis.length}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-primary/15"><span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(feitas / aplicaveis.length) * 100}%` }} /></span>
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-[13px] text-muted-foreground">
            <Layers className="h-4 w-4 shrink-0" />Próximos módulos: em definição
          </div>
        </nav>

        {!aberto ? (
          <MedidorModulo numero={MODULO_01.numero} nome={MODULO_01.nome} resumo={MODULO_01.resumo}
            atividades={emOrdem.map(a => ({ a, sit: situacao(a.id, estado, project, ordem) }))} onAbrir={abrir}
            documento={DOC_TAP} onGerarDocumento={gerarTap} />
        ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <Button variant="ghost" size="sm" className="-mb-1 -ml-2 h-8 w-fit text-muted-foreground" onClick={() => setAberto(false)}>
            <Gauge className="mr-1.5 h-4 w-4" />Voltar ao medidor do módulo
          </Button>
          {/* Destaque do módulo */}
          <section aria-labelledby="ger-mod-titulo" className="flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-sm sm:p-6">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">Módulo {MODULO_01.numero}</p>
              <h2 id="ger-mod-titulo" className="text-xl font-bold sm:text-2xl">{MODULO_01.nome}</h2>
              <p className="mt-1 max-w-xl text-sm opacity-85">{MODULO_01.resumo}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-2.5 py-1.5 text-[13px] font-medium">
                  <Rocket className="h-4 w-4" />{proxima ? <>Próximo passo: <b>{proxima.titulo}</b></> : "Módulo concluído"}
                </p>
                {!proxima && (
                  <Button size="sm" className="h-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={gerarTap}>
                    <FileText className="mr-1.5 h-4 w-4" />{DOC_TAP.botao}
                  </Button>
                )}
              </div>
            </div>
            <ProgressRing done={feitas} total={aplicaveis.length} />
          </section>

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

          <Modulo01 project={project} estado={estado} onChange={u => setEstado(u)} userName={profile?.full_name ?? "Você"}
            ordem={ordem} travada={travada} onMover={mover} onAtualizarProjeto={reler} />
        </div>
        )}
      </div>
      <TapDialog dados={tap} onOpenChange={o => { if (!o) setTap(null); }} />
    </div>
  );
}
