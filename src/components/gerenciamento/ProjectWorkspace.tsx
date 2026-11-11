import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowUpDown, CalendarX, CheckCircle2, FileText, Loader2, Lock, LockOpen, RefreshCw, Rocket, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { statusLabels } from "@/lib/statusLabels";
import { formatLocation } from "@/lib/location";
import { subPhasesByStatus } from "@/pages/ProjectManagement";
import { errorMessage } from "@/lib/implantationScheduling";
import {
  MODULO_01, ORDEM_PADRAO, dataHoraBr, fetchAssistenteProjetos, fetchCoordenadorImplantacao, fetchGerProject, fetchModulo01, modulo01Vazio, salvarModulo01, situacao, solutionsOf,
  type Atividade, type AtividadeId, type GerProject, type Modulo01Estado, type SituacaoAtividade,
} from "@/lib/gerenciamento";
import { MODULO_02, fetchModulo02, modulo02Vazio, salvarModulo02, situacao02, type Modulo02Estado } from "@/lib/modulo02";
import { MODULO_03, fetchModulo03, modulo03Vazio, salvarModulo03, situacao03, type Modulo03Estado } from "@/lib/modulo03";
import { cartoesDoTermo, qtdTermo } from "@/lib/termoCartoes";
import { montarTap, type DadosTap } from "@/lib/tap";
import { CabecalhoProjeto, NavModulos, NumeroModulo, ProgressoProjeto, destaqueValido, type AvisoProjeto, type ModuloProgresso } from "./ProgressoProjeto";
// a cidade da entrada do portal (vídeo da Runway), parada, ao fundo do cabeçalho do projeto
import imagemCidade from "@/assets/entrada/entrada-login.jpg";
import { TapDialog } from "./TapDialog";
import { Modulo01 } from "./Modulo01";
import { Modulo02, ReuniaoPe } from "./Modulo02";
import { Modulo03 } from "./Modulo03";
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
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-primary/15" />
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-500 ${pct === 1 ? "stroke-emerald-500" : "stroke-primary"}`}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-xl font-bold tabular-nums">{done}/{total}</span>
        <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">feitas</span>
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

/**
 * Módulos prontos, na ordem do projeto. Módulo novo: entra aqui, na lista do progresso do projeto
 * (`modulos`, abaixo) e no conteúdo do módulo aberto.
 */
const MODULOS = ["01", "02", "03"] as const;
type ModuloNum = (typeof MODULOS)[number];

/** Destaque do módulo aberto: número, nome, próximo passo (no laranja do logo) e o anel de progresso. */
function DestaqueModulo({ numero, nome, resumo, proxima, feitas, total, children }: {
  numero: string; nome: string; resumo: string; proxima?: string; feitas: number; total: number; children?: ReactNode;
}) {
  return (
    <section aria-labelledby="ger-mod-titulo" className="flex flex-wrap items-center gap-5 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <NumeroModulo numero={numero} tamanho="lg" />
      <div className="min-w-0 flex-1 basis-64">
        <h2 id="ger-mod-titulo" className="text-2xl font-bold leading-tight">{nome}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{resumo}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {proxima ? (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-2.5 py-1.5 text-[13px] font-medium text-orange-800 dark:text-orange-200">
              <Rocket className="h-4 w-4 shrink-0" />Próximo passo: <b>{proxima}</b>
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[13px] font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Módulo concluído
            </p>
          )}
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

/**
 * O projeto escolhido: cabeçalho, módulos ao lado e o progresso do projeto (um medidor com todos os
 * módulos); com ?modulo=01, 02 ou 03, as atividades daquele módulo.
 */
export function ProjectWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const { profile, isSuperAdmin, managerId } = useAuth();
  const [params, setParams] = useSearchParams();
  const qual = params.get("modulo");
  const modulo: ModuloNum | null = MODULOS.find(m => m === qual) ?? null;
  const [project, setProject] = useState<GerProject | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // cada módulo é gravado sozinho no banco a cada mudança
  const m1 = useModuloGravado<Modulo01Estado>(e => salvarModulo01(id, e), modulo01Vazio);
  const m2 = useModuloGravado<Modulo02Estado>(e => salvarModulo02(id, e), modulo02Vazio);
  const m3 = useModuloGravado<Modulo03Estado>(e => salvarModulo03(id, e), modulo03Vazio);
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
  const { carregar: carregar3, descarregar: descarregar3 } = m3;
  const load = useCallback(() => {
    setProject(undefined); setError(null); descarregar1(); descarregar2(); descarregar3();
    // o projeto e o que já foi marcado nos módulos chegam juntos: sem os módulos, a tela não abre
    // (evita gravar um módulo vazio por cima do que está no banco)
    Promise.all([fetchGerProject(id), fetchModulo01(id), fetchModulo02(id), fetchModulo03(id)])
      .then(([p, a, b, c]) => {
        carregar1(a.estado, a.salvoEm);
        carregar2(b.estado, b.salvoEm);
        carregar3(c.estado, c.salvoEm);
        setProject(p);
      })
      .catch(err => { setError(errorMessage(err)); setProject(null); });
  }, [id, carregar1, descarregar1, carregar2, descarregar2, carregar3, descarregar3]);
  useEffect(load, [load]);
  // ao abrir o projeto, o progresso do projeto; as atividades de um módulo só abrem quando o GP pede.
  // foco: até onde rolar depois de abrir (a atividade ou o início do módulo), um objeto novo a cada pedido
  const [foco, setFoco] = useState<{ atividade: string | null } | null>(null);
  // TAP: foto do módulo no clique em "Gerar documento TAP" (o diálogo gera o PDF)
  const [tap, setTap] = useState<DadosTap | null>(null);
  // número do cabeçalho tocado: acende nas trilhas as atividades daquela situação
  const [escolhido, setEscolhido] = useState<SituacaoAtividade | null>(null);
  useEffect(() => {
    if (!foco) return;
    const t = setTimeout(() => {
      const alvo = foco.atividade ? document.getElementById(`ger-atv-${foco.atividade}`) : document.getElementById("ger-mod-titulo");
      alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [foco]);
  /** Abre as atividades do módulo (com a atividade, rola até ela); sem módulo, volta ao progresso do projeto. */
  const irPara = (m: ModuloNum | null, atividade?: string) => {
    if (m !== modulo) {
      const n = new URLSearchParams(params);
      if (m) n.set("modulo", m); else n.delete("modulo");
      setParams(n);
    }
    setFoco(m ? { atividade: atividade ?? null } : null);
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
  // o GP abre só os projetos dele (o banco também barra); o Super Admin abre todos
  if (!isSuperAdmin && project.manager_id !== managerId) {
    return (
      <div className="flex flex-col gap-5">
        {back}
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-sm">
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">
            <b>{project.company_name}</b> é um projeto de {project.manager?.full_name ?? "outro GP"}. No Gerenciamento você abre só os projetos em que é o GP.
          </span>
        </div>
      </div>
    );
  }

  const lista01 = ordem.map(id => MODULO_01.atividades.find(a => a.id === id)!).map(a => ({ a, sit: situacao(a.id, estado, project, ordem) }));
  const and01 = andamento(lista01);
  const lista02 = MODULO_02.atividades.map(a => ({ a, sit: situacao02(a.id, m2.estado) }));
  const and02 = andamento(lista02);
  const lista03 = MODULO_03.atividades.map(a => ({ a, sit: situacao03(a.id, m3.estado) }));
  const and03 = andamento(lista03);
  const phase = project.sub_phase ? subPhasesByStatus[project.status as keyof typeof subPhasesByStatus]?.find(s => s.id === project.sub_phase)?.label : null;
  const solucoes = solutionsOf(project);
  const statusNome = statusLabels[project.status as keyof typeof statusLabels] ?? project.status;
  const gerarTapCom = async (atual: Modulo01Estado) => {
    // sem o coordenador (erro na busca), o TAP sai com a linha de assinatura em branco e o GP é avisado
    const [coordenador, assistente] = await Promise.all([
      fetchCoordenadorImplantacao().catch(err => {
        toast.warning("Não foi possível buscar o Coordenador de Implantação na Equipe.", { description: `A assinatura sai sem nome. ${errorMessage(err)}` });
        return null;
      }),
      // sem a Assistente, o TAP mostra só a função
      fetchAssistenteProjetos().catch(() => null),
    ]);
    setTap(montarTap({
      project, estado: atual, ordem, emitidoPor: profile?.full_name ?? "—", fase: phase ? `${statusNome} · ${phase}` : statusNome, coordenador, assistente,
    }));
  };
  const gerarTap = () => { void gerarTapCom(estado); };
  const BOTAO_TAP = "Gerar documento TAP";
  const userName = profile?.full_name ?? "Você";
  const reuniaoPe = m2.estado.contato.registradoEm ? m2.estado.contato.reuniaoPe : null;
  // o progresso do projeto soma as atividades de todos os módulos (a lateral sai desta lista)
  const modulos: (ModuloProgresso &{ numero: ModuloNum })[] = [
    {
      numero: "01", nome: MODULO_01.nome, atividades: lista01, rotuloBloqueado: "Esperando o checklist",
      extra: and01.proxima ? (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground" title="O documento TAP (Termo de Abertura do Projeto) é liberado quando o módulo 01 chegar a 100%.">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />TAP liberado com o módulo a 100%
        </span>
      ) : (
        <Button size="sm" className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-500" onClick={gerarTap}>
          <FileText className="mr-1.5 h-3.5 w-3.5" />{BOTAO_TAP}
        </Button>
      ),
    },
    { numero: "02", nome: MODULO_02.nome, atividades: lista02, extra: <ReuniaoPe reuniaoPe={reuniaoPe} /> },
    { numero: "03", nome: MODULO_03.nome, atividades: lista03, rotuloBloqueado: "Esperando outra atividade" },
  ];
  // os cartões separados no módulo 02, para a gravação no módulo 03 ("01 Chave · 05 Senha · …")
  const cartoesLevados = m2.estado.cartoes.registradoEm
    ? cartoesDoTermo(project, m2.estado.cartoes).filter(x => x.quantidade > 0).map(x => `${qtdTermo(x.quantidade)} ${x.tipo.trim() || "outro"}`).join(" · ")
    : undefined;
  // o que pede atenção no projeto, ao lado dos módulos (as atividades aguardando retorno entram sozinhas)
  const avisos: AvisoProjeto[] = [
    ...(!reuniaoPe ? [{ icone: CalendarX, titulo: "Reunião de PE sem data", texto: "Agende com o cliente no módulo 02.", tom: "ambar" as const, modulo: "02", atividade: "contato" }] : []),
    ...(and01.proxima ? [{ icone: Lock, titulo: "TAP bloqueado", texto: "Libera quando o módulo 01 chegar a 100%.", tom: "neutro" as const, modulo: "01" }] : []),
  ];
  const destaque = destaqueValido(modulos, escolhido);
  /** Número do cabeçalho tocado: destaca (ou tira o destaque) e, com um módulo aberto, volta ao progresso. */
  const destacar = (s: SituacaoAtividade) => {
    setEscolhido(atual => (atual === s && modulo === null ? null : s));
    if (modulo !== null) irPara(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoProjeto
        nome={project.company_name}
        fase={phase ?? statusNome}
        local={formatLocation(project.city, project.state, project.country_code)}
        gp={project.manager?.full_name ?? "não definido"}
        codigo={project.project_code}
        solucoes={solucoes}
        imagem={imagemCidade}
        modulos={modulos}
        destaque={modulo === null ? destaque : null}
        onDestacar={destacar}
        onBack={onBack}
      />

      {/* abas inteiras na linha; o "Salvo no banco" desce quando não couber ao lado */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 max-w-full"><NavModulos modulos={modulos} ativo={modulo} onIr={m => irPara(m as ModuloNum | null)} /></div>
        <div className="ml-auto"><SituacaoGravacao g={juntarGravacoes([m1.gravacao, m2.gravacao, m3.gravacao])} onTentar={() => { m1.salvarAgora(); m2.salvarAgora(); m3.salvarAgora(); }} /></div>
      </div>

      <div className="min-w-0">
        {modulo === null ? (
          <ProgressoProjeto modulos={modulos} onAbrir={(m, atividade) => irPara(m as ModuloNum, atividade)}
            destaque={destaque} onLimparDestaque={() => setEscolhido(null)} avisos={avisos} nomeGp={project.manager?.full_name ?? null} />
        ) : modulo === "01" ? (
          <div className="flex min-w-0 flex-col gap-4">
            <DestaqueModulo numero={MODULO_01.numero} nome={MODULO_01.nome} resumo={MODULO_01.resumo} proxima={and01.proxima?.titulo} feitas={and01.feitas} total={and01.total}>
              {!and01.proxima && (
                <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-500" onClick={gerarTap}>
                  <FileText className="mr-1.5 h-4 w-4" />{BOTAO_TAP}
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
        ) : modulo === "02" ? (
          <div className="flex min-w-0 flex-col gap-4">
            <DestaqueModulo numero={MODULO_02.numero} nome={MODULO_02.nome} resumo={MODULO_02.resumo} proxima={and02.proxima?.titulo} feitas={and02.feitas} total={and02.total}>
              <ReuniaoPe reuniaoPe={reuniaoPe} />
            </DestaqueModulo>
            <Modulo02 project={project} estado={m2.estado} onChange={u => m2.setEstado(u)} userName={userName} emailCliente={estado.carrier.para} />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <DestaqueModulo numero={MODULO_03.numero} nome={MODULO_03.nome} resumo={MODULO_03.resumo} proxima={and03.proxima?.titulo} feitas={and03.feitas} total={and03.total}>
              <ReuniaoPe reuniaoPe={reuniaoPe} />
            </DestaqueModulo>
            <Modulo03 project={project} estado={m3.estado} onChange={u => m3.setEstado(u)} userName={userName} cartoesLevados={cartoesLevados} />
          </div>
        )}
      </div>
      <TapDialog dados={tap} onOpenChange={o => { if (!o) setTap(null); }} />
    </div>
  );
}
