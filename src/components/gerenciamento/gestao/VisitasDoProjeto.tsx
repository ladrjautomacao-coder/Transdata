import { useEffect, useRef } from "react";
import { AlertTriangle, CalendarCheck2, CalendarClock, CalendarDays, CalendarX2, Check, MapPin, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TechAvatar } from "@/components/agendamento/AgendaShared";
import { VISIT_FORMAT_LABEL } from "@/lib/implantationScheduling";
import { diasAte, periodoDaVisita, resumoVisitas, type SituacaoVisita, type VisitaDoProjeto } from "@/lib/gestaoVisitas";
import { cn } from "@/lib/utils";

/** As visitas como chegam da Agenda Técnica para a tela (carregando, erro ou a lista). */
export interface ConsultaVisitas {
  visitas: VisitaDoProjeto[] | undefined;
  carregando: boolean;
  erro: string | null;
  tentar: () => void;
  agora: Date;
}

/** Bolinha da visita: verde com ✓ (realizada), laranja da marca (acontecendo agora) ou contorno tracejado (próxima). */
export function BolinhaVisita({ situacao, tamanho = "md" }: { situacao: SituacaoVisita; tamanho?: "sm" | "md" }) {
  const sm = tamanho === "sm";
  return (
    <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center rounded-full", sm ? "h-6 w-6" : "h-9 w-9",
      situacao === "realizada" && "bg-emerald-500 text-white",
      situacao === "acontecendo" && "bg-gradient-to-br from-marca-laranja to-marca-rosa text-white shadow-[0_0_0_4px_hsl(var(--marca-laranja)/0.2)]",
      situacao === "proxima" && "border-2 border-dashed border-primary/40 bg-card text-primary")}>
      {situacao === "acontecendo" && <span className="absolute inset-0 animate-ping rounded-full bg-marca-laranja/40 motion-reduce:hidden" />}
      {situacao === "realizada" ? <Check className={sm ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.8} />
        : situacao === "acontecendo" ? <span className={cn("relative rounded-full bg-white", sm ? "h-2 w-2" : "h-2.5 w-2.5")} />
        : <CalendarClock className={sm ? "h-3 w-3" : "h-4 w-4"} />}
    </span>
  );
}

/** Linha entre duas visitas: cheia até agora, tracejada para o que ainda vai acontecer. */
function Linha({ de, ate, vertical = false }: { de?: SituacaoVisita; ate?: SituacaoVisita; vertical?: boolean }) {
  if (!de || !ate) return <span aria-hidden className={vertical ? "w-0.5 flex-1 opacity-0" : "h-0.5 flex-1 opacity-0"} />;
  const cheia = ate !== "proxima";
  const cor = ate === "acontecendo" ? (vertical ? "bg-gradient-to-b" : "bg-gradient-to-r") + " from-emerald-500 to-marca-laranja" : "bg-emerald-500";
  return cheia
    ? <span aria-hidden className={cn(vertical ? "w-0.5 flex-1" : "h-0.5 flex-1", cor)} />
    : <span aria-hidden className={cn("flex-1 border-dashed border-primary/30", vertical ? "border-l-2" : "border-t-2")} />;
}

const ROTULO: Record<SituacaoVisita, string> = { realizada: "Realizada", acontecendo: "Acontecendo agora", proxima: "Próxima" };
const quando = (v: VisitaDoProjeto, agora: Date) => {
  const n = diasAte(v.inicio, agora);
  return n <= 0 ? "começa hoje" : n === 1 ? "amanhã" : `em ${n} dias`;
};

/** O cartão de uma visita: tipo, período, formato, técnicos e a situação (realizadas cheias; pendentes tracejadas). */
function CartaoVisita({ v, agora }: { v: VisitaDoProjeto; agora: Date }) {
  const p = periodoDaVisita(v.inicio, v.fim);
  const dataRegistro = v.registro?.em ? new Date(v.registro.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null;
  return (
    <article className={cn("flex flex-1 flex-col gap-2 rounded-xl p-3.5",
      v.situacao === "realizada" && "border border-emerald-500/40 bg-emerald-500/[0.07]",
      v.situacao === "acontecendo" && "border-2 border-marca-laranja/70 bg-orange-500/[0.05] shadow-sm",
      v.situacao === "proxima" && "border-2 border-dashed border-border bg-card")}>
      <span className={cn("inline-flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wide",
        v.situacao === "realizada" ? "text-emerald-700 dark:text-emerald-300" : v.situacao === "acontecendo" ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground")}>
        {v.situacao === "realizada" && <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden />}
        {ROTULO[v.situacao]}{v.situacao === "proxima" && <span className="font-medium normal-case tracking-normal"> · {quando(v, agora)}</span>}
      </span>
      <h3 className="text-[15px] font-bold leading-snug">{v.tipo}</h3>
      <p className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
        <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span><b className="font-semibold text-foreground">{p.completo}</b> · {p.horas}</span>
      </p>
      <p className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
        {v.formato === "remoto" ? <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span>{v.formato ? <b className="font-semibold text-foreground">{VISIT_FORMAT_LABEL[v.formato]}</b> : "Formato não informado"}{v.turno && ` · ${v.turno}`}</span>
      </p>
      <div className="mt-auto flex items-center gap-2 pt-1">
        {v.tecnicos.length > 0 ? (
          <>
            <span className="flex -space-x-1.5">{v.tecnicos.map(t => <TechAvatar key={t.id} tech={t} size="h-6 w-6 text-[9px]" />)}</span>
            <span className="min-w-0 text-[12.5px] leading-snug">{v.tecnicos.map(t => t.full_name).join(", ")}</span>
          </>
        ) : <span className="text-[12.5px] text-muted-foreground">Técnico não informado</span>}
      </div>
      {v.registro && (
        <p className="border-t border-emerald-500/20 pt-2 text-[11.5px] text-emerald-800 dark:text-emerald-200">
          Atendimento registrado{v.registro.por ? ` por ${v.registro.por}` : ""}{dataRegistro ? ` em ${dataRegistro}` : ""}
        </p>
      )}
    </article>
  );
}

/** Contadores das visitas por situação (zerados ficam apagados). */
function ResumoVisitas({ lista, className }: { lista: VisitaDoProjeto[]; className?: string }) {
  const r = resumoVisitas(lista);
  const itens: { s: SituacaoVisita; n: number; rotulo: string }[] = [
    { s: "realizada", n: r.realizadas, rotulo: r.realizadas === 1 ? "realizada" : "realizadas" },
    { s: "acontecendo", n: r.acontecendo, rotulo: "acontecendo agora" },
    { s: "proxima", n: r.proximas, rotulo: r.proximas === 1 ? "próxima" : "próximas" },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Visitas por situação">
      {itens.map(i => (
        <li key={i.s} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", i.n === 0 && "opacity-50",
          i.s === "realizada" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : i.s === "acontecendo" ? "border-marca-laranja/30 bg-orange-500/10 text-orange-800 dark:text-orange-200" : "border-dashed border-border text-muted-foreground")}>
          <BolinhaVisita situacao={i.s} tamanho="sm" />
          <b className="font-display text-sm tabular-nums">{i.n}</b>{i.rotulo}
        </li>
      ))}
    </ul>
  );
}

/** Trilha compacta das visitas (no início do projeto): uma bolinha por visita, em ordem de data. */
export function TrilhaVisitas({ lista, onAbrir }: { lista: VisitaDoProjeto[]; onAbrir: () => void }) {
  return (
    <ol className="flex items-center" aria-label="Visitas do projeto em ordem de data">
      {lista.map((v, i) => (
        <li key={v.id} className="flex min-w-[30px] max-w-[64px] flex-1 items-center last:min-w-0 last:max-w-none last:flex-none">
          <button type="button" onClick={onAbrir} title={`${v.tipo} · ${periodoDaVisita(v.inicio, v.fim).curto}: ${ROTULO[v.situacao].toLowerCase()}`}
            className="rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BolinhaVisita situacao={v.situacao} tamanho="sm" />
          </button>
          {lista[i + 1] && <span className="mx-0.5 flex flex-1"><Linha de={v.situacao} ate={lista[i + 1].situacao} /></span>}
        </li>
      ))}
    </ol>
  );
}

/** Mensagens de carregando, erro e sem visitas (as mesmas no início do projeto e no painel). */
export function EstadoVisitas({ consulta, compacto = false }: { consulta: ConsultaVisitas; compacto?: boolean }) {
  if (consulta.carregando) {
    return <div className="flex gap-3" aria-label="Carregando as visitas">{[0, 1, 2].map(i => <Skeleton key={i} className={cn("flex-1 rounded-xl", compacto ? "h-12" : "h-40")} />)}</div>;
  }
  if (consulta.erro) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px]">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <span className="min-w-0 flex-1">Não foi possível ler a Agenda Técnica. {consulta.erro}</span>
        <Button size="sm" variant="outline" className="h-8" onClick={consulta.tentar}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar de novo</Button>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-dashed border-border px-4 text-[13px] text-muted-foreground", compacto ? "py-3" : "py-5")}>
      <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p><b className="font-semibold text-foreground">Nenhuma visita aprovada na Agenda Técnica para este projeto.</b>{" "}
        As visitas aparecem aqui assim que a coordenação de implantação aprova o agendamento.</p>
    </div>
  );
}

/**
 * Gestão de cronograma · Visitas do projeto: as visitas aprovadas na Agenda Técnica numa linha do tempo,
 * em ordem de data. Realizadas em verde cheio com ✓; as pendentes (acontecendo agora, no laranja da
 * marca, e as próximas, tracejadas) com a situação escrita. No celular a linha fica em pé.
 */
export function VisitasDoProjeto({ consulta }: { consulta: ConsultaVisitas }) {
  const lista = consulta.visitas ?? [];
  const temLista = !consulta.carregando && !consulta.erro && lista.length > 0;
  // sem visita acontecendo, o "Hoje" fica antes da primeira próxima (ou depois da última, se todas já foram)
  const primeiraProxima = lista.findIndex(v => v.situacao === "proxima");
  const posHoje = lista.some(v => v.situacao === "acontecendo") ? -1 : primeiraProxima === -1 ? lista.length : primeiraProxima;
  // linha mais larga que a tela: rola até a primeira visita pendente, com a anterior ainda à vista
  // (sempre no começo de um cartão, sem cortar nenhum pela metade)
  const linha = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = linha.current;
    const alvo = ol?.querySelector<HTMLElement>('[data-pendente="true"]');
    if (!ol || !alvo || ol.scrollWidth <= ol.clientWidth) return;
    const inicio = (alvo.previousElementSibling as HTMLElement | null) ?? alvo;
    ol.scrollTo({ left: Math.max(0, inicio.offsetLeft) });
  }, [consulta.visitas]);

  const marcaHoje = (lado: "esq" | "dir") => (
    <span className={cn("absolute top-0 z-10 rounded-full bg-foreground px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-background",
      lado === "esq" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2")}>Hoje</span>
  );

  return (
    <section aria-labelledby="ger-visitas" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <span aria-hidden className="block h-1 bg-gradient-to-r from-emerald-500 via-marca-laranja to-purple-600" />
      <header className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 pb-4 pt-5 sm:px-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarCheck2 className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="ger-visitas" className="text-xl font-bold leading-tight">Visitas do projeto</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Da Agenda Técnica · só as visitas aprovadas pela coordenação de implantação</p>
        </div>
        {temLista && <ResumoVisitas lista={lista} className="basis-full sm:basis-auto" />}
      </header>

      <div className="border-t px-5 py-5 sm:px-6">
        {!temLista ? <EstadoVisitas consulta={consulta} /> : (
          <>
            {/* computador e tablet: linha do tempo deitada */}
            <ol ref={linha} className="relative -mx-2 hidden snap-x overflow-x-auto px-2 pb-2 pt-1 sm:flex" aria-label="Linha do tempo das visitas">
              {lista.map((v, i) => (
                <li key={v.id} data-pendente={v.situacao !== "realizada" || undefined} className="relative flex min-w-[208px] max-w-[360px] flex-1 snap-start flex-col">
                  {posHoje === i && marcaHoje("esq")}
                  {i === lista.length - 1 && posHoje === lista.length && marcaHoje("dir")}
                  {/* a linha ocupa a coluna inteira: de uma coluna para a outra ela não se interrompe */}
                  <div className="mt-6 flex items-center">
                    <Linha de={lista[i - 1]?.situacao} ate={lista[i - 1] ? v.situacao : undefined} />
                    <BolinhaVisita situacao={v.situacao} />
                    <Linha de={lista[i + 1] ? v.situacao : undefined} ate={lista[i + 1]?.situacao} />
                  </div>
                  <p className={cn("mb-2.5 mt-1.5 text-center font-display text-sm font-bold tabular-nums", v.situacao === "proxima" && "text-muted-foreground")}>
                    {periodoDaVisita(v.inicio, v.fim).curto}
                  </p>
                  <div className="flex flex-1 flex-col px-1.5"><CartaoVisita v={v} agora={consulta.agora} /></div>
                </li>
              ))}
            </ol>

            {/* celular: a mesma linha em pé */}
            <ol className="flex flex-col sm:hidden" aria-label="Linha do tempo das visitas">
              {lista.map((v, i) => (
                <li key={v.id} className="flex gap-3">
                  <div className="flex w-9 shrink-0 flex-col items-center">
                    <span className="flex h-2.5 flex-col items-center"><Linha vertical de={lista[i - 1]?.situacao} ate={lista[i - 1] ? v.situacao : undefined} /></span>
                    <BolinhaVisita situacao={v.situacao} />
                    <Linha vertical de={lista[i + 1] ? v.situacao : undefined} ate={lista[i + 1]?.situacao} />
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <p className="mb-1.5 mt-2.5 font-display text-sm font-bold tabular-nums">{periodoDaVisita(v.inicio, v.fim).curto}</p>
                    <CartaoVisita v={v} agora={consulta.agora} />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
