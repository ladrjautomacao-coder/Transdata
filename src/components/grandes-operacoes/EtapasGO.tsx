import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { etapaStatus, etapasOf, stats, subLevel, type GoAtividade, type GoDados, type GoRel } from "@/lib/grandesOperacoes/dados";
import { Barra, RelTag, StatusPill } from "./GoShared";

/**
 * Visão Etapas: projeto → etapa → atividades, que abrem e fecham. Subatividades (1.4.6.1) vêm
 * logo após a mãe, com recuo; cada linha mostra a última observação.
 */
export function EtapasGO({ dados, visiveis, act, onSelect, umProjeto, rel }: {
  dados: GoDados;
  visiveis: GoAtividade[];
  act: number | null;
  onSelect: (id: number) => void;
  /** Painel de um projeto só: ele já começa aberto. */
  umProjeto: boolean;
  rel: GoRel;
}) {
  // o que o GP abriu ou fechou fica como está ao trocar de filtro
  const [abertoProj, setAbertoProj] = useState<Record<number, boolean>>({});
  const [abertaEt, setAbertaEt] = useState<Record<number, boolean>>({});
  const projs: number[] = [];
  visiveis.forEach(a => { if (!projs.includes(a.projeto_id)) projs.push(a.projeto_id); });

  if (!projs.length) return <div className="rounded-xl border border-border/60 bg-card px-4 py-9 text-center text-sm text-muted-foreground">Nenhuma atividade com esse filtro.</div>;

  return (
    <div className="flex flex-col gap-3">
      {projs.map((pid, pi) => {
        const pl = visiveis.filter(a => a.projeto_id === pid), s = stats(pl);
        const aberto = abertoProj[pid] ?? (umProjeto || pi === 0);
        return (
          <section key={pid} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <button type="button" aria-expanded={aberto} onClick={() => setAbertoProj(o => ({ ...o, [pid]: !aberto }))}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-muted/40">
              <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`} />
              <h3 className="min-w-0 flex-1 text-[15px] font-bold">{dados.proj.get(pid)?.nome}</h3>
              <span className="w-32"><Barra s={s} /></span>
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{s.done}/{s.total} · {s.pct}%</span>
            </button>
            {aberto && (
              <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 p-2.5">
                {etapasOf(dados, pl).map(e => {
                  const es = stats(e.acts), st = etapaStatus(e.acts);
                  const resps = Array.from(new Set(e.acts.map(a => a.responsavel).filter(Boolean))).join(", ");
                  const aberta = abertaEt[e.key] ?? e.acts.some(a => a.id === act);
                  return (
                    <div key={e.key} className={`overflow-hidden rounded-lg border bg-card ${rel.etHl.has(e.key) ? "border-orange-500/50" : "border-border/60"}`}>
                      <button type="button" aria-expanded={aberta} onClick={() => setAbertaEt(o => ({ ...o, [e.key]: !aberta }))}
                        className="grid w-full grid-cols-[16px_44px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-3 py-2.5 text-left hover:bg-muted/40 md:grid-cols-[16px_44px_minmax(0,1fr)_auto_120px_48px_minmax(0,180px)]">
                        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${aberta ? "rotate-90" : ""}`} />
                        <span className="font-mono text-[11.5px] text-muted-foreground">{e.num}</span>
                        <span className="min-w-0 truncate text-[13.5px] font-semibold">{e.nome}</span>
                        <StatusPill status={st} />
                        <span className="hidden md:block"><span className="block h-1.5 overflow-hidden rounded-full bg-muted"><i className="block h-full bg-emerald-500" style={{ width: `${es.pct}%` }} /></span></span>
                        <span className="hidden text-[12px] tabular-nums text-muted-foreground md:block">{es.done}/{es.total}</span>
                        <span className="hidden truncate text-[12px] text-muted-foreground md:block" title={resps}>{resps}</span>
                      </button>
                      {aberta && (
                        <ul className="divide-y divide-border/50 border-t border-border/60">
                          {e.acts.map(a => {
                            const lv = subLevel(a.codigo), ultima = a.observacoes[a.observacoes.length - 1];
                            const isP = rel.pred.has(a.id), isS = rel.succ.has(a.id), sel = act === a.id;
                            return (
                              <li key={a.id}>
                                <button type="button" onClick={() => onSelect(a.id)}
                                  className={`grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-2 pr-3 text-left transition-colors md:grid-cols-[52px_minmax(0,1fr)_minmax(0,160px)_auto] ${sel ? "bg-primary/[0.07]" : isP ? "bg-primary/[0.05]" : isS ? "bg-orange-500/[0.06]" : "hover:bg-muted/40"} ${a.status === "removido" || a.status === "concluido" ? "text-muted-foreground" : ""}`}
                                  style={{ paddingLeft: 12 + lv * 20 }}>
                                  <span className="pt-px font-mono text-[11.5px] text-muted-foreground">{a.codigo}</span>
                                  <span className="min-w-0">
                                    <span className={`flex flex-wrap items-center gap-1.5 text-[13px] ${a.status === "removido" ? "line-through" : ""}`}>{a.titulo} <RelTag pred={isP} succ={isS} /></span>
                                    {ultima && <small className="mt-0.5 block truncate text-[11.5px] text-muted-foreground" title={ultima.texto}>{ultima.texto}</small>}
                                  </span>
                                  <span className="hidden truncate text-[12px] text-muted-foreground md:block">{a.responsavel}</span>
                                  <StatusPill status={a.status} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
