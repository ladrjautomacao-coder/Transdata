import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Clock3, FileText, ListChecks, Lock, Minus, PartyPopper, Rocket, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESPONSAVEL_LABEL, type Atividade, type SituacaoAtividade } from "@/lib/gerenciamento";

/** Faixas do medidor: até 40% atenção, até 70% em andamento, depois quase lá; 100% concluído. */
type Nivel = "atencao" | "andamento" | "quase" | "concluido";
const nivelDe = (pct: number): Nivel => (pct >= 100 ? "concluido" : pct >= 70 ? "quase" : pct >= 40 ? "andamento" : "atencao");
const NIVEL: Record<Nivel, { titulo: string; arco: string; faixa: string; caixa: string; icone: typeof AlertTriangle }> = {
  atencao: { titulo: "Atenção", arco: "stroke-red-500", faixa: "bg-red-500", caixa: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200", icone: AlertTriangle },
  andamento: { titulo: "Em andamento", arco: "stroke-amber-500", faixa: "bg-amber-500", caixa: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100", icone: TrendingUp },
  quase: { titulo: "Quase lá", arco: "stroke-emerald-500", faixa: "bg-emerald-500", caixa: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", icone: TrendingUp },
  concluido: { titulo: "Módulo concluído", arco: "stroke-emerald-500", faixa: "bg-emerald-500", caixa: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", icone: PartyPopper },
};

/** Como cada atividade aparece na trilha e na contagem. */
const SIT: Record<SituacaoAtividade, { rotulo: string; bolinha: string; icone: typeof Check; cor: string }> = {
  feito: { rotulo: "Feitas", bolinha: "bg-emerald-600 text-white", icone: Check, cor: "text-emerald-700 dark:text-emerald-300" },
  afazer: { rotulo: "A fazer agora", bolinha: "bg-primary text-primary-foreground", icone: ArrowRight, cor: "text-primary" },
  aguardando: { rotulo: "Aguardando retorno", bolinha: "bg-amber-500 text-white", icone: Clock3, cor: "text-amber-700 dark:text-amber-300" },
  bloqueado: { rotulo: "Esperando o checklist", bolinha: "bg-muted text-muted-foreground ring-1 ring-border", icone: Lock, cor: "text-muted-foreground" },
  naoaplica: { rotulo: "Não se aplicam", bolinha: "border border-dashed border-border bg-background text-muted-foreground", icone: Minus, cor: "text-muted-foreground" },
};

// Medidor em meio círculo: 0% à esquerda, 100% à direita
const CX = 130, CY = 128, R = 100;
const ponto = (pct: number, r = R) => {
  const a = Math.PI * (1 - pct / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};
const arco = (de: number, ate: number) => {
  const [x0, y0] = ponto(de), [x1, y1] = ponto(ate);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};

function Velocimetro({ pct, nivel }: { pct: number; nivel: Nivel }) {
  // o ponteiro sobe do zero ao abrir (sem animação para quem prefere menos movimento)
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setMostrado(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  const angulo = -90 + (mostrado / 100) * 180;
  return (
    <svg viewBox="0 0 260 150" className="w-full max-w-[320px]" role="img" aria-label={`Medidor do módulo: ${pct}% concluído`}>
      {/* faixas de fundo: atenção, em andamento, quase lá */}
      <path d={arco(0, 40)} className="fill-none stroke-red-500/20" strokeWidth={22} />
      <path d={arco(40, 70)} className="fill-none stroke-amber-500/25" strokeWidth={22} />
      <path d={arco(70, 100)} className="fill-none stroke-emerald-500/25" strokeWidth={22} />
      {pct > 0 && <path d={arco(0, pct)} className={`fill-none ${NIVEL[nivel].arco}`} strokeWidth={22} strokeLinecap="round" />}
      {[0, 25, 50, 75, 100].map(t => {
        const [x0, y0] = ponto(t, R - 17), [x1, y1] = ponto(t, R - 11);
        return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} className="stroke-muted-foreground/50" strokeWidth={1.5} />;
      })}
      <text x={CX - R} y={CY + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">0</text>
      <text x={CX + R} y={CY + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">100</text>
      <g style={{ transform: `rotate(${angulo}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 900ms cubic-bezier(.2,.8,.2,1)" }} className="motion-reduce:!transition-none">
        <path d={`M${CX - 4},${CY} L${CX},${CY - R + 26} L${CX + 4},${CY} Z`} className="fill-foreground" />
      </g>
      <circle cx={CX} cy={CY} r={9} className="fill-foreground" />
      <circle cx={CX} cy={CY} r={3.5} className="fill-background" />
    </svg>
  );
}

/**
 * Visão geral de um módulo ao abrir o projeto: medidor de 0 a 100%, o que falta e a trilha das
 * atividades. A lista completa só abre quando o GP pede ("Abrir atividades" ou uma bolinha).
 */
export function MedidorModulo({ numero, nome, resumo, atividades, onAbrir, documento, onGerarDocumento, rotuloBloqueado, destaque }: {
  numero: string;
  nome: string;
  resumo: string;
  /** Atividades na ordem atual, com a situação de cada uma. */
  atividades: { a: Atividade<string>; sit: SituacaoAtividade }[];
  /** Como contar as atividades bloqueadas (o padrão é o módulo 01, que espera o checklist). */
  rotuloBloqueado?: string;
  /** Data ou aviso do módulo, embaixo do nome (ex.: a reunião de PE no módulo 02). */
  destaque?: ReactNode;
  /** Abre a lista; com id, rola até a atividade. */
  onAbrir: (atividadeId?: string) => void;
  /** Documento que o módulo gera ao chegar a 100% (ex.: o TAP no módulo 01). */
  documento?: { botao: string; bloqueado: string; concluido: string };
  onGerarDocumento?: () => void;
}) {
  const aplicaveis = atividades.filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  const total = aplicaveis.length;
  const pct = total ? Math.round((feitas / total) * 100) : 100;
  const nivel = nivelDe(pct);
  const N = NIVEL[nivel];
  const faltam = total - feitas;
  const proxima = aplicaveis.find(x => x.sit !== "feito");
  const contagem = (Object.keys(SIT) as SituacaoAtividade[])
    .map(s => ({ s, n: atividades.filter(x => x.sit === s).length }))
    .filter(x => x.n > 0 || x.s === "feito");
  const rotulo = (s: SituacaoAtividade) => (s === "bloqueado" && rotuloBloqueado ? rotuloBloqueado : SIT[s].rotulo);

  return (
    <section aria-labelledby="ger-medidor-titulo" className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${N.faixa}`} />
      <div className="flex flex-wrap items-start gap-3 border-b px-5 pb-4 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">{numero}</span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Módulo {numero}</p>
          <h2 id="ger-medidor-titulo" className="text-xl font-bold leading-tight">{nome}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{resumo}</p>
          {destaque && <div className="mt-2">{destaque}</div>}
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-center">
        {/* Medidor */}
        <div className="flex flex-col items-center">
          <Velocimetro pct={pct} nivel={nivel} />
          <p className="-mt-3 text-5xl font-bold leading-none tabular-nums">{pct}<span className="text-2xl">%</span></p>
          <p className="mt-1.5 text-sm text-muted-foreground"><b className="text-foreground">{feitas}</b> de <b className="text-foreground">{total}</b> atividades feitas</p>
        </div>

        {/* O que falta */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${N.caixa}`}>
            <N.icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-base font-bold">{nivel === "concluido" ? N.titulo : `${N.titulo}: ${faltam === 1 ? "falta 1 atividade" : `faltam ${faltam} atividades`}`}</p>
              <p className="text-[13px] opacity-90">
                {nivel === "concluido"
                  ? `Todas as atividades que se aplicam a este projeto estão feitas.${documento ? ` ${documento.concluido}` : ""}`
                  : proxima ? <>Próximo passo: <b>{proxima.a.titulo}</b> ({RESPONSAVEL_LABEL[proxima.a.responsavel]}).</> : null}
              </p>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {contagem.map(({ s, n }) => {
              const S = SIT[s];
              return (
                <li key={s} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${S.bolinha}`}><S.icone className="h-3.5 w-3.5" aria-hidden /></span>
                  <span className="min-w-0">
                    <span className={`block text-lg font-bold leading-none tabular-nums ${S.cor}`}>{n}</span>
                    <span className="block text-[11.5px] leading-tight text-muted-foreground">{rotulo(s)}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            {nivel === "concluido" && onGerarDocumento && (
              <Button className="h-10 bg-emerald-600 text-white hover:bg-emerald-500" onClick={onGerarDocumento}>
                <FileText className="mr-1.5 h-4 w-4" />{documento?.botao}
              </Button>
            )}
            <Button className="h-10" variant={nivel === "concluido" ? "outline" : "default"} onClick={() => onAbrir(proxima?.a.id)}>
              <ListChecks className="mr-1.5 h-4 w-4" />{nivel === "concluido" ? "Ver as atividades" : "Abrir atividades do módulo"}
            </Button>
            {proxima && nivel !== "concluido" && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Rocket className="h-3.5 w-3.5" />abre no próximo passo</span>
            )}
          </div>
          {nivel !== "concluido" && documento && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />{documento.bloqueado}
            </p>
          )}
        </div>
      </div>

      {/* Trilha: cada bolinha é uma atividade, na ordem do módulo */}
      <div className="border-t bg-muted/30 px-5 py-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Trilha do módulo · toque numa etapa para abrir</p>
        <ol className="flex items-start overflow-x-auto pb-1">
          {atividades.map(({ a, sit }, i) => {
            const S = SIT[sit];
            const ehProxima = a.id === proxima?.a.id && nivel !== "concluido";
            return (
              <li key={a.id} className="flex min-w-[76px] flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <span aria-hidden className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : atividades[i - 1].sit === "feito" ? "bg-emerald-500" : "bg-border"}`} />
                  <button type="button" onClick={() => onAbrir(a.id)} title={`${a.titulo}: ${rotulo(sit).toLowerCase()}`}
                    aria-label={`${i + 1}. ${a.titulo}: ${rotulo(sit)}`}
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${S.bolinha} ${ehProxima ? "ring-4 ring-primary/25" : ""}`}>
                    {sit === "feito" ? <CheckCircle2 className="h-4 w-4" /> : sit === "bloqueado" ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  <span aria-hidden className={`h-0.5 flex-1 ${i === atividades.length - 1 ? "opacity-0" : sit === "feito" ? "bg-emerald-500" : "bg-border"}`} />
                </div>
                <span className={`mt-1.5 line-clamp-2 px-1 text-center text-[11px] leading-tight ${ehProxima ? "font-semibold text-primary" : sit === "naoaplica" ? "text-muted-foreground/70 line-through" : "text-muted-foreground"}`}>{a.titulo}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
