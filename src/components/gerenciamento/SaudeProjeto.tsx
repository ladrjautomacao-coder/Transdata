import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, CheckCircle2, Clock3, Gauge, Lock, Minus, X } from "lucide-react";
import { Velocimetro } from "@/components/Velocimetro";
import { RESPONSAVEL_LABEL, type Atividade, type SituacaoAtividade } from "@/lib/gerenciamento";
import { NIVEL, nivelDe } from "@/lib/nivelMedidor";
import { cn } from "@/lib/utils";

/**
 * Como cada atividade aparece na trilha e na contagem. `anel` e `caixa`: o destaque quando o
 * quadrante da situação é clicado (a bolinha na trilha e o próprio quadrante).
 */
const SIT: Record<SituacaoAtividade, { rotulo: string; bolinha: string; icone: typeof Check; cor: string; anel: string; caixa: string }> = {
  feito: { rotulo: "Feitas", bolinha: "bg-emerald-600 text-white", icone: Check, cor: "text-emerald-700 dark:text-emerald-300",
    anel: "ring-emerald-500/45", caixa: "border-emerald-500 bg-emerald-500/10 ring-emerald-500/30" },
  afazer: { rotulo: "A fazer agora", bolinha: "bg-primary text-primary-foreground", icone: ArrowRight, cor: "text-primary",
    anel: "ring-primary/40", caixa: "border-primary bg-primary/[0.08] ring-primary/25" },
  aguardando: { rotulo: "Aguardando retorno", bolinha: "bg-amber-500 text-white", icone: Clock3, cor: "text-amber-700 dark:text-amber-300",
    anel: "ring-amber-500/45", caixa: "border-amber-500 bg-amber-500/10 ring-amber-500/30" },
  bloqueado: { rotulo: "Esperando outra etapa", bolinha: "bg-muted text-muted-foreground ring-1 ring-border", icone: Lock, cor: "text-muted-foreground",
    anel: "ring-muted-foreground/45", caixa: "border-muted-foreground/60 bg-muted ring-muted-foreground/25" },
  naoaplica: { rotulo: "Não se aplicam", bolinha: "border border-dashed border-border bg-background text-muted-foreground", icone: Minus, cor: "text-muted-foreground",
    anel: "ring-muted-foreground/45", caixa: "border-muted-foreground/60 bg-muted ring-muted-foreground/25" },
};

/** Um módulo na saúde do projeto, com as atividades na ordem atual e a situação de cada uma. */
export interface ModuloSaude {
  numero: string;
  nome: string;
  atividades: { a: Atividade<string>; sit: SituacaoAtividade }[];
  /** Como chamar as atividades bloqueadas deste módulo (o padrão é "Esperando outra etapa"). */
  rotuloBloqueado?: string;
  /** Ao lado do andamento do módulo (ex.: o documento TAP no 01, a reunião de PE no 02). */
  extra?: ReactNode;
}

/** Feitas e aplicáveis de todos os módulos juntos: as que não se aplicam ficam fora da conta. */
function conta(modulos: ModuloSaude[]) {
  const aplicaveis = modulos.flatMap(m => m.atividades).filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  const total = aplicaveis.length;
  const pct = total ? Math.round((feitas / total) * 100) : 100;
  return { feitas, total, pct, nivel: nivelDe(pct) };
}
/** A próxima atividade do módulo: a primeira que se aplica e ainda não está feita. */
const proximaDe = (m: ModuloSaude) => m.atividades.find(x => x.sit !== "naoaplica" && x.sit !== "feito");

const cartao = (ativo: boolean) => `flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${ativo
  ? "border-primary bg-primary/[0.06] ring-1 ring-primary hover:bg-primary/[0.1]"
  : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03]"}`;

/** A saúde do projeto na lista ao lado dos módulos: o percentual de tudo e a volta ao medidor. */
export function CartaoSaude({ modulos, ativo, onClick }: { modulos: ModuloSaude[]; ativo: boolean; onClick: () => void }) {
  const { feitas, total, pct, nivel } = conta(modulos);
  return (
    <button type="button" aria-current={ativo ? "page" : undefined} onClick={onClick} title="Ver a saúde do projeto" className={cartao(ativo)}>
      <span className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}><Gauge className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-semibold">Saúde do projeto</span>
          <span className="block text-[11.5px] text-muted-foreground">{feitas} de {total} atividades feitas</span>
        </span>
        <span className="text-lg font-bold tabular-nums">{pct}<span className="text-xs">%</span></span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full transition-[width] duration-500 ${NIVEL[nivel].faixa}`} style={{ width: `${pct}%` }} />
      </span>
    </button>
  );
}

/** Um módulo na lista ao lado, com o andamento: abre as atividades do módulo. */
export function CartaoModulo({ m, ativo, onClick }: { m: ModuloSaude; ativo: boolean; onClick: () => void }) {
  const aplicaveis = m.atividades.filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  const total = aplicaveis.length;
  const completo = total > 0 && feitas === total;
  return (
    <button type="button" aria-current={ativo ? "page" : undefined} onClick={onClick}
      title={ativo ? "Voltar ao início do módulo" : `Abrir as atividades do módulo ${m.numero}`} className={cartao(ativo)}>
      <span className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{m.numero}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{m.nome}</span>
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

/**
 * Andamento de um módulo e a trilha das atividades: cada bolinha abre a atividade. Com `destaque`,
 * as bolinhas daquela situação acendem e as outras apagam.
 */
function TrilhaModulo({ m, destaque, onAbrir }: {
  m: ModuloSaude; destaque: SituacaoAtividade | null; onAbrir: (numero: string, atividadeId?: string) => void;
}) {
  const aplicaveis = m.atividades.filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  const total = aplicaveis.length;
  const completo = total > 0 && feitas === total;
  const proxima = proximaDe(m);
  const rotulo = (s: SituacaoAtividade) => (s === "bloqueado" && m.rotuloBloqueado ? m.rotuloBloqueado : SIT[s].rotulo);
  const acesas = destaque ? m.atividades.filter(x => x.sit === destaque).length : 0;
  // trilha mais larga que a tela (celular): rola até a primeira bolinha acesa
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = lista.current;
    const alvo = ol?.querySelector<HTMLElement>('[data-acesa="true"]');
    if (!ol || !alvo || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollTo({ left: ol.scrollLeft + alvo.getBoundingClientRect().left - ol.getBoundingClientRect().left - 24, behavior: "smooth" });
  }, [destaque]);
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 last:pb-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" onClick={() => onAbrir(m.numero)} title={`Abrir as atividades do módulo ${m.numero}`} className="group flex min-w-0 items-center gap-2 text-left">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{m.numero}</span>
          <span className="text-sm font-semibold group-hover:text-primary group-hover:underline">{m.nome}</span>
        </button>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-primary/15">
            <span className={`block h-full rounded-full ${completo ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
          </span>
          {completo
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Concluído</span>
            : <span className="text-xs font-semibold tabular-nums text-primary">{feitas}/{total}</span>}
        </span>
        {destaque && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", acesas ? cn(SIT[destaque].cor, "bg-muted") : "text-muted-foreground")}>
            {acesas ? `${acesas} em destaque` : "nenhuma aqui"}
          </span>
        )}
        {m.extra && <div className="ml-auto">{m.extra}</div>}
      </div>
      <ol ref={lista} className="-my-1.5 flex items-start overflow-x-auto py-2.5">
        {m.atividades.map(({ a, sit }, i) => {
          const S = SIT[sit];
          const acesa = destaque === sit;
          const apagada = !!destaque && !acesa;
          const ehProxima = !destaque && a.id === proxima?.a.id;
          return (
            <li key={a.id} className="flex min-w-[76px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span aria-hidden className={cn("h-0.5 flex-1 transition-opacity", i === 0 ? "opacity-0" : m.atividades[i - 1].sit === "feito" ? "bg-emerald-500" : "bg-border", destaque && i > 0 && "opacity-30")} />
                <button type="button" onClick={() => onAbrir(m.numero, a.id)} title={`${a.titulo}: ${rotulo(sit).toLowerCase()}`}
                  aria-label={`Módulo ${m.numero}, ${i + 1}. ${a.titulo}: ${rotulo(sit)}`} data-acesa={acesa || undefined}
                  className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-[transform,opacity,box-shadow] duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    S.bolinha, ehProxima && "ring-4 ring-primary/25", acesa && cn("z-10 scale-[1.18] shadow-lg ring-[6px] hover:scale-[1.25]", S.anel), apagada && "opacity-25 grayscale")}>
                  {sit === "feito" ? <CheckCircle2 className="h-4 w-4" /> : sit === "bloqueado" ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                </button>
                <span aria-hidden className={cn("h-0.5 flex-1 transition-opacity", i === m.atividades.length - 1 ? "opacity-0" : sit === "feito" ? "bg-emerald-500" : "bg-border", destaque && i < m.atividades.length - 1 && "opacity-30")} />
              </div>
              <span className={cn("mt-2 line-clamp-2 px-1 text-center text-[11px] leading-tight transition-opacity",
                acesa ? "font-semibold text-foreground" : ehProxima ? "font-semibold text-primary" : sit === "naoaplica" ? "text-muted-foreground/70 line-through" : "text-muted-foreground",
                apagada && "opacity-40")}>{a.titulo}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Saúde do projeto ao abrir: um medidor só, com as atividades de todos os módulos, os próximos
 * passos de cada módulo e as trilhas. As atividades de um módulo abrem pela lista ao lado ou numa etapa.
 */
export function SaudeProjeto({ modulos, onAbrir }: {
  modulos: ModuloSaude[];
  /** Abre as atividades do módulo; com id, rola até a atividade. */
  onAbrir: (numero: string, atividadeId?: string) => void;
}) {
  const { feitas, total, pct, nivel } = conta(modulos);
  const N = NIVEL[nivel];
  const faltam = total - feitas;
  const proximos = modulos.map(m => ({ m, x: proximaDe(m) })).filter(p => p.x);
  const todas = modulos.flatMap(m => m.atividades);
  const contagem = (Object.keys(SIT) as SituacaoAtividade[])
    .map(s => ({ s, n: todas.filter(x => x.sit === s).length }))
    .filter(x => x.n > 0 || x.s === "feito");
  // quadrante clicado: acende nas trilhas as atividades daquela situação (some se o quadrante sumir)
  const [escolhido, setEscolhido] = useState<SituacaoAtividade | null>(null);
  const destaque = escolhido && contagem.some(c => c.s === escolhido) ? escolhido : null;
  const trilhas = useRef<HTMLDivElement>(null);
  const destacar = (s: SituacaoAtividade) => {
    setEscolhido(atual => (atual === s ? null : s));
    // no celular as trilhas ficam abaixo: rola até elas
    if (destaque !== s) setTimeout(() => trilhas.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  return (
    <section aria-labelledby="ger-saude-titulo" className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${N.faixa}`} />
      <div className="flex flex-wrap items-start gap-3 border-b px-5 pb-4 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Gauge className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Projeto · {modulos.length} módulos</p>
          <h2 id="ger-saude-titulo" className="text-xl font-bold leading-tight">Saúde do projeto</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Todas as atividades de todos os módulos numa conta só. As que não se aplicam a este projeto ficam de fora.</p>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-center">
        {/* Medidor */}
        <div className="flex flex-col items-center">
          <Velocimetro pct={pct} nivel={nivel} rotulo={`Saúde do projeto: ${pct}% das atividades feitas`} />
          <p className="-mt-3 text-5xl font-bold leading-none tabular-nums">{pct}<span className="text-2xl">%</span></p>
          <p className="mt-1.5 text-sm text-muted-foreground"><b className="text-foreground">{feitas}</b> de <b className="text-foreground">{total}</b> atividades feitas</p>
        </div>

        {/* O que falta: o próximo passo de cada módulo */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${N.caixa}`}>
            <N.icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">{nivel === "concluido" ? N.titulo : `${N.titulo}: ${faltam === 1 ? "falta 1 atividade" : `faltam ${faltam} atividades`}`}</p>
              {nivel === "concluido" ? (
                <p className="text-[13px] opacity-90">Todas as atividades que se aplicam a este projeto estão feitas.</p>
              ) : (
                <>
                  <p className="text-[13px] opacity-90">{proximos.length === 1 ? "Próximo passo:" : "Próximo passo de cada módulo:"}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {proximos.map(({ m, x }) => (
                      <li key={m.numero}>
                        <button type="button" onClick={() => onAbrir(m.numero, x!.a.id)}
                          className="group flex w-full items-center gap-2.5 rounded-lg bg-background/80 px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-background">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{m.numero}</span>
                          <span className="min-w-0 flex-1"><b className="font-semibold">{x!.a.titulo}</b> <span className="text-muted-foreground">· {RESPONSAVEL_LABEL[x!.a.responsavel]}</span></span>
                          <span className="hidden text-[12px] font-medium text-primary sm:inline">Abrir</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Atividades por situação: toque para destacar nas trilhas">
            {contagem.map(({ s, n }) => {
              const S = SIT[s];
              const ativo = destaque === s;
              return (
                <li key={s}>
                  <button type="button" aria-pressed={ativo} onClick={() => destacar(s)} disabled={n === 0}
                    title={ativo ? "Tirar o destaque" : `Destacar nas trilhas: ${S.rotulo.toLowerCase()}`}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left transition-[border-color,box-shadow,opacity,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                      ativo ? cn("ring-2", S.caixa) : "border-border/60 enabled:hover:border-primary/40 enabled:hover:bg-primary/[0.03]",
                      destaque && !ativo && "opacity-55")}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${S.bolinha}`}><S.icone className="h-3.5 w-3.5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-lg font-bold leading-none tabular-nums ${S.cor}`}>{n}</span>
                      <span className="block text-[11.5px] leading-tight text-muted-foreground">{S.rotulo}</span>
                    </span>
                    {ativo && <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Cada módulo: andamento e a trilha das atividades */}
      <div ref={trilhas} className="scroll-mt-4 border-t bg-muted/30 px-5 py-4">
        <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Andamento por módulo · toque numa etapa para abrir</p>
          {destaque && (
            <p className="ml-auto inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" aria-live="polite">
              <span className="whitespace-nowrap">
                <span className="text-muted-foreground">Em destaque: </span>
                <b className={cn("font-semibold", SIT[destaque].cor)}>{SIT[destaque].rotulo} ({contagem.find(c => c.s === destaque)?.n})</b>
              </span>
              <button type="button" onClick={() => setEscolhido(null)}
                className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2 text-[12px] font-medium hover:bg-muted">
                <X className="h-3.5 w-3.5" />Limpar destaque
              </button>
            </p>
          )}
        </div>
        <div className="divide-y divide-border/70">
          {modulos.map(m => <TrilhaModulo key={m.numero} m={m} destaque={destaque} onAbrir={onAbrir} />)}
        </div>
      </div>
    </section>
  );
}
