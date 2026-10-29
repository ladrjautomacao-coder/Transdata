import { useEffect } from "react";
import { AlertTriangle, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { etapaNome, etapaNum, fmtD, nomeCurto, openUpstream, predOf, succOf, type GoAtividade, type GoDados, type GoStatus } from "@/lib/grandesOperacoes/dados";
import { COR_STATUS } from "@/lib/grandesOperacoes/ui";
import { Dot, StatusPill, StatusSelect } from "./GoShared";

function Campo({ label, valor, mono = false, largo = false, vazio = "—" }: { label: string; valor: string | null | undefined; mono?: boolean; largo?: boolean; vazio?: string }) {
  const sem = valor == null || valor === "";
  return (
    <div className={largo ? "col-span-2" : ""}>
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

/**
 * Detalhes da atividade selecionada, num painel à direita que não tampa o quadro inteiro (o que
 * vem antes e depois continua destacado nele). Quem pode editar troca o status aqui.
 */
export function DetalheGO({ dados, act, onSelect, onFechar, podeEditar, onStatus }: {
  dados: GoDados;
  act: number | null;
  onSelect: (id: number) => void;
  onFechar: () => void;
  podeEditar: boolean;
  onStatus: (id: number, status: GoStatus) => void;
}) {
  const a = act != null ? dados.act.get(act) : undefined;
  useEffect(() => {
    if (!a) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=listbox]")) onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [a, onFechar]);
  if (!a) return null;

  const preds = predOf(dados, a), succs = succOf(dados, a), up = openUpstream(dados, a);
  const ordemErrada = a.status === "concluido" && preds.some(p => p.status !== "concluido" && p.status !== "removido");
  const p = dados.proj.get(a.projeto_id);
  // mais recente em cima, como no original
  const obs = a.observacoes.slice().reverse();
  const atualizado = a.atualizado_em ? new Date(a.atualizado_em) : null;

  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="go-det-titulo"
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border/60 bg-card shadow-2xl duration-300 animate-in slide-in-from-right sm:max-w-[440px] motion-reduce:animate-none">
      <span aria-hidden className={`h-1.5 shrink-0 ${COR_STATUS[a.status].barra}`} />
      <div className="flex items-start gap-3 border-b border-border/60 px-5 pb-4 pt-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-muted-foreground">{nomeCurto(p)} · {etapaNum(a.codigo)} {etapaNome(dados, a)}</p>
          <p className="mt-1 font-mono text-[12px] font-semibold text-primary">{a.codigo}</p>
          <h2 id="go-det-titulo" className="text-lg font-bold leading-snug">{a.titulo}</h2>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" onClick={onFechar} aria-label="Fechar os detalhes"><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <span className="text-[12px] font-semibold text-muted-foreground">Status</span>
          {podeEditar ? <StatusSelect status={a.status} codigo={a.codigo} onChange={s => onStatus(a.id, s)} className="h-8 px-3 text-[12px]" /> : <StatusPill status={a.status} />}
          <span className="ml-auto text-[12px] text-muted-foreground">{a.data_realizada ? `Realizado em ${fmtD(a.data_realizada)}` : ""}</span>
        </div>

        {up.length > 0 && a.status !== "concluido" && a.status !== "removido" && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-100">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><b>Ainda falta antes desta ({up.length}):</b> {up.map(u => u.codigo).join(", ")}</span>
          </p>
        )}
        {ordemErrada && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Marcada como concluída antes de uma predecessora. Confira se a ligação ainda faz sentido.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
          <Campo label="Responsável" valor={a.responsavel} />
          <Campo label="Tempo estimado" valor={a.duracao} />
          <Campo label="Início previsto" valor={fmtD(a.data_prevista)} />
          <Campo label="Realizado em" valor={fmtD(a.data_realizada)} />
          <Campo label="Objetivo" valor={a.objetivo} largo vazio="Sem objetivo registrado" />
        </dl>

        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground"><i className="h-2.5 w-2.5 rounded-sm bg-primary/70" />Vem antes (predecessoras)</p>
            <Cadeia itens={preds} vazio="Não depende de nenhuma atividade." onSelect={onSelect} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500" />Vem depois (dependem desta)</p>
            <Cadeia itens={succs} vazio="Nenhuma atividade depende desta." onSelect={onSelect} />
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Observações <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-foreground">{a.observacoes.length}</span>
          </p>
          {obs.length ? (
            <ol className="relative flex flex-col gap-3 border-l-2 border-border pl-4">
              {obs.map(o => (
                <li key={o.id} className="relative">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary/70" />
                  <p className="text-[11.5px] font-semibold text-muted-foreground">{o.data ? fmtD(o.data) : "Da planilha original"}</p>
                  <p className="whitespace-pre-line text-[13px]">{o.texto}</p>
                </li>
              ))}
            </ol>
          ) : <p className="text-[12.5px] text-muted-foreground">Nenhuma observação ainda.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-5 py-2.5 text-[12px] text-muted-foreground">
        <span>{atualizado ? `Atualizado em ${atualizado.toLocaleDateString("pt-BR")} às ${atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
        <span>{podeEditar ? "Status: aqui ou arrastando no quadro" : "Somente leitura"}</span>
      </div>
    </aside>
  );
}
