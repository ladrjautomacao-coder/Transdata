import { AlertTriangle, ArrowRight, CheckCircle2, Construction, Layers, Presentation, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SituacaoAtividade } from "@/lib/gerenciamento";
import { LegendaTrilha, NumeroModulo, TrilhaCompacta, contaProjeto } from "./ProgressoProjeto";
import { contaModulo, proximaDe, type ModuloProgresso } from "./progresso";

/** Alturas das barras do painel em construção (só a silhueta). */
const BARRAS = [38, 62, 48, 80, 56, 70, 44];

/**
 * Início do projeto (ao escolher o projeto): dois quadrantes. "Módulos de gerenciamento" traz cada
 * módulo com a trilha de bolinhas, atividade por atividade (tocar no nome abre o módulo; na bolinha,
 * a atividade); "Gestão à Vista" está em construção.
 */
export function InicioProjeto({ modulos, atencao, destaque, onAbrirModulos, onAbrirModulo }: {
  modulos: ModuloProgresso[];
  /** Quantos pontos pedem atenção no projeto (avisos e atividades aguardando retorno). */
  atencao: number;
  /** Situação escolhida nos números do cabeçalho: acende essas bolinhas nas trilhas. */
  destaque: SituacaoAtividade | null;
  /** Abre o progresso do projeto, com todos os módulos. */
  onAbrirModulos: () => void;
  /** Abre o módulo; com a atividade, rola até ela. */
  onAbrirModulo: (numero: string, atividadeId?: string) => void;
}) {
  const { feitas, total, pct } = contaProjeto(modulos);
  const proximo = modulos.map(m => ({ m, x: proximaDe(m) })).find(p => p.x);

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

      {/* Gestão à Vista: o quadrante existe; o conteúdo vem na próxima etapa */}
      <section aria-labelledby="ger-q-gestao" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-dashed border-border bg-card/60">
        <span aria-hidden className="block h-1 bg-border" />
        <div className="flex flex-wrap items-start gap-4 px-5 pb-4 pt-5 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Presentation className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="ger-q-gestao" className="text-xl font-bold leading-tight">Gestão à Vista</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">O conteúdo deste quadrante será montado na próxima etapa.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <Construction className="h-3.5 w-3.5" aria-hidden />Em construção
          </span>
        </div>

        {/* silhueta de um painel, só para marcar o espaço */}
        <div aria-hidden className="mx-5 mb-5 grid flex-1 grid-cols-3 content-start gap-2.5 rounded-xl border border-dashed border-border/80 p-3 sm:mx-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex h-16 flex-col justify-center gap-2 rounded-lg bg-muted/60 px-3">
              <span className="h-2 w-1/2 rounded-full bg-muted-foreground/15" />
              <span className="h-3.5 w-3/4 rounded-full bg-muted-foreground/20" />
            </div>
          ))}
          <div className="col-span-2 flex h-32 items-end gap-2 rounded-lg bg-muted/40 p-3">
            {BARRAS.map((h, i) => <span key={i} className="flex-1 rounded-t bg-muted-foreground/15" style={{ height: `${h}%` }} />)}
          </div>
          <div className="flex h-32 items-center justify-center rounded-lg bg-muted/40">
            <span className="h-16 w-16 rounded-full border-[10px] border-muted-foreground/15 border-t-muted-foreground/30" />
          </div>
        </div>
      </section>
    </div>
  );
}
