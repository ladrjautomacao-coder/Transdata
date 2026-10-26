import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, ClipboardList, Copy, ExternalLink, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GerProject } from "@/lib/gerenciamento";
import { copiarEmail } from "@/lib/emailOutlook";
import { faltandoPedido, htmlPedido, textoPedido, type LinhaPedido, type PedidoSelo } from "@/lib/pedidoSelo";
import { Grupo } from "./DataCenterEmailDialog";

/** Um item do pedido: só leitura (vem do cadastro ou é padrão), com cópia só do valor. */
function Item({ l }: { l: LinhaPedido }) {
  const copiarValor = async () => {
    try { await navigator.clipboard.writeText(l.valor ?? ""); toast.success(`${l.label} copiado.`); }
    catch { toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."); }
  };
  return (
    <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] ${l.valor ? "bg-muted/60" : "border border-amber-500/40 bg-amber-500/10"}`}>
      {l.valor
        ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />}
      <span className="w-[40%] shrink-0 leading-tight">
        <span className="block text-muted-foreground">{l.label}</span>
        {l.valor && <span className="block text-[10.5px] text-muted-foreground/80">{l.origem === "padrao" ? "padrão" : "do cadastro"}</span>}
      </span>
      {l.valor ? (
        <>
          {/* códigos longos quebram em qualquer ponto em vez de sumir com reticências */}
          <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{l.valor}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copiarValor} aria-label={`Copiar ${l.label}`} title="Copiar só este valor">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <span className="min-w-0 flex-1 text-[12px] font-semibold text-amber-800 dark:text-amber-200">Falta no cadastro</span>
      )}
    </div>
  );
}

/**
 * Pedido com selo para o sistema de pedidos: tudo vem do cadastro do projeto; o GP confere,
 * copia e cola no sistema. Copiar o pedido conclui a atividade.
 */
export function PedidoSeloDialog({ open, onOpenChange, project, pedido, onCopiado, onAtualizarProjeto }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  pedido: PedidoSelo;
  /** O GP copiou o pedido: a atividade fica feita. */
  onCopiado: () => void;
  /** Relê o cadastro do projeto (depois de completar o que falta em outra aba). */
  onAtualizarProjeto: () => Promise<unknown>;
}) {
  const [conferido, setConferido] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  useEffect(() => { if (open) { setConferido(false); setCopiado(false); } }, [open]);

  const falta = faltandoPedido(pedido);
  const faltam = pedido.linhas.filter(l => !l.valor);
  const html = htmlPedido(pedido);
  const texto = textoPedido(pedido);
  const pronto = falta.length === 0 && conferido;

  const atualizar = async () => {
    setAtualizando(true);
    try { await onAtualizarProjeto(); setConferido(false); }
    catch { toast.error("Não foi possível reler o cadastro do projeto. Tente de novo."); }
    finally { setAtualizando(false); }
  };
  const copiar = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie."); return; }
    onCopiado();
    setCopiado(true);
    toast.success("Pedido copiado e atividade marcada como feita. Cole no sistema de pedidos (Ctrl+V).");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Pedido no sistema de pedidos</DialogTitle>
          <DialogDescription>
            Selo <b className="font-semibold text-foreground">{pedido.selo}</b>. Tudo vem do cadastro do projeto: confira, copie e cole no sistema de pedidos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden">
          {/* Itens */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Grupo titulo="Itens do pedido">
              <div className="space-y-1.5">{pedido.linhas.map(l => <Item key={l.label} l={l} />)}</div>
              <p className="text-[11px] text-muted-foreground">Se o sistema de pedidos tiver um campo para cada item, use o botão de copiar ao lado de cada valor.</p>
            </Grupo>
            {faltam.length > 0 && (
              <div className="space-y-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px]">
                <div className="flex items-start gap-1.5 text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <div>
                    <b>Falta no cadastro do projeto.</b> Abra o projeto, clique em Editar, preencha e salve. Depois clique em Atualizar.
                    <ul className="mt-1 list-disc pl-4">
                      {faltam.map(l => <li key={l.label}><b>{l.label}:</b> preencha {l.comoPreencher}.</li>)}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-5">
                  <Button variant="outline" size="sm" className="h-8" asChild>
                    <a href={`/projetos/${project.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir o cadastro do projeto</a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={atualizar} disabled={atualizando}>
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`} />{atualizando ? "Atualizando…" : "Atualizar"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Prévia */}
          <div className="space-y-4 border-t bg-muted/40 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prévia: num campo com formatação</p>
              {/* branco como no sistema, também no tema escuro */}
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Num campo de texto simples, cola assim</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-card p-4 font-mono text-[12px] leading-relaxed">{texto}</pre>
            </div>
          </div>
        </div>

        {/* Rodapé: conferir e copiar */}
        <div className="border-t bg-card px-5 py-3.5">
          {copiado ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>Agora cole no sistema de pedidos:</b> clique no campo da descrição e use <b>Ctrl+V</b>. A atividade já ficou como feita; o nº do pedido pode ser informado depois.</p>
              <Button variant="outline" size="sm" className="h-9" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
              <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {falta.length > 0 ? (
                <p className="flex min-w-0 flex-1 basis-72 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta no cadastro: {falta.join(", ")}.</span>
                </p>
              ) : (
                <label htmlFor="pedido-conferi" className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <Checkbox id="pedido-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
                  Conferi as informações da prévia
                </label>
              )}
              <Button className="h-9" disabled={!pronto} onClick={copiar}><Copy className="mr-1.5 h-4 w-4" />Copiar pedido</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
