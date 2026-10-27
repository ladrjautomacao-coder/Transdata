import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Copy, Database, ExternalLink, Lock, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GerProject } from "@/lib/gerenciamento";
import { copiarEmail } from "@/lib/emailOutlook";
import { temCnpj } from "@/lib/dataCenterEmail";
import {
  CODIGO_BD_DESTINATARIO, assuntoCodigoBd, emailHtmlCodigoBd, emailTextoCodigoBd, faltandoCodigoBd, linhasCodigoBd, mailtoCodigoBd, outlookWebCodigoBd,
} from "@/lib/codigoBd";
import { Fixo, Grupo, PassoColar } from "./DataCenterEmailDialog";

/**
 * E-mail do cadastro do código BD: tudo vem do cadastro do projeto. O GP confere, copia e abre
 * o Outlook com destinatário e assunto prontos; o corpo formatado vai copiado para colar.
 */
export function CodigoBdEmailDialog({ open, onOpenChange, project, gp, onCopiado, onAtualizarProjeto }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  gp: string;
  /** O GP copiou o e-mail: a atividade passa a aguardar o código BD. */
  onCopiado: () => void;
  /** Relê o cadastro do projeto (depois de completar o CNPJ em outra aba). */
  onAtualizarProjeto: () => Promise<unknown>;
}) {
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  useEffect(() => { if (open) { setConferido(false); setAberto(false); } }, [open]);

  const falta = faltandoCodigoBd(project);
  const html = emailHtmlCodigoBd(project, gp);
  const texto = emailTextoCodigoBd(project, gp);
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
    toast.success("E-mail copiado. No Outlook, clique no corpo e cole (Ctrl+V). Depois anote o código BD que voltar.");
  };
  const abrirOutlook = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar o e-mail. Tente de novo."); return; }
    onCopiado();
    window.location.href = mailtoCodigoBd(project);
    setAberto(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />E-mail do cadastro do código BD</DialogTitle>
          <DialogDescription>Tudo vem do cadastro do projeto. Confira a prévia e abra no Outlook já com destinatário e assunto; quando o código BD voltar, anote na atividade.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          {/* Itens do e-mail */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Grupo titulo="Do cadastro do projeto">
              {linhasCodigoBd(project).map(l => l.label === "CNPJ" && !temCnpj(project) ? null : <Fixo key={l.label} label={l.label} valor={l.valor} />)}
              {!temCnpj(project) && (
                <div className="space-y-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px]">
                  <p className="flex items-start gap-1.5 text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span><b>CNPJ não cadastrado no projeto.</b> Abra o projeto, clique em Editar, preencha o CNPJ e salve. Depois clique em Atualizar.</span>
                  </p>
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
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />O código do projeto vai sem o nome da empresa do final, seguido da razão social. O sistema segue as soluções e a frota do cadastro, como no e-mail ao Data Center.
              </p>
            </Grupo>
          </div>

          {/* Prévia */}
          <div className="border-t bg-muted/40 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prévia do e-mail</p>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="font-medium">{CODIGO_BD_DESTINATARIO}</dd></div>
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assuntoCodigoBd(project)}</dd></div>
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
              <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>Agora cole no Outlook:</b> clique no corpo do e-mail, acima da sua assinatura, e use <b>Ctrl+V</b>. Depois é só enviar. Quando o código BD voltar, anote na atividade.</p>
              <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebCodigoBd(project)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
              <Button variant="outline" size="sm" className="h-9" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
              <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {falta.length > 0 ? (
                <p className="flex min-w-0 flex-1 basis-72 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta: {falta.join(", ")}.</span>
                </p>
              ) : (
                <label htmlFor="bd-conferi" className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <Checkbox id="bd-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
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
