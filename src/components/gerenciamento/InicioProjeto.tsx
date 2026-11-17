import { AlertTriangle, ArrowRight, CalendarCheck2, CheckCircle2, Layers, Presentation, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SituacaoAtividade } from "@/lib/gerenciamento";
import { periodoDaVisita, resumoVisitas, type SituacaoVisita } from "@/lib/gestaoVisitas";
import { VISIT_FORMAT_LABEL } from "@/lib/implantationScheduling";
import { cn } from "@/lib/utils";
import { LegendaTrilha, NumeroModulo, TrilhaCompacta, contaProjeto } from "./ProgressoProjeto";
import { contaModulo, proximaDe, type ModuloProgresso } from "./progresso";
import { BolinhaVisita, EstadoVisitas, TrilhaVisitas, type ConsultaVisitas } from "./gestao/VisitasDoProjeto";

/** Os três contadores das visitas no quadrante Gestão de cronograma. */
const CONTADORES: { s: SituacaoVisita; chave: "realizadas" | "acontecendo" | "proximas"; rotulo: string; cls: string }[] = [
  { s: "realizada", chave: "realizadas", rotulo: "Realizadas", cls: "border-emerald-500/30 bg-emerald-500/[0.07]" },
  { s: "acontecendo", chave: "acontecendo", rotulo: "Acontecendo agora", cls: "border-marca-laranja/30 bg-orange-500/[0.06]" },
  { s: "proxima", chave: "proximas", rotulo: "Próximas", cls: "border-dashed border-border" },
];

/**
 * Início do projeto (ao escolher o projeto): dois quadrantes. "Módulos de gerenciamento" traz cada
 * módulo com a trilha de bolinhas, atividade por atividade (tocar no nome abre o módulo; na bolinha,
 * a atividade); "Gestão de cronograma" traz o resumo das visitas aprovadas na Agenda Técnica.
 */
export function InicioProjeto({ modulos, atencao, destaque, onAbrirModulos, onAbrirModulo, visitas, onAbrirGestao }: {
  modulos: ModuloProgresso[];
  /** Quantos pontos pedem atenção no projeto (avisos e atividades aguardando retorno). */
  atencao: number;
  /** Situação escolhida nos números do cabeçalho: acende essas bolinhas nas trilhas. */
  destaque: SituacaoAtividade | null;
  /** Abre o progresso do projeto, com todos os módulos. */
  onAbrirModulos: () => void;
  /** Abre o módulo; com a atividade, rola até ela. */
  onAbrirModulo: (numero: string, atividadeId?: string) => void;
  /** As visitas do projeto na Agenda Técnica (Gestão de cronograma). */
  visitas: ConsultaVisitas;
  /** Abre a Gestão de cronograma do projeto. */
  onAbrirGestao: () => void;
}) {
  const { feitas, total, pct } = contaProjeto(modulos);
  const proximo = modulos.map(m => ({ m, x: proximaDe(m) })).find(p => p.x);
  const listaVisitas = visitas.visitas ?? [];
  const resumo = resumoVisitas(listaVisitas);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
      {/* Módulos de gerenciamento */}
      <section aria-labelledby="ger-q-modulos" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <span aria-hidden className="block h-1 bg-gradient-to-r from-marca-laranja via-marca-rosa to-purple-600" />
        <div className="flex flex-wrap items-start gap-4 px-5 pb-4 pt-5 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Layers className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="ger-q-modulos" className="text-xl font-bold leading-tight">Módulos de gerenciamento</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">As rotinas do GP, do cadastro à entrega · {modulos.length} módulos</p>
          </div>
          {/* no celular o anel do cabeçalho, logo acima, já mostra o mesmo número */}
          <div className="hidden shrink-0 text-right leading-none sm:block">
            <b className="font-display text-3xl font-bold tabular-nums">{pct}<span className="text-base">%</span></b>
            <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{feitas} de {total} feitas</span>
          </div>
        </div>

        <ul className="border-t" aria-label="Módulos do projeto">
          {modulos.map(m => {
            const c = contaModulo(m);
            return (
              <li key={m.numero} className="border-b border-border/60 px-5 pb-3.5 pt-3 last:border-b-0 sm:px-6">
                <button type="button" onClick={() => onAbrirModulo(m.numero)} title={`Abrir o módulo ${m.numero}`}
                  className="group flex w-full items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <NumeroModulo numero={m.numero} tamanho="sm" />
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug group-hover:text-primary">{m.nome}</span>
                  {c.completo
                    ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Concluído</span>
                    : <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground"><b className="font-display text-base text-foreground">{c.feitas}</b>/{c.total}</span>}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                </button>
                {/* as bolinhas alinhadas com o nome do módulo */}
                <div className="mt-2.5 pl-10"><TrilhaCompacta m={m} destaque={destaque} onAbrir={onAbrirModulo} /></div>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border/60 px-5 py-2.5 sm:px-6"><LegendaTrilha /></div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-muted/30 px-5 py-3.5 sm:px-6">
          {proximo ? (
            <p className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-orange-500/10 px-2.5 py-1.5 text-[13px] text-orange-800 dark:text-orange-200">
              <Rocket className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0">Próximo passo: <b className="font-semibold">{proximo.x!.a.titulo}</b> · módulo {proximo.m.numero}</span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[13px] font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />Todas as atividades que se aplicam estão feitas
            </p>
          )}
          {atencao > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />{atencao} {atencao === 1 ? "ponto pede" : "pontos pedem"} atenção
            </span>
          )}
          <Button size="sm" className="ml-auto h-9" onClick={onAbrirModulos}>Abrir módulos<ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></Button>
        </div>
      </section>

      {/* Gestão de cronograma: por enquanto, as visitas do projeto na Agenda Técnica */}
      <section aria-labelledby="ger-q-gestao" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <span aria-hidden className="block h-1 bg-gradient-to-r from-emerald-500 via-marca-laranja to-purple-600" />
        <div className="flex flex-wrap items-start gap-4 px-5 pb-4 pt-5 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Presentation className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="ger-q-gestao" className="text-xl font-bold leading-tight">Gestão de cronograma</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">O cronograma do projeto · visitas da Agenda Técnica</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 border-t px-5 py-4 sm:px-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck2 className="h-4 w-4 text-primary" aria-hidden />Visitas do projeto</h3>
          {visitas.carregando || visitas.erro || listaVisitas.length === 0 ? <EstadoVisitas consulta={visitas} compacto /> : (
            <>
              <ul className="grid grid-cols-3 gap-2.5" aria-label="Visitas por situação">
                {CONTADORES.map(c => (
                  <li key={c.s} className={cn("flex min-w-0 flex-col gap-1.5 rounded-xl border p-3", c.cls, resumo[c.chave] === 0 && "opacity-60")}>
                    <span className="flex items-center gap-2"><BolinhaVisita situacao={c.s} tamanho="sm" /><b className="font-display text-2xl font-bold leading-none tabular-nums">{resumo[c.chave]}</b></span>
                    <span className="text-xs leading-tight text-muted-foreground">{c.rotulo}</span>
                  </li>
                ))}
              </ul>
              {/* uma bolinha por visita, como a trilha dos módulos */}
              <TrilhaVisitas lista={listaVisitas} onAbrir={onAbrirGestao} />
              {resumo.proxima ? (
                <div className={cn("rounded-xl border-2 p-3", resumo.proxima.situacao === "acontecendo" ? "border-marca-laranja/60 bg-orange-500/[0.05]" : "border-dashed border-border")}>
                  <p className={cn("text-[11.5px] font-semibold uppercase tracking-wide", resumo.proxima.situacao === "acontecendo" ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground")}>
                    {resumo.proxima.situacao === "acontecendo" ? "Acontecendo agora" : "Próxima visita"}
                  </p>
                  <p className="mt-0.5 text-sm font-bold leading-snug">{resumo.proxima.tipo}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {[periodoDaVisita(resumo.proxima.inicio, resumo.proxima.fim).curto, resumo.proxima.formato && VISIT_FORMAT_LABEL[resumo.proxima.formato],
                      resumo.proxima.tecnicos.map(t => t.full_name).join(", ")].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[13px] font-medium text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />Todas as visitas aprovadas já foram realizadas
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-muted/30 px-5 py-3.5 sm:px-6">
          <span className="text-[12.5px] text-muted-foreground">Só visitas aprovadas pela coordenação de implantação</span>
          <Button size="sm" className="ml-auto h-9" onClick={onAbrirGestao}>Abrir Gestão de cronograma<ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></Button>
        </div>
      </section>
    </div>
  );
}
