import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GerProject } from "@/lib/gerenciamento";
import { errorMessage } from "@/lib/implantationScheduling";
import type { Modulo02Estado } from "@/lib/modulo02";
import { CARGO_PADRAO_TERMO, LOCAL_PADRAO_TERMO, camposTermo, faltandoTermo, montarTermo } from "@/lib/termoCartoes";
import { CartoesTermo } from "./CartoesTermo";
import { Fixo, Grupo } from "./DataCenterEmailDialog";

/**
 * Termo de Recebimento de Cartões: o GP confere os cartões e quem assina, vê a prévia do PDF
 * (refeita a cada mudança) e baixa. Baixar registra o termo como gerado.
 */
export function TermoCartoesDialog({ open, onOpenChange, project, estado, onCartoes, onTermo, onBaixado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  estado: Modulo02Estado;
  onCartoes: (patch: Partial<Modulo02Estado["cartoes"]>) => void;
  onTermo: (patch: Partial<Modulo02Estado["termo"]>) => void;
  onBaixado: () => void;
}) {
  const dados = useMemo(() => montarTermo(project, estado), [project, estado]);
  const chave = JSON.stringify(dados);
  const falta = faltandoTermo(project, estado);
  const f = camposTermo(project, estado);
  const t = estado.termo;

  // prévia: o PDF é refeito ~0,5 s depois da última mudança; a anterior fica na tela enquanto isso
  const [url, setUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setGerando(true); setErro(null);
    const timer = window.setTimeout(() => {
      import("@/lib/termoPdf")
        .then(m => m.gerarTermoPdf(JSON.parse(chave)))
        .then(blob => {
          if (!vivo) return;
          const novo = URL.createObjectURL(blob);
          setUrl(antigo => { if (antigo) URL.revokeObjectURL(antigo); return novo; });
        })
        .catch(e => { if (vivo) setErro(errorMessage(e)); })
        .finally(() => { if (vivo) setGerando(false); });
    }, 500);
    return () => { vivo = false; clearTimeout(timer); };
  }, [open, chave, tentativa]);
  // fechou: libera o PDF da memória
  useEffect(() => { if (!open) setUrl(antigo => { if (antigo) URL.revokeObjectURL(antigo); return null; }); }, [open]);

  const pronto = !!url && !gerando && falta.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Termo de Recebimento de Cartões</DialogTitle>
          <DialogDescription>Confira os cartões e quem recebe. O cliente assina o termo ao receber os cartões na reunião de PE.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:overflow-hidden">
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Grupo titulo="Do cadastro do projeto">
              <Fixo label="Projeto" valor={dados.projeto} />
              <Fixo label="Empresa" valor={dados.cliente} />
            </Grupo>
            <Grupo titulo="Cartões recebidos">
              <CartoesTermo project={project} cartoes={estado.cartoes} onChange={onCartoes} />
            </Grupo>
            <Grupo titulo="Assinatura">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs" htmlFor="termo-recebedor">Recebido por *</Label>
                  <Input id="termo-recebedor" className="mt-1.5 h-9" placeholder="Nome de quem recebe" value={t.recebedor} onChange={ev => onTermo({ recebedor: ev.target.value })} />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="termo-cargo">Cargo</Label>
                  <Input id="termo-cargo" className="mt-1.5 h-9" placeholder={CARGO_PADRAO_TERMO} value={t.cargo} onChange={ev => onTermo({ cargo: ev.target.value })} />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="termo-local">Local</Label>
                  <Input id="termo-local" className="mt-1.5 h-9" placeholder={LOCAL_PADRAO_TERMO} value={t.local} onChange={ev => onTermo({ local: ev.target.value })} />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="termo-data">Data *</Label>
                  <Input id="termo-data" type="date" className="mt-1.5 h-9" value={f.data} onChange={ev => onTermo({ data: ev.target.value })} />
                  {!t.data && f.data && <p className="mt-1 text-[11px] text-muted-foreground">A data da reunião de PE.</p>}
                </div>
              </div>
            </Grupo>
          </div>

          {/* Prévia do PDF */}
          <div className="flex min-h-[520px] flex-col border-t bg-muted/40 p-3 sm:p-4 lg:min-h-0 lg:border-l lg:border-t-0">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Prévia do termo {gerando && url && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Atualizando a prévia" />}
            </p>
            {erro ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                <span className="flex-1">Não foi possível gerar o termo. {erro}</span>
                <Button size="sm" variant="outline" onClick={() => setTentativa(n => n + 1)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
              </div>
            ) : !url ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" />Gerando o termo…</div>
            ) : (
              <iframe src={url} title="Prévia do Termo de Recebimento de Cartões" className="min-h-0 w-full flex-1 rounded-lg border border-border/60 bg-white" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t bg-card px-5 py-3.5">
          {falta.length > 0
            ? <p className="flex min-w-0 flex-1 basis-60 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Falta: {falta.join(", ")}.</p>
            : <p className="min-w-0 flex-1 basis-60 text-[12.5px] text-muted-foreground">Baixe, imprima e leve para o cliente assinar na reunião de PE. No celular a prévia pode não aparecer: use "Baixar PDF".</p>}
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button className="h-9" disabled={!pronto} asChild={pronto}>
            {pronto
              ? <a href={url} download={`${dados.arquivo}.pdf`} onClick={onBaixado}><Download className="mr-1.5 h-4 w-4" />Baixar PDF</a>
              : <span><Download className="mr-1.5 h-4 w-4" />Baixar PDF</span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
