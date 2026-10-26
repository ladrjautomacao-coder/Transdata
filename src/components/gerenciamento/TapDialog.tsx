import { useEffect, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/implantationScheduling";
import type { DadosTap } from "@/lib/tap";

/**
 * Documento TAP: gera o PDF (a biblioteca só carrega aqui), mostra a prévia e baixa.
 * `dados` é a foto do módulo no momento em que o GP clicou em "Gerar documento TAP".
 */
export function TapDialog({ dados, onOpenChange }: { dados: DadosTap | null; onOpenChange: (open: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!dados) return;
    let vivo = true, gerado: string | null = null;
    setUrl(null); setErro(null);
    import("@/lib/tapPdf")
      .then(m => m.gerarTapPdf(dados))
      .then(blob => { if (!vivo) return; gerado = URL.createObjectURL(blob); setUrl(gerado); })
      .catch(e => { if (vivo) setErro(errorMessage(e)); });
    return () => { vivo = false; if (gerado) URL.revokeObjectURL(gerado); };
  }, [dados, tentativa]);

  const arquivo = dados ? `TAP-${dados.codigo}.pdf` : "TAP.pdf";

  return (
    <Dialog open={!!dados} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Documento TAP</DialogTitle>
          <DialogDescription>
            Termo de Abertura do Projeto{dados ? ` · ${dados.cliente} · versão ${dados.versao}` : ""}. Confira a prévia e baixe o PDF para assinar e guardar na pasta do projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-muted/40 p-3 sm:p-4">
          {erro ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
              <span className="flex-1">Não foi possível gerar o documento. {erro}</span>
              <Button size="sm" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
            </div>
          ) : !url ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />Gerando o documento…
            </div>
          ) : (
            <iframe src={url} title="Prévia do documento TAP" className="h-full w-full rounded-lg border border-border/60 bg-white" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t bg-card px-5 py-3.5">
          <p className="min-w-0 flex-1 basis-60 text-[12.5px] text-muted-foreground">
            No celular a prévia pode não aparecer: use "Baixar PDF". Para assinar, imprima ou use uma assinatura digital.
          </p>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button className="h-9" disabled={!url} asChild={!!url}>
            {url ? <a href={url} download={arquivo}><Download className="mr-1.5 h-4 w-4" />Baixar PDF</a> : <span><Download className="mr-1.5 h-4 w-4" />Baixar PDF</span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
