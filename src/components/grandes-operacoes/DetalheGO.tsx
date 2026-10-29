import { forwardRef } from "react";
import { AlertTriangle, MousePointerClick } from "lucide-react";
import { etapaNome, etapaNum, fmtD, openUpstream, predOf, succOf, type GoAtividade, type GoDados } from "@/lib/grandesOperacoes/dados";
import { Dot, StatusPill } from "./GoShared";

function Campo({ label, valor, mono = false, largo = false, vazio = "—" }: { label: string; valor: string | null | undefined; mono?: boolean; largo?: boolean; vazio?: string }) {
  const sem = valor == null || valor === "";
  return (
    <div className={largo ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-line text-[13.5px] ${mono ? "font-mono" : ""} ${sem ? "text-muted-foreground/70" : ""}`}>{sem ? vazio : valor}</dd>
    </div>
  );
}

function Cadeia({ itens, vazio, onSelect }: { itens: GoAtividade[]; vazio: string; onSelect: (id: number) => void }) {
  if (!itens.length) return <p className="text-[12.5px] text-muted-foreground">{vazio}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {itens.map(x => (
        <button key={x.id} type="button" onClick={() => onSelect(x.id)}
          className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-left text-[12.5px] hover:bg-muted/50">
          <Dot status={x.status} /><span className="shrink-0 font-mono text-[11px] text-muted-foreground">{x.codigo}</span>
          <span className="min-w-0 flex-1 truncate" title={x.titulo}>{x.titulo}</span>
        </button>
      ))}
    </div>
  );
}

/** Caixa de detalhes da atividade selecionada (somente leitura nesta etapa). */
export const DetalheGO = forwardRef<HTMLElement, { dados: GoDados; act: number | null; onSelect: (id: number) => void }>(({ dados, act, onSelect }, ref) => {
  const a = act != null ? dados.act.get(act) : undefined;
  if (!a) {
    return (
      <section ref={ref} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
        <MousePointerClick className="h-4 w-4 shrink-0" />Selecione uma atividade no quadro, nas etapas ou no Gantt para ver os detalhes aqui.
      </section>
    );
  }
  const preds = predOf(dados, a), succs = succOf(dados, a), up = openUpstream(dados, a);
  const ordemErrada = a.status === "concluido" && preds.some(p => p.status !== "concluido" && p.status !== "removido");
  const p = dados.proj.get(a.projeto_id);
  // mais recente em cima, como no original
  const obs = a.observacoes.slice().reverse();
  const atualizado = a.atualizado_em ? new Date(a.atualizado_em) : null;

  return (
    <section ref={ref} aria-label="Detalhes da atividade" className="scroll-mt-6 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <p className="text-[12px] text-muted-foreground">{p?.nome} · {etapaNum(a.codigo)} {etapaNome(dados, a)}</p>
        <div className="mt-1 flex flex-wrap items-start gap-3">
          <h2 className="min-w-0 flex-1 text-lg font-bold leading-snug">{a.titulo}</h2>
          <StatusPill status={a.status} />
        </div>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Campo label="Código" valor={a.codigo} mono />
            <Campo label="Responsável" valor={a.responsavel} />
            <Campo label="Etapa" valor={`${etapaNum(a.codigo)} · ${etapaNome(dados, a)}`} />
            <Campo label="Tempo estimado" valor={a.duracao} />
            <Campo label="Início previsto" valor={fmtD(a.data_prevista)} />
            <Campo label="Realizado em" valor={fmtD(a.data_realizada)} />
            <Campo label="Objetivo" valor={a.objetivo} largo vazio="Sem objetivo registrado" />
          </dl>
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
              Observações <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-foreground">{a.observacoes.length}</span>
            </p>
            {obs.length ? (
              <ol className="flex flex-col gap-2">
                {obs.map(o => (
                  <li key={o.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                    <p className="text-[11.5px] font-semibold text-muted-foreground">{o.data ? fmtD(o.data) : "Da planilha original"}</p>
                    <p className="whitespace-pre-line text-[13px]">{o.texto}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-[12.5px] text-muted-foreground">Nenhuma observação ainda.</p>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground"><i className="h-2.5 w-2.5 rounded-sm bg-primary/70" />Vem antes (predecessoras)</p>
            <Cadeia itens={preds} vazio="Não depende de nenhuma atividade." onSelect={onSelect} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500" />Vem depois (dependem desta)</p>
            <Cadeia itens={succs} vazio="Nenhuma atividade depende desta." onSelect={onSelect} />
          </div>
          {up.length > 0 && a.status !== "concluido" && a.status !== "removido" && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-100">
              <b>Ainda falta antes desta ({up.length}):</b> {up.map(u => u.codigo).join(", ")}
            </p>
          )}
          {ordemErrada && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Marcada como concluída antes de uma predecessora. Confira se a ligação ainda faz sentido.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-5 py-2.5 text-[12px] text-muted-foreground">
        <span>{atualizado ? `Atualizado em ${atualizado.toLocaleDateString("pt-BR")} às ${atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
        <span>Somente leitura por enquanto</span>
      </div>
    </section>
  );
});
DetalheGO.displayName = "DetalheGO";
