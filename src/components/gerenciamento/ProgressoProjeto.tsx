import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Flag, Gauge, Layers, Lock, MapPin, Minus, UserRound, X, type LucideIcon } from "lucide-react";
import { RESPONSAVEL_LABEL, type Atividade, type Responsavel, type SituacaoAtividade } from "@/lib/gerenciamento";
import { cn } from "@/lib/utils";

/**
 * Como cada situação aparece: a bolinha na trilha, o ponto no número do cabeçalho e o anel quando
 * o número é tocado (destaque). A próxima atividade de cada módulo ganha o laranja do logo (PROXIMA).
 */
const SIT: Record<SituacaoAtividade, { rotulo: string; bolinha: string; ponto: string; icone: LucideIcon; anel: string }> = {
  feito: { rotulo: "Feitas", bolinha: "bg-primary text-primary-foreground", ponto: "bg-purple-300", icone: Check, anel: "ring-primary/40" },
  afazer: { rotulo: "A fazer agora", bolinha: "border-2 border-primary/25 bg-card text-primary", ponto: "bg-orange-400", icone: ArrowRight, anel: "ring-marca-laranja/45" },
  aguardando: { rotulo: "Aguardando retorno", bolinha: "bg-amber-500 text-white", ponto: "bg-amber-300", icone: Clock3, anel: "ring-amber-500/45" },
  bloqueado: { rotulo: "Esperando outra etapa", bolinha: "border-2 border-dashed border-border bg-muted text-muted-foreground", ponto: "bg-white/45", icone: Lock, anel: "ring-muted-foreground/40" },
  naoaplica: { rotulo: "Não se aplicam", bolinha: "border border-dashed border-border bg-background text-muted-foreground", ponto: "bg-white/25", icone: Minus, anel: "ring-muted-foreground/40" },
};
const PROXIMA = "bg-gradient-to-br from-marca-laranja to-marca-rosa text-white shadow-[0_0_0_5px_hsl(var(--marca-laranja)/0.18)]";

/** Um módulo no progresso do projeto, com as atividades na ordem atual e a situação de cada uma. */
export interface ModuloProgresso {
  numero: string;
  nome: string;
  atividades: { a: Atividade<string>; sit: SituacaoAtividade }[];
  /** Como chamar as atividades bloqueadas deste módulo (o padrão é "Esperando outra etapa"). */
  rotuloBloqueado?: string;
  /** No rodapé do módulo (ex.: o documento TAP no 01, a reunião de PE no 02). */
  extra?: ReactNode;
}

/** Um ponto de atenção do projeto, na coluna ao lado dos módulos. */
export interface AvisoProjeto {
  icone: LucideIcon;
  titulo: string;
  texto: string;
  /** "ambar" pede ação; "neutro" só informa. */
  tom: "ambar" | "neutro";
  /** Tocar no aviso abre este módulo (e a atividade, se houver). */
  modulo?: string;
  atividade?: string;
}

/** Feitas e aplicáveis de todos os módulos juntos: as que não se aplicam ficam fora da conta. */
export function contaProjeto(modulos: ModuloProgresso[]) {
  const aplicaveis = modulos.flatMap(m => m.atividades).filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  const total = aplicaveis.length;
  return { feitas, total, pct: total ? Math.round((feitas / total) * 100) : 100 };
}
/** Feitas e aplicáveis de um módulo. */
function contaModulo(m: ModuloProgresso) {
  const aplicaveis = m.atividades.filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  return { feitas, total: aplicaveis.length, completo: aplicaveis.length > 0 && feitas === aplicaveis.length };
}
/** A próxima atividade do módulo: a primeira que se aplica e ainda não está feita. */
const proximaDe = (m: ModuloProgresso) => m.atividades.find(x => x.sit !== "naoaplica" && x.sit !== "feito");
/** Quantas atividades há em cada situação (Feitas sempre aparece). */
function contagemDe(modulos: ModuloProgresso[]) {
  const todas = modulos.flatMap(m => m.atividades);
  return (Object.keys(SIT) as SituacaoAtividade[])
    .map(s => ({ s, n: todas.filter(x => x.sit === s).length }))
    .filter(x => x.n > 0 || x.s === "feito");
}
/** O destaque só vale enquanto houver atividades naquela situação. */
export const destaqueValido = (modulos: ModuloProgresso[], s: SituacaoAtividade | null) =>
  s && contagemDe(modulos).some(c => c.s === s && c.n > 0) ? s : null;

/** Número do módulo num quadrado roxo da marca. */
export function NumeroModulo({ numero, tamanho = "md" }: { numero: string; tamanho?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn(
      "flex shrink-0 items-center justify-center bg-gradient-to-br from-purple-700 to-marca-logo font-display font-bold text-white",
      tamanho === "sm" ? "h-7 w-7 rounded-lg text-sm" : tamanho === "lg" ? "h-12 w-12 rounded-xl text-2xl" : "h-9 w-9 rounded-[10px] text-[17px]",
    )}>{numero}</span>
  );
}

/** Anel do progresso do projeto, no degradê do "T" do logo. */
function AnelProjeto({ pct, feitas, total }: { pct: number; feitas: number; total: number }) {
  const id = useId();
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative h-[124px] w-[124px] shrink-0" role="img" aria-label={`Progresso do projeto: ${pct}%, ${feitas} de ${total} atividades feitas`}>
      <svg viewBox="0 0 124 124" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="hsl(var(--marca-laranja))" />
            <stop offset="0.6" stopColor="hsl(var(--marca-rosa))" />
            <stop offset="1" stopColor="#b14ad8" />
          </linearGradient>
        </defs>
        <circle cx="62" cy="62" r={r} fill="none" strokeWidth="10" className="stroke-white/15" />
        <circle cx="62" cy="62" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke={`url(#${id})`}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-[40px] font-bold tabular-nums">{pct}<span className="text-xl">%</span></span>
        <span className="mt-1 text-xs tabular-nums text-white/70">{feitas} de {total}</span>
      </span>
    </div>
  );
}

/**
 * Cabeçalho do projeto: a cidade ao fundo (imagem da entrada) sob um véu roxo, o nome, a fase,
 * as soluções, o anel do progresso e quantas atividades há em cada situação (tocar destaca nas trilhas).
 */
export function CabecalhoProjeto({ nome, fase, local, gp, codigo, solucoes, imagem, modulos, destaque, onDestacar, onBack }: {
  nome: string; fase: string; local: string; gp: string; codigo?: string | null; solucoes: string[]; imagem: string;
  modulos: ModuloProgresso[]; destaque: SituacaoAtividade | null; onDestacar: (s: SituacaoAtividade) => void; onBack: () => void;
}) {
  const { feitas, total, pct } = contaProjeto(modulos);
  const contagem = contagemDe(modulos);
  return (
    <section aria-labelledby="ger-projeto-nome" className="relative isolate overflow-hidden rounded-2xl text-white shadow-[0_12px_32px_-18px_hsl(var(--marca-fundo)/0.7)]">
      <img src={imagem} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_62%]" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-marca-fundo/[0.97] via-marca-logo/90 to-marca-logo/45" />
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
              <ArrowLeft className="h-3.5 w-3.5" />Trocar projeto
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-marca-laranja to-marca-rosa px-2.5 py-0.5 text-xs font-semibold">
              <Flag className="h-3.5 w-3.5" aria-hidden />{fase}
            </span>
          </div>
          <h1 id="ger-projeto-nome" className="mt-3 break-words text-[28px] font-bold uppercase leading-[1.05] tracking-[0.01em] sm:text-4xl">{nome}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/80">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-orange-300" aria-hidden />{local}</span>
            <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-orange-300" aria-hidden />GP {gp}</span>
            <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-orange-300" aria-hidden />{modulos.length} módulos</span>
          </div>
          {(solucoes.length > 0 || codigo) && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {solucoes.map(s => <span key={s} className="rounded-md border border-white/20 bg-white/[0.12] px-2.5 py-0.5 text-xs font-medium">{s}</span>)}
              {codigo && <span className="break-all font-mono text-[11px] text-white/55">{codigo}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-5 sm:flex-nowrap">
          <AnelProjeto pct={pct} feitas={feitas} total={total} />
          <ul className="grid min-w-[210px] flex-1 gap-2" aria-label="Atividades por situação: toque para destacar nas trilhas">
            {contagem.map(({ s, n }) => {
              const ativo = destaque === s;
              return (
                <li key={s}>
                  <button type="button" aria-pressed={ativo} disabled={n === 0} onClick={() => onDestacar(s)}
                    title={ativo ? "Tirar o destaque" : `Destacar nas trilhas: ${SIT[s].rotulo.toLowerCase()}`}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default",
                      ativo ? "border-white/50 bg-white/25" : "border-white/15 bg-white/10 enabled:hover:bg-white/[0.16]")}>
                    <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", SIT[s].ponto)} />
                    <b className="min-w-[24px] font-display text-[22px] font-bold leading-none tabular-nums">{n}</b>
                    <span className="flex-1 text-xs text-white/85">{SIT[s].rotulo}</span>
                    {ativo && <X className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Abas do projeto: o progresso e cada módulo, com o andamento. */
export function NavModulos({ modulos, ativo, onIr }: { modulos: ModuloProgresso[]; ativo: string | null; onIr: (numero: string | null) => void }) {
  const { pct } = contaProjeto(modulos);
  const aba = (on: boolean) => cn(
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/70 bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.04]",
  );
  return (
    <nav aria-label="Progresso e módulos do projeto" className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-0.5">
      <button type="button" aria-current={ativo === null ? "page" : undefined} onClick={() => onIr(null)} className={aba(ativo === null)}>
        <Gauge className="h-4 w-4" aria-hidden />Progresso
        <b className={cn("font-display text-[15px] tabular-nums", ativo === null ? "text-primary-foreground" : "text-primary")}>{pct}%</b>
      </button>
      {modulos.map(m => {
        const on = ativo === m.numero;
        const { feitas, total, completo } = contaModulo(m);
        return (
          <button key={m.numero} type="button" aria-current={on ? "page" : undefined} onClick={() => onIr(m.numero)} className={aba(on)}
            title={on ? "Voltar ao início do módulo" : `Abrir as atividades do módulo ${m.numero}`}>
            <span className={cn("rounded-md px-1.5 font-display text-[13px] font-bold", on ? "bg-white/20" : "bg-primary/10 text-primary")}>{m.numero}</span>
            <span className="whitespace-nowrap">{m.nome}</span>
            {completo
              ? <CheckCircle2 className={cn("h-4 w-4", on ? "text-primary-foreground" : "text-emerald-600 dark:text-emerald-400")} aria-label="Concluído" />
              : <span className={cn("text-xs tabular-nums", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{feitas}/{total}</span>}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Um módulo no progresso: andamento e a trilha das atividades (cada bolinha abre a atividade). A
 * próxima ganha o laranja do logo; com `destaque`, as da situação escolhida acendem e as outras apagam.
 */
function CartaoTrilha({ m, destaque, onAbrir }: {
  m: ModuloProgresso; destaque: SituacaoAtividade | null; onAbrir: (numero: string, atividadeId?: string) => void;
}) {
  const { feitas, total, completo } = contaModulo(m);
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
  const ehProxima = (id: string) => !destaque && id === proxima?.a.id;

  return (
    <article className="rounded-xl border border-border/70 bg-card px-4 pb-3.5 pt-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" onClick={() => onAbrir(m.numero)} title={`Abrir as atividades do módulo ${m.numero}`} className="group flex min-w-0 flex-1 basis-56 items-center gap-3 text-left">
          <NumeroModulo numero={m.numero} />
          <h3 className="min-w-0 text-lg font-bold leading-tight group-hover:text-primary">{m.nome}</h3>
        </button>
        {destaque && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", acesas ? "bg-muted text-foreground" : "text-muted-foreground")}>
            {acesas ? `${acesas} em destaque` : "nenhuma aqui"}
          </span>
        )}
        <span className="flex items-center gap-2.5">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-primary/15 sm:w-28">
            <span className={cn("block h-full rounded-full transition-[width] duration-500", completo ? "bg-emerald-500" : "bg-gradient-to-r from-marca-laranja via-marca-rosa to-purple-600")}
              style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
          </span>
          {completo
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Concluído</span>
            : <b className="whitespace-nowrap font-display text-xl font-bold leading-none tabular-nums">{feitas}<span className="text-sm text-muted-foreground">/{total}</span></b>}
        </span>
      </div>

      <ol ref={lista} className="-mx-1 mt-3 flex items-start overflow-x-auto px-1 pb-1 pt-2.5">
        {m.atividades.map(({ a, sit }, i) => {
          const acesa = destaque === sit;
          const apagada = !!destaque && !acesa;
          const prox = ehProxima(a.id);
          const anterior = m.atividades[i - 1];
          const seguinte = m.atividades[i + 1];
          // linha até a bolinha: roxa depois de uma feita; chegando na próxima, vira laranja
          const linhaAntes = i === 0 ? "opacity-0" : anterior.sit === "feito" ? (prox ? "bg-gradient-to-r from-primary to-marca-laranja" : "bg-primary") : "bg-border";
          const linhaDepois = !seguinte ? "opacity-0" : sit === "feito" ? "bg-primary" : "bg-border";
          return (
            <li key={a.id} className="flex min-w-[78px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span aria-hidden className={cn("h-0.5 flex-1 transition-opacity", linhaAntes, destaque && i > 0 && "opacity-30")} />
                <button type="button" onClick={() => onAbrir(m.numero, a.id)} title={`${a.titulo}: ${rotulo(sit).toLowerCase()}`}
                  aria-label={`Módulo ${m.numero}, ${i + 1}. ${a.titulo}: ${rotulo(sit)}`} data-acesa={acesa || undefined}
                  className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold transition-[transform,opacity,box-shadow] duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    prox ? PROXIMA : SIT[sit].bolinha,
                    acesa && cn("z-10 scale-[1.18] shadow-lg ring-[6px] hover:scale-[1.25]", SIT[sit].anel), apagada && "opacity-25 grayscale")}>
                  {sit === "feito" ? <Check className="h-4 w-4" strokeWidth={2.6} /> : sit === "bloqueado" ? <Lock className="h-3.5 w-3.5" /> : sit === "naoaplica" ? <Minus className="h-3.5 w-3.5" /> : i + 1}
                </button>
                <span aria-hidden className={cn("h-0.5 flex-1 transition-opacity", linhaDepois, destaque && seguinte && "opacity-30")} />
              </div>
              <span lang="pt-BR" className={cn("mt-2 line-clamp-4 hyphens-auto px-0.5 text-center text-[11px] leading-[1.3] transition-opacity",
                acesa ? "font-semibold text-foreground" : prox ? "font-semibold text-orange-700 dark:text-orange-300" : sit === "naoaplica" ? "text-muted-foreground/70 line-through" : "text-muted-foreground",
                apagada && "opacity-40")}>{a.titulo}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dashed pt-3 text-[12.5px] text-muted-foreground">
        {m.extra ?? (proxima ? null : <span>Todas as atividades do módulo estão feitas.</span>)}
        <button type="button" onClick={() => onAbrir(m.numero)} className="ml-auto inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Abrir módulo<ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
}

/** Quem faz a atividade: a sigla num círculo da marca e o nome (o do GP, quando é com ele). */
function QuemFaz({ r, nomeGp }: { r: Responsavel; nomeGp: string | null }) {
  const sigla = r === "gp" ? "GP" : r === "assistente" ? "AP" : "A";
  return (
    <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-marca-laranja to-marca-rosa text-[9px] font-bold text-white">{sigla}</span>
      {r === "gp" && nomeGp ? `GP · ${nomeGp.split(" ").filter(Boolean).slice(0, 2).join(" ")}` : RESPONSAVEL_LABEL[r]}
    </span>
  );
}

/**
 * Progresso do projeto ao abrir: os módulos com as trilhas e, ao lado, os próximos passos de cada
 * módulo e o que pede atenção. O anel e os números ficam no cabeçalho do projeto.
 */
export function ProgressoProjeto({ modulos, onAbrir, destaque, onLimparDestaque, avisos, nomeGp }: {
  modulos: ModuloProgresso[];
  /** Abre as atividades do módulo; com id, rola até a atividade. */
  onAbrir: (numero: string, atividadeId?: string) => void;
  destaque: SituacaoAtividade | null;
  onLimparDestaque: () => void;
  avisos: AvisoProjeto[];
  nomeGp: string | null;
}) {
  const proximos = modulos.map(m => ({ m, x: proximaDe(m) })).filter(p => p.x);
  const qtdDestaque = destaque ? modulos.flatMap(m => m.atividades).filter(x => x.sit === destaque).length : 0;
  // atividades esperando retorno de alguém também pedem atenção
  const todosAvisos: AvisoProjeto[] = [
    ...avisos,
    ...modulos.flatMap(m => m.atividades.filter(x => x.sit === "aguardando").map(x => ({
      icone: Clock3, titulo: x.a.titulo, texto: `Aguardando retorno · módulo ${m.numero}`, tom: "ambar" as const, modulo: m.numero, atividade: x.a.id,
    }))),
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {/* Próximos passos e atenção: no celular vêm primeiro */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:order-2">
        <section aria-labelledby="ger-proximos" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <span aria-hidden className="block h-1 bg-gradient-to-r from-marca-laranja via-marca-rosa to-purple-600" />
          <div className="flex items-center gap-2 px-4 pb-2.5 pt-3">
            <h2 id="ger-proximos" className="text-xl font-bold">Próximos passos</h2>
            {proximos.length > 0 && <span className="ml-auto rounded-full bg-marca-laranja px-2 py-0.5 text-xs font-bold leading-none text-white">{proximos.length}</span>}
          </div>
          {proximos.length === 0 ? (
            <p className="flex items-center gap-2 border-t px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Todas as atividades que se aplicam a este projeto estão feitas.
            </p>
          ) : (
            <ul>
              {proximos.map(({ m, x }) => (
                <li key={m.numero} className="border-t">
                  <button type="button" onClick={() => onAbrir(m.numero, x!.a.id)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                    <NumeroModulo numero={m.numero} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm font-semibold leading-snug">{x!.a.titulo}</b>
                      <QuemFaz r={x!.a.responsavel} nomeGp={nomeGp} />
                    </span>
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {todosAvisos.length > 0 && (
          <section aria-labelledby="ger-atencao" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <span aria-hidden className="block h-1 bg-amber-400" />
            <h2 id="ger-atencao" className="px-4 pb-2.5 pt-3 text-xl font-bold">Atenção</h2>
            <ul>
              {todosAvisos.map(av => {
                const conteudo = (
                  <>
                    <av.icone className={cn("mt-0.5 h-4 w-4 shrink-0", av.tom === "ambar" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} aria-hidden />
                    <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                      <b className="block font-semibold text-foreground">{av.titulo}</b>{av.texto}
                    </span>
                  </>
                );
                return (
                  <li key={`${av.titulo}-${av.modulo ?? ""}`} className="border-t">
                    {av.modulo ? (
                      <button type="button" onClick={() => onAbrir(av.modulo!, av.atividade)}
                        className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">{conteudo}</button>
                    ) : <div className="flex items-start gap-2.5 px-4 py-3">{conteudo}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </aside>

      <section aria-labelledby="ger-modulos" className="flex min-w-0 flex-col gap-3.5 lg:order-1">
        <div className="flex min-h-8 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="ger-modulos" className="text-[22px] font-bold">Módulos do projeto</h2>
          {destaque ? (
            <p className="ml-auto inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" aria-live="polite">
              <span className="text-muted-foreground">Em destaque: <b className="font-semibold text-foreground">{SIT[destaque].rotulo} ({qtdDestaque})</b></span>
              <button type="button" onClick={onLimparDestaque}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[12px] font-medium hover:bg-muted">
                <X className="h-3.5 w-3.5" />Limpar destaque
              </button>
            </p>
          ) : <span className="text-[13px] text-muted-foreground">Toque numa etapa para abrir</span>}
        </div>
        {modulos.map(m => <CartaoTrilha key={m.numero} m={m} destaque={destaque} onAbrir={onAbrir} />)}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-[13px] text-muted-foreground">
          <Layers className="h-4 w-4 shrink-0" />Próximos módulos: em definição
        </div>
      </section>
    </div>
  );
}
