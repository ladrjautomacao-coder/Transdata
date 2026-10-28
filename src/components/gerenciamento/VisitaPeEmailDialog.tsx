import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Mail, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copiarEmail } from "@/lib/emailOutlook";
import { mailtoPara, outlookWebPara } from "@/lib/visitaPeEmail";
import { Fixo, Grupo, PassoColar } from "./DataCenterEmailDialog";

const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/**
 * E-mail da visita de PE (custos ao cliente, comprovantes ao Financeiro): destinatário digitado
 * (fica salvo no módulo), dados do módulo só leitura, prévia e cópia para o Outlook.
 */
export function VisitaPeEmailDialog({
  open, onOpenChange, icone, titulo, descricao, paraLabel, paraPlaceholder, para, onPara, linhas, assunto, html, texto, anexos, onCopiado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  icone: ReactNode;
  titulo: string;
  descricao: string;
  paraLabel: string;
  paraPlaceholder: string;
  para: string;
  onPara: (para: string) => void;
  /** O que vai no e-mail, como o GP preencheu no módulo. */
  linhas: { label: string; valor: string }[];
  assunto: string;
  html: string;
  texto: string;
  /** Lembrete de anexar arquivos no Outlook antes de enviar (ex.: os comprovantes). */
  anexos?: string;
  /** O e-mail foi copiado. */
  onCopiado: () => void;
}) {
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (open) { setConferido(false); setAberto(false); } }, [open]);

  const paraOk = emailValido(para);
  const pronto = paraOk && conferido;

  const copiar = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie."); return; }
    onCopiado();
    toast.success("E-mail copiado. No Outlook, clique no corpo e cole (Ctrl+V).");
  };
  const abrirOutlook = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar o e-mail. Tente de novo."); return; }
    onCopiado();
    window.location.href = mailtoPara(para, assunto);
    setAberto(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">{icone}{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          {/* Destinatário e dados */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Grupo titulo="Para">
              <div>
                <Label className="text-xs" htmlFor="pe-email-para">{paraLabel} *</Label>
                <Input id="pe-email-para" type="email" className="mt-1.5 h-9" placeholder={paraPlaceholder} value={para}
                  onChange={ev => { onPara(ev.target.value); setConferido(false); }} />
                <p className="mt-1 text-[11px] text-muted-foreground">Fica salvo no módulo para os próximos envios.</p>
                {para && !paraOk && <p className="mt-1 text-[11px] text-destructive">Confira o e-mail: falta o @ ou o domínio.</p>}
              </div>
            </Grupo>
            <Grupo titulo="Do módulo">
              {linhas.map(l => <Fixo key={l.label} label={l.label} valor={l.valor} origem="do módulo" />)}
            </Grupo>
            {anexos && (
              <p className="flex items-start gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-[12.5px] text-sky-800 dark:text-sky-200">
                <Paperclip className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{anexos}</span>
              </p>
            )}
          </div>

          {/* Prévia */}
          <div className="border-t bg-muted/40 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prévia do e-mail</p>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="min-w-0 break-words font-medium">{para.trim() || "—"}</dd></div>
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assunto}</dd></div>
              </dl>
              {/* o e-mail é branco como no Outlook, também no tema escuro */}
              <div className="overflow-x-auto bg-white p-4" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        </div>

        {/* Rodapé: conferir e abrir no Outlook */}
        <div className="border-t bg-card px-5 py-3.5">
          {aberto ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="min-w-0 flex-1 basis-72 text-[13px]">
                <b>Agora cole no Outlook:</b> clique no corpo do e-mail, acima da sua assinatura, e use <b>Ctrl+V</b>.{anexos ? " Anexe os arquivos e envie." : " Depois é só enviar."}
              </p>
              <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebPara(para, assunto)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
              <Button variant="outline" size="sm" className="h-9" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
              <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {!paraOk ? (
                <p className="flex min-w-0 flex-1 basis-72 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta: {paraLabel.toLowerCase()}.</span>
                </p>
              ) : (
                <label htmlFor="pe-email-conferi" className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <Checkbox id="pe-email-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
                  Conferi as informações da prévia
                </label>
              )}
              <Button variant="outline" className="h-9" disabled={!pronto} onClick={copiar}><Copy className="mr-1.5 h-4 w-4" />Copiar e-mail</Button>
              <Button className="h-9" disabled={!pronto} onClick={abrirOutlook}><Mail className="mr-1.5 h-4 w-4" />Copiar e abrir no Outlook</Button>
              {pronto && <PassoColar />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
