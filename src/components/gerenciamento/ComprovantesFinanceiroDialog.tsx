import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Check, CheckCircle2, Copy, Download, ExternalLink, FileText, ImagePlus, Info, Loader2, Mail, ReceiptText, RefreshCw, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copiarEmail } from "@/lib/emailOutlook";
import type { GerProject } from "@/lib/gerenciamento";
import { errorMessage } from "@/lib/implantationScheduling";
import type { Modulo02Estado } from "@/lib/modulo02";
import {
  FORMATOS_COMPROVANTE, MAX_COMPROVANTES, TIPOS_COMPROVANTE, faltandoComprovantes, montarComprovantesPdf, prepararImagem, resumoComprovantes,
  type Comprovante, type ComprovanteResumo,
} from "@/lib/comprovantesFinanceiro";
import { arquivoComprovantes, assuntoFinanceiro, emailHtmlFinanceiro, emailTextoFinanceiro, mailtoPara, outlookWebPara } from "@/lib/visitaPeEmail";
import { Grupo, PassoColar } from "./DataCenterEmailDialog";

const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/**
 * Comprovantes ao Financeiro: o GP anexa as imagens dos comprovantes de pagamento, confere o e-mail
 * (dados do cadastro e do módulo) e o PDF com os comprovantes, baixa o PDF e cola o e-mail no Outlook.
 * As imagens ficam só na sessão; o módulo guarda o que foi enviado (tipo, descrição, arquivo).
 */
export function ComprovantesFinanceiroDialog({ open, onOpenChange, project, estado, userName, comprovantes, onComprovantes, onPara, onEnviado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  estado: Modulo02Estado;
  userName: string;
  comprovantes: Comprovante[];
  onComprovantes: (update: (cs: Comprovante[]) => Comprovante[]) => void;
  onPara: (para: string) => void;
  /** O e-mail foi copiado, com estes comprovantes. */
  onEnviado: (resumo: ComprovanteResumo[]) => void;
}) {
  const [aba, setAba] = useState<"email" | "pdf">("email");
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  useEffect(() => { if (open) { setConferido(false); setAberto(false); } }, [open]);

  const para = estado.financeiro.para;
  const paraOk = emailValido(para);
  const arquivo = arquivoComprovantes(project);
  // reaberto depois de recarregar a página: o e-mail usa o que foi registrado (sem as imagens)
  const resumo = comprovantes.length ? resumoComprovantes(comprovantes) : estado.financeiro.comprovantes;
  const html = emailHtmlFinanceiro(project, estado, userName, resumo, arquivo);
  const texto = emailTextoFinanceiro(project, estado, userName, resumo, arquivo);
  const assunto = assuntoFinanceiro(project);
  const falta = [...(paraOk ? [] : ["e-mail do Financeiro"]), ...faltandoComprovantes(comprovantes)];

  /* ─── anexar ─── */
  const adicionar = async (files: File[]) => {
    const vagas = MAX_COMPROVANTES - comprovantes.length;
    if (vagas <= 0) { toast.warning(`Até ${MAX_COMPROVANTES} comprovantes por envio.`); return; }
    if (files.length > vagas) toast.warning(`Só cabem mais ${vagas} comprovante${vagas === 1 ? "" : "s"}; os demais ficaram de fora.`);
    const lista = files.slice(0, vagas);
    setLendo(n => n + lista.length);
    for (const file of lista) {
      try {
        const img = await prepararImagem(file);
        onComprovantes(cs => [...cs, { id: crypto.randomUUID(), arquivo: file.name, tipo: "", descricao: "", ...img }]);
      } catch (e) {
        toast.error("Imagem não anexada", { description: errorMessage(e) });
      } finally {
        setLendo(n => n - 1);
      }
    }
    setConferido(false);
  };
  const soImagens = (fs: FileList | File[]) => Array.from(fs).filter(f => f.type.startsWith("image/"));
  const aoColar = (ev: ClipboardEvent) => {
    const imgs = soImagens(ev.clipboardData.files);
    if (!imgs.length) return;
    ev.preventDefault();
    // print colado vem como "image.png": numera para achar no PDF
    void adicionar(imgs.map((f, i) => new File([f], `print-${comprovantes.length + i + 1}.png`, { type: f.type })));
  };
  const aoSoltar = (ev: DragEvent) => { ev.preventDefault(); setArrastando(false); void adicionar(soImagens(ev.dataTransfer.files)); };
  const mudar = (id: string, patch: Partial<Comprovante>) => { onComprovantes(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c))); setConferido(false); };
  const remover = (id: string) => { onComprovantes(cs => cs.filter(c => c.id !== id)); setConferido(false); };

  /* ─── PDF: refeito ~0,6 s depois da última mudança ─── */
  const dadosPdf = useMemo(() => montarComprovantesPdf(project, estado, comprovantes, userName), [project, estado, comprovantes, userName]);
  // o PDF só é refeito quando muda o que vai nele (não a cada tecla no e-mail do Financeiro)
  const dadosRef = useRef(dadosPdf);
  dadosRef.current = dadosPdf;
  const chave = JSON.stringify({ ...dadosPdf, comprovantes: comprovantes.map(c => [c.id, c.tipo, c.descricao]) });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!open || !comprovantes.length) { setPdfUrl(antigo => { if (antigo) URL.revokeObjectURL(antigo); return null; }); return; }
    let vivo = true;
    setGerando(true); setErroPdf(null);
    const timer = window.setTimeout(() => {
      import("@/lib/comprovantesPdf")
        .then(m => m.gerarComprovantesPdf(dadosRef.current))
        .then(blob => {
          if (!vivo) return;
          const novo = URL.createObjectURL(blob);
          setPdfUrl(antigo => { if (antigo) URL.revokeObjectURL(antigo); return novo; });
        })
        .catch(e => { if (vivo) setErroPdf(errorMessage(e)); })
        .finally(() => { if (vivo) setGerando(false); });
    }, 600);
    return () => { vivo = false; clearTimeout(timer); };
  }, [open, chave, comprovantes.length, tentativa]);

  const pdfPronto = !!pdfUrl && !gerando && !erroPdf;
  const pronto = falta.length === 0 && conferido && pdfPronto;

  /* ─── enviar ─── */
  const baixarPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl; a.download = `${arquivo}.pdf`;
    a.click();
  };
  const copiar = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie."); return false; }
    onEnviado(resumoComprovantes(comprovantes));
    return true;
  };
  const copiarSo = async () => { if (await copiar()) toast.success("E-mail copiado. No Outlook, clique no corpo e cole (Ctrl+V)."); };
  const baixarEAbrir = async () => {
    baixarPdf();
    if (!(await copiar())) return;
    window.location.href = mailtoPara(para, assunto);
    setAberto(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPaste={aoColar} className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />Comprovantes ao Financeiro</DialogTitle>
          <DialogDescription>
            Anexe os comprovantes de pagamento da viagem. O portal monta o e-mail com os dados do projeto e um PDF com os comprovantes para anexar no Outlook.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:overflow-hidden">
          {/* Destinatário e comprovantes */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Grupo titulo="Para">
              <div>
                <Label className="text-xs" htmlFor="fin-para">E-mail do Financeiro *</Label>
                <Input id="fin-para" type="email" className="mt-1.5 h-9" placeholder="financeiro@itstransdata.com" value={para}
                  onChange={ev => { onPara(ev.target.value); setConferido(false); }} />
                <p className="mt-1 text-[11px] text-muted-foreground">Fica salvo no módulo para os próximos envios.</p>
                {para && !paraOk && <p className="mt-1 text-[11px] text-destructive">Confira o e-mail: falta o @ ou o domínio.</p>}
              </div>
            </Grupo>

            <Grupo titulo={`Comprovantes de pagamento${comprovantes.length ? ` (${comprovantes.length})` : ""}`}>
              <label htmlFor="fin-arquivos"
                onDragOver={ev => { ev.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={aoSoltar}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${arrastando ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ImagePlus className="h-5 w-5" /></span>
                <span className="text-[13px] font-medium">Arraste as imagens aqui ou clique para escolher</span>
                <span className="text-[11.5px] text-muted-foreground">Ou cole um print com Ctrl+V · JPG, PNG ou WEBP · até {MAX_COMPROVANTES} comprovantes</span>
                <input id="fin-arquivos" type="file" multiple accept={FORMATOS_COMPROVANTE} className="sr-only"
                  onChange={ev => { void adicionar(soImagens(ev.target.files ?? [])); ev.target.value = ""; }} />
              </label>
              {lendo > 0 && <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Preparando {lendo} {lendo === 1 ? "imagem" : "imagens"}…</p>}

              {comprovantes.length > 0 && (
                <ol className="space-y-2">
                  {comprovantes.map((c, i) => (
                    <li key={c.id} className="flex gap-3 rounded-lg border border-border/60 bg-card p-2.5">
                      <span className="relative shrink-0">
                        <img src={c.imagem} alt={`Comprovante ${i + 1}: ${c.arquivo}`} className="h-[74px] w-[74px] rounded-md border border-border/60 bg-white object-contain" />
                        <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">{i + 1}</span>
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Select value={c.tipo} onValueChange={v => mudar(c.id, { tipo: v })}>
                            <SelectTrigger aria-label={`Tipo do comprovante ${i + 1}`} className={`h-8 text-[13px] ${c.tipo ? "" : "border-amber-500/70 text-muted-foreground"}`}>
                              <SelectValue placeholder="Tipo do comprovante *" />
                            </SelectTrigger>
                            <SelectContent>{TIPOS_COMPROVANTE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remover o comprovante ${i + 1}`} title="Remover" onClick={() => remover(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input aria-label={`Descrição do comprovante ${i + 1}`} className="h-8 text-[13px]" placeholder="Descrição (opcional), ex.: LATAM ida e volta"
                          value={c.descricao} onChange={ev => mudar(c.id, { descricao: ev.target.value })} />
                        <p className="truncate text-[11px] text-muted-foreground" title={c.arquivo}>{c.arquivo}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {!comprovantes.length && estado.financeiro.comprovantes.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-[12.5px] text-sky-800 dark:text-sky-200">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>Já foram enviados {estado.financeiro.comprovantes.length} comprovantes. As imagens não ficam salvas no portal: para baixar o PDF de novo, anexe-as outra vez.</span>
                </p>
              )}
            </Grupo>

            <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Os dados do projeto vêm do cadastro e os da visita, deste módulo. Confira no e-mail e no PDF, ao lado.</span>
            </p>
          </div>

          {/* Prévias: e-mail e PDF */}
          <div className="flex min-h-[560px] flex-col border-t bg-muted/40 p-3 sm:p-4 lg:min-h-0 lg:border-l lg:border-t-0">
            <div role="tablist" aria-label="Prévia" className="mb-3 inline-flex w-fit rounded-lg border border-border/70 bg-card p-0.5">
              {([["email", "E-mail", Mail], ["pdf", `PDF${comprovantes.length ? ` · ${comprovantes.length + 1} páginas` : ""}`, FileText]] as const).map(([v, l, Icone]) => (
                <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${aba === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icone className="h-4 w-4" />{l}
                  {v === "pdf" && gerando && pdfUrl && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Atualizando o PDF" />}
                </button>
              ))}
            </div>

            {aba === "email" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
                    <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="min-w-0 break-words font-medium">{para.trim() || "—"}</dd></div>
                    <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assunto}</dd></div>
                    <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Anexo</dt>
                      <dd className="min-w-0 break-words">{comprovantes.length ? <span className="inline-flex items-center gap-1 font-medium"><FileText className="h-3.5 w-3.5 text-primary" />{arquivo}.pdf</span> : "—"}</dd></div>
                  </dl>
                  {/* o e-mail é branco como no Outlook, também no tema escuro */}
                  <div className="overflow-x-auto bg-white p-4" dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              </div>
            ) : !comprovantes.length ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
                <FileText className="h-7 w-7 text-primary" />Anexe os comprovantes para ver o PDF: a 1ª página traz o projeto e a visita, e cada comprovante vem numa página.
              </div>
            ) : erroPdf ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                <span className="flex-1">Não foi possível gerar o PDF. {erroPdf}</span>
                <Button size="sm" variant="outline" onClick={() => setTentativa(n => n + 1)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
              </div>
            ) : !pdfUrl ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" />Gerando o PDF…</div>
            ) : (
              <iframe src={pdfUrl} title="Prévia do PDF dos comprovantes" className="min-h-0 w-full flex-1 rounded-lg border border-border/60 bg-white" />
            )}
          </div>
        </div>

        {/* Rodapé: conferir, baixar o PDF e abrir no Outlook */}
        <div className="border-t bg-card px-5 py-3.5">
          {aberto ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="min-w-0 flex-1 basis-72 text-[13px]">
                <b>Agora, no Outlook:</b> clique no corpo do e-mail e cole com <b>Ctrl+V</b>. Depois anexe o <b>{arquivo}.pdf</b>, que foi baixado, e envie.
              </p>
              <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebPara(para, assunto)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
              <Button variant="outline" size="sm" className="h-9" onClick={baixarPdf}><Download className="mr-1.5 h-4 w-4" />Baixar PDF de novo</Button>
              <Button variant="outline" size="sm" className="h-9" onClick={copiarSo}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
              <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {falta.length > 0 ? (
                <p className="flex min-w-0 flex-1 basis-72 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta: {falta.join(", ")}.</span>
                </p>
              ) : (
                <label htmlFor="fin-conferi" className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <Checkbox id="fin-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
                  Conferi o e-mail e o PDF
                </label>
              )}
              <Button variant="outline" className="h-9" disabled={!pronto} onClick={copiarSo}><Copy className="mr-1.5 h-4 w-4" />Copiar e-mail</Button>
              <Button variant="outline" className="h-9" disabled={!pdfPronto} onClick={baixarPdf}><Download className="mr-1.5 h-4 w-4" />Baixar PDF</Button>
              <Button className="h-9" disabled={!pronto} onClick={baixarEAbrir}><Mail className="mr-1.5 h-4 w-4" />Baixar PDF e abrir no Outlook</Button>
              {pronto && <PassoColar />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
