import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, ClipboardCheck, Copy, ExternalLink, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchEmailDaEquipe, type GerProject, type Modulo01Estado } from "@/lib/gerenciamento";
import { copiarEmail } from "@/lib/emailOutlook";
import {
  assuntoChecklist, emailHtmlChecklist, emailTextoChecklist, linhasProjetoChecklist, mailtoChecklist, outlookWebChecklist,
} from "@/lib/checklistEmail";
import { Fixo, Grupo, PassoColar } from "./DataCenterEmailDialog";

const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/**
 * E-mail ao GP do projeto com o checklist liberado: o destinatário vem da Equipe (o GP do
 * projeto), o resto do cadastro e do checklist. Copia e abre o Outlook, como os outros e-mails.
 */
export function ChecklistEmailDialog({ open, onOpenChange, project, estado, remetente, onCopiado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  estado: Modulo01Estado;
  remetente: string;
  /** O e-mail foi copiado: registra o envio ao GP. */
  onCopiado: () => void;
}) {
  const [para, setPara] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [doCadastro, setDoCadastro] = useState(false);
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!open) return;
    setConferido(false); setAberto(false); setBuscando(true);
    let vivo = true;
    fetchEmailDaEquipe(project.manager_id).then(email => {
      if (!vivo) return;
      setDoCadastro(!!email);
      setPara(atual => atual || email || "");
    }).finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
  }, [open, project.manager_id]);

  const html = emailHtmlChecklist(project, estado, remetente);
  const texto = emailTextoChecklist(project, estado, remetente);
  const paraOk = emailValido(para);
  const pronto = paraOk && conferido;

  const copiar = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie."); return; }
    onCopiado();
    toast.success("E-mail ao GP copiado. No Outlook, clique no corpo e cole (Ctrl+V).");
  };
  const abrirOutlook = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar o e-mail. Tente de novo."); return; }
    onCopiado();
    window.location.href = mailtoChecklist(para, project, estado);
    setAberto(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />E-mail ao GP: checklist liberado</DialogTitle>
          <DialogDescription>Avise o Gerente de Projetos que o checklist de pré-requisitos foi liberado. Confira a prévia e abra no Outlook já com destinatário e assunto.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          {/* Destinatário e dados */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Grupo titulo="Para">
              <div>
                <Label className="text-xs" htmlFor="chk-para">E-mail do Gerente de Projetos *</Label>
                <div className="relative mt-1.5">
                  <Input id="chk-para" type="email" className="h-9 pr-8" placeholder="nome@itstransdata.com" value={para}
                    onChange={ev => { setPara(ev.target.value); setDoCadastro(false); setConferido(false); }} />
                  {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" aria-label="Buscando o e-mail do GP" />}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {buscando ? "Buscando o e-mail do GP na Equipe…"
                    : doCadastro ? <>E-mail de <b className="font-semibold text-foreground">{project.manager?.full_name}</b> na Equipe.</>
                    : <>Sem o e-mail do GP {project.manager?.full_name ? <b className="font-semibold text-foreground">{project.manager.full_name}</b> : ""} na Equipe: digite o e-mail.</>}
                </p>
                {para && !paraOk && <p className="mt-1 text-[11px] text-destructive">Confira o e-mail: falta o @ ou o domínio.</p>}
              </div>
            </Grupo>
            <Grupo titulo="Do cadastro do projeto">
              {linhasProjetoChecklist(project).map(l => <Fixo key={l.label} label={l.label} valor={l.valor} />)}
            </Grupo>
          </div>

          {/* Prévia */}
          <div className="border-t bg-muted/40 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prévia do e-mail</p>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="min-w-0 break-words font-medium">{para.trim() || "—"}</dd></div>
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assuntoChecklist(project, estado)}</dd></div>
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
              <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>Agora cole no Outlook:</b> clique no corpo do e-mail, acima da sua assinatura, e use <b>Ctrl+V</b>. Depois é só enviar.</p>
              <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebChecklist(para, project, estado)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
              <Button variant="outline" size="sm" className="h-9" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
              <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {!paraOk ? (
                <p className="flex min-w-0 flex-1 basis-72 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta: e-mail do Gerente de Projetos.</span>
                </p>
              ) : (
                <label htmlFor="chk-conferi" className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <Checkbox id="chk-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
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
