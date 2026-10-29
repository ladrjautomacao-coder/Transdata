import { useState, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { CalendarClock, CheckCircle2, GripVertical, ListTree, Lock, MessageSquare, Trash2 } from "lucide-react";
import {
  STATUS_NOME, etapaNome, etapaStatus, etapasOf, nomeCurto, predsAbertas, stats, type GoAtividade, type GoDados, type GoRel, type GoStatus,
} from "@/lib/grandesOperacoes/dados";
import type { ResultadoPrevisao } from "@/lib/grandesOperacoes/previsao";
import { COR_STATUS, destaqueLinha } from "@/lib/grandesOperacoes/ui";
import { cn } from "@/lib/utils";
import { Barra, Dot, RelTag } from "./GoShared";

const COLUNAS: [GoStatus, string][] = [["concluido", "Concluídas"], ["andamento", "Em andamento"], ["espera", "Em espera"]];
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
      {(["concluido", "andamento", "espera"] as GoStatus[]).map(s => <span key={s} className="inline-flex items-center gap-1.5"><Dot status={s} />{STATUS_NOME[s]}</span>)}
      <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary/70" />vem antes</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500" />vem depois</span>
    </div>
  );
}

/** A data que o card mostra: quando foi concluída, até quando vai (previsão) ou "a planejar". */
function DataCard({ a, r }: { a: GoAtividade; r: ResultadoPrevisao | undefined }) {
  if (a.status === "concluido") {
    if (!r || r.tipo === "semdatas") return null;
    return <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" />{ddmm(r.tipo === "real" ? r.fim : r.inicio)}</span>;
  }
  if (!r) return null;
  if (r.tipo === "planejar") return <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />a planejar</span>;
  if (r.tipo !== "est") return null;
  return (
    <span className="inline-flex items-center gap-1" title="Previsão pelas durações e pelo que vem antes">
      <CalendarClock className="h-3 w-3" />{a.status === "andamento" ? `até ${ddmm(r.fim)}` : `${ddmm(r.inicio)} → ${ddmm(r.fim)}`}
    </span>
  );
}

/**
 * Visão Quadro: a coluna de etapas (clicar filtra) e as atividades por status. Clicar numa
 * atividade abre os detalhes e destaca o que vem antes e depois dela. Quem pode editar arrasta o
 * card para outra coluna (ou para "Removidas") e o status muda.
 */
export function QuadroGO({ dados, visiveis, act, onSelect, etapa, onEtapa, mostrarProjeto, rel, podeEditar, onStatus, previsao }: {
  dados: GoDados;
  visiveis: GoAtividade[];
  act: number | null;
  onSelect: (id: number) => void;
  etapa: number | null;
  onEtapa: (id: number | null) => void;
  /** Painel com mais de um projeto: a etapa e o card mostram de qual projeto são. */
  mostrarProjeto: boolean;
  rel: GoRel;
  podeEditar: boolean;
  onStatus: (id: number, status: GoStatus) => void;
  previsao: Record<number, ResultadoPrevisao>;
}) {
  const [verRemovidas, setVerRemovidas] = useState(false);
  const [arrastando, setArrastando] = useState<GoStatus | null>(null);
  const ets = etapasOf(dados, visiveis);
  const naEtapa = (a: GoAtividade) => etapa == null || a.etapa_id === etapa;
  const removidas = visiveis.filter(a => a.status === "removido" && naEtapa(a));

  const soltar = ({ draggableId, source, destination }: DropResult) => {
    setArrastando(null);
    if (!destination || destination.droppableId === source.droppableId) return;
    onStatus(Number(draggableId), destination.droppableId as GoStatus);
  };

  const card = (a: GoAtividade, i: number) => {
    const isP = rel.pred.has(a.id), isS = rel.succ.has(a.id), sel = act === a.id;
    const abertas = a.status === "espera" ? predsAbertas(dados, a) : [];
    return (
      <Draggable key={a.id} draggableId={String(a.id)} index={i} isDragDisabled={!podeEditar}>
        {(prov, snap) => (
          <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
            onClick={() => onSelect(a.id)} onKeyDown={e => { if (e.key === "Enter") onSelect(a.id); }}
            aria-label={`${a.codigo} ${a.titulo}: ${STATUS_NOME[a.status]}. Enter abre os detalhes${podeEditar ? "; espaço pega o card para mover" : ""}.`}
            className={cn("group relative shrink-0 overflow-hidden rounded-lg border py-2.5 pl-3.5 pr-3 text-left shadow-sm transition-[box-shadow,border-color,background-color] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              destaqueLinha(sel, isP, isS), podeEditar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
              snap.isDragging && "rotate-[1.5deg] shadow-xl ring-2 ring-primary/30")}>
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${COR_STATUS[a.status].barra}`} />
            <span className="flex items-center gap-2">
              <span className="shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[11px] font-semibold text-muted-foreground">{a.codigo}</span>
              <RelTag pred={isP} succ={isS} />
              <span className="ml-auto min-w-0 truncate text-[11px] text-muted-foreground" title={a.responsavel}>{a.responsavel || "sem responsável"}</span>
              {podeEditar && <GripVertical className="-mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-opacity group-hover:text-muted-foreground" aria-hidden />}
            </span>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug">{a.titulo}</p>
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
              {(etapa == null || mostrarProjeto) && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                  <ListTree className="h-3 w-3 shrink-0" />
                  <span className="truncate">{mostrarProjeto ? `${nomeCurto(dados.proj.get(a.projeto_id))} · ` : ""}{etapaNome(dados, a)}</span>
                </span>
              )}
              <DataCard a={a} r={previsao[a.id]} />
              {a.observacoes.length > 0 && <span className="inline-flex items-center gap-1" title={`${a.observacoes.length} observações`}><MessageSquare className="h-3 w-3" />{a.observacoes.length}</span>}
              {abertas.length > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300" title="Só começa depois destas">
                  <Lock className="h-3 w-3" />aguarda {abertas.map(p => p.codigo).join(", ")}
                </span>
              )}
            </span>
          </div>
        )}
      </Draggable>
    );
  };

  const cabecalho = (titulo: ReactNode, n: number, sub?: ReactNode) => (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-foreground/80">{titulo}</span>
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums shadow-sm">{n}</span>
    </div>
  );
  const vazio = (t: string) => <p className="px-2 py-8 text-center text-[12.5px] text-muted-foreground">{t}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">
          {etapa != null ? "Mostrando só a etapa selecionada. Clique nela de novo para ver todas."
            : podeEditar ? <><b className="text-foreground">Arraste</b> um card para outra coluna para mudar o status. Clique nele para ver os detalhes.</>
            : <>Clique numa <b className="text-foreground">etapa</b> para filtrar. Clique numa <b className="text-foreground">atividade</b> para ver os detalhes e o que vem antes e depois.</>}
        </p>
        <Legenda />
      </div>

      <DragDropContext onDragStart={s => setArrastando(s.source.droppableId as GoStatus)} onDragEnd={soltar}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-w-0 flex-col rounded-xl border border-t-4 border-border/60 border-t-primary/70 bg-muted/30">
            {cabecalho(<><ListTree className="h-3.5 w-3.5" />Etapas</>, ets.length, "clique para filtrar")}
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
              {ets.length ? ets.map(e => {
                const s = stats(e.acts), st = etapaStatus(e.acts), sel = etapa === e.key;
                const completo = s.total > 0 && s.done === s.total;
                return (
                  <button key={e.key} type="button" onClick={() => onEtapa(sel ? null : e.key)} aria-pressed={sel}
                    className={cn("flex w-full shrink-0 flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      destaqueLinha(sel, false, rel.etHl.has(e.key) && !sel))}>
                    <span className="flex items-start gap-2">
                      <span className={cn("flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 font-mono text-[11px] font-bold", sel ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>{e.num}</span>
                      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">{e.nome}</span>
                      {completo ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Etapa concluída" />
                        : <span className={`mt-0.5 text-[11.5px] font-semibold tabular-nums ${COR_STATUS[st].texto}`}>{s.done}/{s.total}</span>}
                    </span>
                    <Barra s={s} />
                    {mostrarProjeto && <span className="truncate text-[11px] text-muted-foreground">{nomeCurto(dados.proj.get(e.projeto_id))}</span>}
                  </button>
                );
              }) : vazio("Nenhuma etapa com esse filtro")}
            </div>
          </div>

          {COLUNAS.map(([st, label]) => {
            const itens = visiveis.filter(a => a.status === st && naEtapa(a));
            const alvo = !!arrastando && arrastando !== st;
            return (
              <div key={st} className={cn("flex min-w-0 flex-col rounded-xl border border-t-4 border-border/60 bg-muted/30 transition-shadow", COR_STATUS[st].topo, alvo && "shadow-md")}>
                {cabecalho(<><Dot status={st} />{label}</>, itens.length, alvo ? `solte para mudar para ${STATUS_NOME[st]}` : undefined)}
                <Droppable droppableId={st} isDropDisabled={!podeEditar}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps}
                      className={cn("flex max-h-[70vh] min-h-[140px] flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl p-2 transition-colors", snap.isDraggingOver && COR_STATUS[st].alvo)}>
                      {itens.map(card)}
                      {prov.placeholder}
                      {!itens.length && !snap.isDraggingOver && vazio(alvo ? "Solte aqui" : "Nenhuma atividade aqui")}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>

        {(podeEditar || removidas.length > 0) && (
          <div className="flex flex-col gap-2">
            <Droppable droppableId="removido" isDropDisabled={!podeEditar} direction="horizontal">
              {(prov, snap) => (
                <div ref={prov.innerRef} {...prov.droppableProps}
                  className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 border-dashed px-4 py-3 text-[13px] transition-colors",
                    snap.isDraggingOver ? "border-destructive/60 bg-destructive/10 text-destructive" : arrastando ? "border-border bg-muted/40 text-foreground" : "border-border/60 text-muted-foreground")}>
                  <Trash2 className="h-4 w-4 shrink-0" />
                  {arrastando ? <span>Solte aqui para marcar como <b>Removida</b>. Ela sai da conta do progresso.</span> : (
                    <span>
                      {removidas.length ? `${removidas.length} ${removidas.length > 1 ? "atividades removidas" : "atividade removida"}` : "Nenhuma atividade removida"}
                      {removidas.length > 0 && <> · <button type="button" className="font-medium text-primary hover:underline" onClick={() => setVerRemovidas(v => !v)}>{verRemovidas ? "ocultar" : "mostrar"}</button></>}
                      {podeEditar && <span className="text-muted-foreground"> · arraste um card para cá para remover</span>}
                    </span>
                  )}
                  <span className="h-0 w-0 overflow-hidden">{prov.placeholder}</span>
                </div>
              )}
            </Droppable>
            {verRemovidas && removidas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {removidas.map(a => (
                  <button key={a.id} type="button" onClick={() => onSelect(a.id)} className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-[12.5px] hover:bg-muted/50">
                    <span className="font-mono text-[11px] text-muted-foreground">{a.codigo}</span><span className="line-through">{a.titulo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DragDropContext>
    </div>
  );
}
