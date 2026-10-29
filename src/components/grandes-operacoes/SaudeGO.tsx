import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Check, CheckCircle2, Gauge, Hourglass, Minus, PlayCircle, X } from "lucide-react";
import { Velocimetro } from "@/components/Velocimetro";
import {
  etapaStatus, etapasOf, nomeCurto, podeComecar, stats, type GoAtividade, type GoDados, type GoProjeto, type GoStatus,
} from "@/lib/grandesOperacoes/dados";
import { urlProjeto } from "@/lib/grandesOperacoes/ui";
import { NIVEL, nivelDe } from "@/lib/nivelMedidor";
import { cn } from "@/lib/utils";
import { Barra, SituacaoPill } from "./GoShared";

/** Quadrantes da saúde: a contagem por status e o destaque nas trilhas. */
const QUADRANTE: Record<GoStatus, { rotulo: string; icone: typeof Check; bolinha: string; cor: string; caixa: string }> = {
  concluido: { rotulo: "Concluídas", icone: Check, bolinha: "bg-emerald-600 text-white", cor: "text-emerald-700 dark:text-emerald-300", caixa: "border-emerald-500 bg-emerald-500/10 ring-emerald-500/30" },
  andamento: { rotulo: "Em andamento", icone: Activity, bolinha: "bg-sky-500 text-white", cor: "text-sky-700 dark:text-sky-300", caixa: "border-sky-500 bg-sky-500/10 ring-sky-500/30" },
  espera: { rotulo: "Em espera", icone: Hourglass, bolinha: "bg-amber-500 text-white", cor: "text-amber-800 dark:text-amber-200", caixa: "border-amber-500 bg-amber-500/10 ring-amber-500/30" },
  removido: { rotulo: "Removidas", icone: Minus, bolinha: "border border-dashed border-border bg-background text-muted-foreground", cor: "text-muted-foreground", caixa: "border-muted-foreground/60 bg-muted ring-muted-foreground/25" },
};
/** Bolinha da etapa na trilha, pela situação das atividades dela. */
const BOLINHA: Record<GoStatus, string> = {
  concluido: "bg-emerald-600 text-white",
  andamento: "bg-sky-500 text-white",
  espera: "bg-background text-amber-700 ring-2 ring-inset ring-amber-500/70 dark:text-amber-300",
  removido: "border border-dashed border-border bg-background text-muted-foreground",
};

/** As etapas de um projeto em trilha: a cor diz a situação; clicar filtra o quadro por ela. */
function TrilhaEtapas({ dados, p, lista, mostrarProjeto, etapa, onEtapa, destaque }: {
  dados: GoDados; p: GoProjeto; lista: GoAtividade[]; mostrarProjeto: boolean;
  etapa: number | null; onEtapa: (id: number | null) => void; destaque: GoStatus | null;
}) {
  const ets = etapasOf(dados, lista), s = stats(lista);
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 last:pb-1">
      {mostrarProjeto && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Link to={urlProjeto(p.id)} className="text-sm font-semibold hover:text-primary hover:underline">{nomeCurto(p)}</Link>
          <span className="w-24"><Barra s={s} /></span>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{s.done}/{s.total}</span>
          <SituacaoPill situacao={p.situacao} />
        </div>
      )}
      <ol className="-my-1.5 flex items-start overflow-x-auto py-2.5">
        {ets.map((e, i) => {
          const st = etapaStatus(e.acts), es = stats(e.acts), sel = etapa === e.key;
          const n = destaque ? e.acts.filter(a => a.status === destaque).length : 0;
          const apagada = !!destaque && !n;
          return (
            <li key={e.key} className="flex min-w-[92px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span aria-hidden className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : etapaStatus(ets[i - 1].acts) === "concluido" ? "bg-emerald-500" : "bg-border", destaque && "opacity-30")} />
                <button type="button" onClick={() => onEtapa(sel ? null : e.key)} aria-pressed={sel}
                  title={sel ? "Ver todas as etapas no quadro" : `Mostrar só a etapa ${e.num} no quadro`}
                  aria-label={`Etapa ${e.num} ${e.nome}: ${es.done} de ${es.total} concluídas`}
                  className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-[transform,opacity] duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    BOLINHA[st], sel && "ring-4 ring-primary/35", !!n && "z-10 scale-110 shadow-lg", apagada && "opacity-25 grayscale")}>
                  {st === "concluido" ? <CheckCircle2 className="h-4 w-4" /> : e.num.split(".").pop()}
                  {!!n && <span className={cn("absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold shadow", QUADRANTE[destaque!].bolinha)}>{n}</span>}
                </button>
                <span aria-hidden className={cn("h-0.5 flex-1", i === ets.length - 1 ? "opacity-0" : st === "concluido" ? "bg-emerald-500" : "bg-border", destaque && "opacity-30")} />
              </div>
              <span className={cn("mt-2 line-clamp-2 px-1 text-center text-[11px] leading-tight", sel ? "font-semibold text-primary" : "text-muted-foreground", apagada && "opacity-40")}>{e.nome}</span>
              <span className={cn("text-[10.5px] tabular-nums text-muted-foreground/80", apagada && "opacity-40")}>{es.done}/{es.total}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Saúde do projeto (ou dos projetos do cliente): o medidor das concluídas, o que está em andamento e
 * o que já pode começar, a contagem por status e a trilha das etapas de cada projeto.
 */
export function SaudeGO({ dados, escopo, projetos, umProjeto, onSelect, etapa, onEtapa }: {
  dados: GoDados;
  /** Atividades do projeto ou do cliente, sem os filtros de busca. */
  escopo: GoAtividade[];
  projetos: GoProjeto[];
  umProjeto: boolean;
  onSelect: (id: number) => void;
  etapa: number | null;
  onEtapa: (id: number | null) => void;
}) {
  const [escolhido, setEscolhido] = useState<GoStatus | null>(null);
  const s = stats(escopo);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const nivel = nivelDe(s.total ? pct : 0), N = NIVEL[nivel];
  const faltam = s.total - s.done;
  const agora = [
    ...escopo.filter(a => a.status === "andamento").map(a => ({ a, pode: false })),
    ...escopo.filter(a => podeComecar(dados, a)).map(a => ({ a, pode: true })),
  ];
  const contagem: { st: GoStatus; n: number }[] = [
    { st: "concluido", n: s.done }, { st: "andamento", n: s.doing }, { st: "espera", n: s.wait }, { st: "removido", n: s.removed },
  ];
  const destaque = escolhido && contagem.some(c => c.st === escolhido && c.n) ? escolhido : null;
  const comAtividades = projetos.filter(p => escopo.some(a => a.projeto_id === p.id));
  const nEtapas = etapasOf(dados, escopo).length;

  return (
    <section aria-labelledby="go-saude-titulo" className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${N.faixa}`} />
      <div className="flex flex-wrap items-start gap-3 border-b px-5 pb-4 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Gauge className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {umProjeto ? `Projeto · ${nEtapas} ${nEtapas === 1 ? "etapa" : "etapas"}` : `${comAtividades.length} ${comAtividades.length === 1 ? "projeto" : "projetos"} · ${nEtapas} etapas`}
          </p>
          <h2 id="go-saude-titulo" className="text-xl font-bold leading-tight">{umProjeto ? "Saúde do projeto" : "Saúde dos projetos"}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Concluídas sobre o total de atividades. As removidas ficam de fora da conta.</p>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-center">
        <div className="flex flex-col items-center">
          <Velocimetro pct={pct} nivel={nivel} rotulo={`${umProjeto ? "Saúde do projeto" : "Saúde dos projetos"}: ${pct}% das atividades concluídas`} />
          <p className="-mt-3 text-5xl font-bold leading-none tabular-nums">{pct}<span className="text-2xl">%</span></p>
          <p className="mt-1.5 text-sm text-muted-foreground"><b className="text-foreground">{s.done}</b> de <b className="text-foreground">{s.total}</b> atividades concluídas</p>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${N.caixa}`}>
            <N.icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">{nivel === "concluido" ? N.titulo : `${N.titulo}: ${faltam === 1 ? "falta 1 atividade" : `faltam ${faltam} atividades`}`}</p>
              {nivel === "concluido" ? (
                <p className="text-[13px] opacity-90">Todas as atividades estão concluídas.</p>
              ) : agora.length ? (
                <>
                  <p className="text-[13px] opacity-90">Em andamento e prontas para começar:</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {agora.slice(0, 4).map(({ a, pode }) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => onSelect(a.id)}
                          className="group flex w-full items-center gap-2.5 rounded-lg bg-background/80 px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-background">
                          {pode ? <PlayCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Pode começar" />
                            : <Activity className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-label="Em andamento" />}
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{a.codigo}</span>
                          <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{a.titulo}</b>
                            <span className="text-muted-foreground"> · {pode ? "pode começar" : "em andamento"}{!umProjeto ? ` · ${nomeCurto(dados.proj.get(a.projeto_id))}` : ""}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {agora.length > 4 && <p className="mt-1.5 text-[12px] opacity-80">e mais {agora.length - 4} no quadro</p>}
                </>
              ) : (
                <p className="text-[13px] opacity-90">Nada em andamento. As atividades em espera aguardam outras que vêm antes.</p>
              )}
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2" aria-label="Atividades por status: toque para destacar as etapas">
            {contagem.map(({ st, n }) => {
              const Q = QUADRANTE[st], ativo = destaque === st;
              return (
                <li key={st}>
                  <button type="button" aria-pressed={ativo} disabled={!n} onClick={() => setEscolhido(atual => (atual === st ? null : st))}
                    title={ativo ? "Tirar o destaque" : `Destacar as etapas com atividades ${Q.rotulo.toLowerCase()}`}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left transition-[border-color,box-shadow,opacity,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                      ativo ? cn("ring-2", Q.caixa) : "border-border/60 enabled:hover:border-primary/40 enabled:hover:bg-primary/[0.03]",
                      destaque && !ativo && "opacity-55")}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${Q.bolinha}`}><Q.icone className="h-3.5 w-3.5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-lg font-bold leading-none tabular-nums ${Q.cor}`}>{n}</span>
                      <span className="block text-[11.5px] leading-tight text-muted-foreground">{Q.rotulo}</span>
                    </span>
                    {ativo && <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="border-t bg-muted/30 px-5 py-4">
        <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Andamento por etapa · toque numa etapa para filtrar o quadro</p>
          {(destaque || etapa != null) && (
            <button type="button" onClick={() => { setEscolhido(null); onEtapa(null); }}
              className="ml-auto inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2 text-[12px] font-medium hover:bg-muted">
              <X className="h-3.5 w-3.5" />{etapa != null ? "Ver todas as etapas" : "Limpar destaque"}
            </button>
          )}
        </div>
        <div className="divide-y divide-border/70">
          {comAtividades.map(p => (
            <TrilhaEtapas key={p.id} dados={dados} p={p} lista={escopo.filter(a => a.projeto_id === p.id)} mostrarProjeto={!umProjeto}
              etapa={etapa} onEtapa={onEtapa} destaque={destaque} />
          ))}
        </div>
      </div>
    </section>
  );
}
