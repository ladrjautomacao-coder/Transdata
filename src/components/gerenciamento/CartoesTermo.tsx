import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { GerProject } from "@/lib/gerenciamento";
import type { Modulo02Estado } from "@/lib/modulo02";
import { cartoesDoTermo, descricaoCartao, frotaDoProjeto, qtdTermo, type CartaoTermo } from "@/lib/termoCartoes";

type Cartoes = Modulo02Estado["cartoes"];

/**
 * Os cartões que vão para a reunião de PE (e para o Termo de Recebimento): os do modelo com
 * a quantidade ajustável e os que o GP acrescenta. `onChange` recebe só o que mudou.
 */
export function CartoesTermo({ project, cartoes, onChange }: {
  project: GerProject;
  cartoes: Cartoes;
  onChange: (patch: Partial<Pick<Cartoes, "ajustes" | "extras">>) => void;
}) {
  const lista = cartoesDoTermo(project, cartoes);
  const frota = frotaDoProjeto(project);
  const total = lista.reduce((n, c) => n + c.quantidade, 0);
  const mudou = Object.keys(cartoes.ajustes ?? {}).length > 0 || (cartoes.extras ?? []).length > 0;

  const quantidade = (c: CartaoTermo, n: number) => {
    const q = Math.max(0, Math.min(9999, Math.round(n) || 0));
    if (c.padrao === null) { onChange({ extras: cartoes.extras.map(x => (x.id === c.id ? { ...x, quantidade: q } : x)) }); return; }
    // voltou ao padrão: sai dos ajustes (o Acesso volta a acompanhar a frota do cadastro)
    const ajustes = { ...cartoes.ajustes };
    if (q === c.padrao) delete ajustes[c.id]; else ajustes[c.id] = q;
    onChange({ ajustes });
  };
  const extra = (id: string, patch: { tipo?: string; destacavel?: boolean }) =>
    onChange({ extras: cartoes.extras.map(x => (x.id === id ? { ...x, ...patch } : x)) });
  const acrescentar = () => onChange({ extras: [...cartoes.extras, { id: `x${Date.now()}`, tipo: "", destacavel: false, quantidade: 1 }] });
  const remover = (id: string) => onChange({ extras: cartoes.extras.filter(x => x.id !== id) });

  return (
    <div className="space-y-2">
      <ul className="divide-y overflow-hidden rounded-lg border border-border/60">
        <li className="hidden grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_32px] gap-3 bg-muted/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Quantidade</span><span>Descrição</span><span>Tipo</span><span />
        </li>
        {lista.map(c => {
          const zerado = c.quantidade === 0;
          const nota = c.id === "acesso"
            ? (frota ? `1 por carro · frota de ${frota} no cadastro` : "Frota não cadastrada: informe a quantidade")
            : c.padrao !== null && c.quantidade !== c.padrao ? `padrão ${qtdTermo(c.padrao)}` : null;
          return (
            <li key={c.id} className={`grid grid-cols-[132px_minmax(0,1fr)_32px] items-center gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_32px] ${zerado ? "bg-muted/40" : ""}`}>
              <div className="col-start-1 row-start-1 flex items-center">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-r-none" disabled={zerado}
                  aria-label={`Diminuir ${c.tipo || "cartão"}`} onClick={() => quantidade(c, c.quantidade - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                <Input inputMode="numeric" aria-label={`Quantidade de ${c.tipo || "cartão"}`} className="h-8 w-14 rounded-none border-x-0 px-1 text-center font-semibold tabular-nums"
                  value={qtdTermo(c.quantidade)} onChange={ev => quantidade(c, Number(ev.target.value.replace(/\D/g, "")))} />
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-l-none"
                  aria-label={`Aumentar ${c.tipo || "cartão"}`} onClick={() => quantidade(c, c.quantidade + 1)}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className={`col-start-2 row-start-1 min-w-0 text-[13px] ${zerado ? "text-muted-foreground line-through" : ""}`}>
                {descricaoCartao(c.destacavel, c.quantidade)}
                {c.padrao === null && (
                  <label className="mt-1 flex w-fit cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground no-underline">
                    <Checkbox checked={c.destacavel} onCheckedChange={v => extra(c.id, { destacavel: v === true })} aria-label="Cartão destacável" />Destacável
                  </label>
                )}
              </div>
              <div className="col-span-2 col-start-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                {c.padrao === null ? (
                  <Input className="h-8" placeholder="Tipo do cartão" aria-label="Tipo do cartão acrescentado" value={c.tipo} onChange={ev => extra(c.id, { tipo: ev.target.value })} />
                ) : (
                  <span className={`text-[13px] font-semibold ${zerado ? "text-muted-foreground line-through" : ""}`}>{c.tipo}</span>
                )}
                {nota && <span className={`block text-[11px] ${c.id === "acesso" && !frota ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{nota}</span>}
              </div>
              <div className="col-start-3 row-start-1 sm:col-start-4">
                {c.padrao === null && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remover ${c.tipo || "cartão acrescentado"}`} onClick={() => remover(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={acrescentar}><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar cartão</Button>
        {mudou && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => onChange({ ajustes: {}, extras: [] })}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Voltar ao padrão
          </Button>
        )}
        <span className="ml-auto text-[12.5px] text-muted-foreground">Total: <b className="tabular-nums text-foreground">{total}</b> {total === 1 ? "cartão" : "cartões"}</span>
      </div>
    </div>
  );
}
