import { useState, type ReactNode } from "react";
import { STATUS_NOME, etapaNome, etapaStatus, etapasOf, nomeCurto, stats, type GoAtividade, type GoDados, type GoRel, type GoStatus } from "@/lib/grandesOperacoes/dados";
import { destaqueLinha } from "@/lib/grandesOperacoes/ui";
import { Dot, RelTag } from "./GoShared";

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
      {(["concluido", "andamento", "espera"] as GoStatus[]).map(s => <span key={s} className="inline-flex items-center gap-1.5"><Dot status={s} />{STATUS_NOME[s]}</span>)}
      <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary/70" />vem antes</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500" />vem depois</span>
    </div>
  );
}

/**
 * Visão Quadro: a coluna de etapas (clicar filtra) e as atividades por status. Clicar numa
 * atividade abre os detalhes e destaca o que vem antes e depois dela.
 */
export function QuadroGO({ dados, visiveis, act, onSelect, etapa, onEtapa, mostrarProjeto, rel }: {
  dados: GoDados;
  visiveis: GoAtividade[];
  act: number | null;
  onSelect: (id: number) => void;
  etapa: number | null;
  onEtapa: (id: number | null) => void;
  /** Painel com mais de um projeto: a etapa mostra de qual projeto é. */
  mostrarProjeto: boolean;
  rel: GoRel;
}) {
  const [verRemovidas, setVerRemovidas] = useState(false);
  const ets = etapasOf(dados, visiveis);
  const naEtapa = (a: GoAtividade) => etapa == null || a.etapa_id === etapa;
  const removidas = visiveis.filter(a => a.status === "removido" && naEtapa(a));

  const linha = (a: GoAtividade) => {
    const isP = rel.pred.has(a.id), isS = rel.succ.has(a.id);
    return (
      <button key={a.id} type="button" onClick={() => onSelect(a.id)}
        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${destaqueLinha(act === a.id, isP, isS)}`}>
        <span className="flex items-start gap-2">
          <span className="mt-px shrink-0 font-mono text-[11px] text-muted-foreground">{a.codigo}</span>
          <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{a.titulo}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <RelTag pred={isP} succ={isS} />
          <span className="min-w-0">{etapaNome(dados, a)} · {a.responsavel || "sem responsável"}</span>
        </span>
      </button>
    );
  };

  const coluna = (titulo: ReactNode, n: number, conteudo: ReactNode, extra?: ReactNode) => (
    <div className="flex min-w-0 flex-col rounded-xl border border-border/60 bg-muted/30">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums">{n}</span>
      </div>
      {extra}
      <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">{conteudo}</div>
    </div>
  );
  const vazio = (t: string) => <p className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">{t}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">
          {etapa != null ? "Mostrando só a etapa selecionada. Clique nela de novo para ver todas."
            : <>Clique numa <b className="text-foreground">etapa</b> para filtrar. Clique numa <b className="text-foreground">atividade</b> para ver os detalhes e o que vem antes e depois.</>}
        </p>
        <Legenda />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {coluna("Etapas", ets.length,
          ets.length ? ets.map(e => {
            const s = stats(e.acts), st = etapaStatus(e.acts), sel = etapa === e.key;
            return (
              <button key={e.key} type="button" onClick={() => onEtapa(sel ? null : e.key)} aria-pressed={sel}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${destaqueLinha(sel, false, rel.etHl.has(e.key) && !sel)}`}>
                <span className="flex items-start gap-2">
                  <span className="mt-px shrink-0 font-mono text-[11px] text-muted-foreground">{e.num}</span>
                  <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">{e.nome}</span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <Dot status={st} />{s.done}/{s.total} concluídas{mostrarProjeto ? ` · ${nomeCurto(dados.proj.get(e.projeto_id))}` : ""}
                </span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted"><i className="block h-full bg-emerald-500" style={{ width: `${s.pct}%` }} /></span>
              </button>
            );
          }) : vazio("Nenhuma etapa com esse filtro"),
          etapa != null && <button type="button" className="mx-2 mt-2 rounded-md bg-background px-2 py-1 text-[12px] font-medium text-primary hover:underline" onClick={() => onEtapa(null)}>Ver todas as etapas</button>)}
        {([["concluido", "Concluídas"], ["andamento", "Em andamento"], ["espera", "Em espera"]] as [GoStatus, string][]).map(([st, label]) => {
          const itens = visiveis.filter(a => a.status === st && naEtapa(a));
          return <div key={st} className="contents">{coluna(<><Dot status={st} />{label}</>, itens.length, itens.length ? itens.map(linha) : vazio("Nenhuma atividade aqui"))}</div>;
        })}
      </div>

      {removidas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-muted-foreground">
            {removidas.length} {removidas.length > 1 ? "atividades removidas" : "atividade removida"} ·{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setVerRemovidas(v => !v)}>{verRemovidas ? "ocultar" : "mostrar"}</button>
          </p>
          {verRemovidas && (
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
    </div>
  );
}
