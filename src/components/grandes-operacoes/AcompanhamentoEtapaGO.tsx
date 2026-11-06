import { useEffect, useState } from "react";
import { Loader2, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { atvsDe, etapaNum, mensagemGo, nomeCurto, registrarAcompanhamento, type GoDados, type GoObsEtapa } from "@/lib/grandesOperacoes/dados";

const quando = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * Acompanhamento de uma etapa: o histórico de observações (data, hora e quem escreveu), o mais
 * recente em cima. O que foi registrado não muda depois; quem pode editar o Hub registra mais.
 */
export function AcompanhamentoEtapaGO({ dados, etapaId, podeEditar, onFechar, onRegistrado }: {
  dados: GoDados;
  /** Etapa aberta (null: fechado). */
  etapaId: number | null;
  podeEditar: boolean;
  onFechar: () => void;
  onRegistrado: (o: GoObsEtapa) => void;
}) {
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  useEffect(() => { setTexto(""); }, [etapaId]);
  const etapa = etapaId != null ? dados.etapa.get(etapaId) : undefined;
  const lista = etapaId != null ? dados.obsEtapa.get(etapaId) ?? [] : [];
  const primeira = etapa ? atvsDe(dados, [etapa.projeto_id]).find(a => a.etapa_id === etapa.id) : undefined;
  const num = primeira ? etapaNum(primeira.codigo) : "";

  const registrar = async () => {
    if (!etapa || !texto.trim()) return;
    setGravando(true);
    try {
      onRegistrado(await registrarAcompanhamento(etapa.id, texto));
      setTexto("");
      toast.success("Acompanhamento registrado");
    } catch (err) {
      toast.error("Não foi possível registrar o acompanhamento.", { description: mensagemGo(err) });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Dialog open={!!etapa} onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">Acompanhamento da etapa</p>
          <DialogTitle className="flex items-baseline gap-2">{num && <span className="font-mono text-sm text-muted-foreground">{num}</span>}{etapa?.nome}</DialogTitle>
          <DialogDescription>{nomeCurto(etapa ? dados.proj.get(etapa.projeto_id) : undefined)} · registros com data, hora e quem escreveu. O que é registrado fica no histórico e não muda depois.</DialogDescription>
        </DialogHeader>

        {podeEditar && (
          <div>
            <Label htmlFor="go-acomp-texto" className="text-xs">Novo registro</Label>
            <Textarea id="go-acomp-texto" className="mt-1.5" rows={3} value={texto} onChange={e => setTexto(e.target.value)}
              placeholder="O que aconteceu, o que foi combinado, o que falta…"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void registrar(); }} />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Ctrl+Enter também registra.</span>
              <Button size="sm" className="ml-auto" onClick={() => void registrar()} disabled={gravando || !texto.trim()}>
                {gravando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Registrar
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Histórico <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-foreground">{lista.length}</span>
          </p>
          {lista.length ? (
            <ol className="relative flex flex-col gap-3 border-l-2 border-border pl-4">
              {lista.map(o => (
                <li key={o.id} className="relative">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary/70" />
                  <p className="text-[11.5px] font-semibold text-muted-foreground">{quando(o.criado_em)}{o.autor_nome ? ` · ${o.autor_nome}` : ""}</p>
                  <p className="whitespace-pre-line text-[13px]">{o.texto}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquareText className="h-4 w-4" /></span>
              {podeEditar ? "Nenhum registro ainda. Escreva acima o primeiro acompanhamento desta etapa." : "Nenhum registro de acompanhamento nesta etapa ainda."}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
