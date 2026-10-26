import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, ClipboardPaste, Copy, ExternalLink, Lock, Mail, PencilLine, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { GerProject } from "@/lib/gerenciamento";
import {
  DC_DESTINATARIO, SISTEMAS, alternarSistema, assuntoDC, cidadeUf, codigoCliente, emailHtmlDC, emailTextoDC, faltando, formInicial,
  licenciados, mailtoDC, outlookWebDC, razaoSocial, reservas, soDigitos, temCarrier, temCnpj, totalCarros, type DataCenterForm,
} from "@/lib/dataCenterEmail";
import { copiarEmail } from "@/lib/emailOutlook";

/**
 * O navegador não consegue pôr o e-mail formatado dentro do Outlook: o link só leva destinatário
 * e assunto. O corpo vai copiado, e o GP cola; este aviso fica à vista antes de abrir o Outlook.
 */
export function PassoColar() {
  return (
    <p className="flex basis-full items-start gap-2 rounded-md bg-primary/[0.07] px-3 py-2 text-[12.5px]">
      <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span><b>O Outlook abre com o corpo em branco.</b> Clique no corpo do e-mail, acima da sua assinatura, e cole com <b>Ctrl+V</b>: o modelo da prévia já vai copiado.</span>
    </p>
  );
}

/** Grupo do formulário. */
export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">{titulo}</p>
      {children}
    </section>
  );
}

/** Valor que vem do cadastro (ou é padrão): só leitura, com cadeado. */
export function Fixo({ label, valor, origem = "do cadastro" }: { label: string; valor: string; origem?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-[13px]">
      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right font-medium">{valor}</span>
      <span className="hidden shrink-0 text-[10.5px] text-muted-foreground sm:inline">{origem}</span>
    </div>
  );
}

/** Botões de escolha única (segmentado). */
function Seg<T extends string>({ value, options, onChange, label }: { value: T | ""; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === o.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** Botões de escolha múltipla. */
function Multi<T extends string>({ value, options, onToggle, label }: { value: T[]; options: T[]; onToggle: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(o)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
            {on && <Check className="h-3.5 w-3.5" aria-hidden />}{o}
          </button>
        );
      })}
    </div>
  );
}

/** Sim/Não de um módulo. */
function SimNao({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2 text-[13px]">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`w-7 text-right text-xs font-semibold ${value ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>{value ? "Sim" : "Não"}</span>
        <Switch id={id} checked={value} onCheckedChange={onChange} />
      </span>
    </label>
  );
}

/**
 * E-mail ao Data Center: o GP completa o que varia, confere a prévia e abre o Outlook
 * com destinatário e assunto prontos; o corpo formatado vai copiado para colar.
 */
export function DataCenterEmailDialog({ open, onOpenChange, project, form, onForm, gp, onCopiado, onAtualizarProjeto }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  form: DataCenterForm | null;
  onForm: (f: DataCenterForm) => void;
  gp: string;
  /** O GP copiou o e-mail: a atividade fica feita. */
  onCopiado: () => void;
  /** Relê o cadastro do projeto (depois de completar o CNPJ em outra aba). */
  onAtualizarProjeto: () => Promise<unknown>;
}) {
  // completa com os padrões o que faltar (o formulário muda de forma entre versões)
  const f: DataCenterForm = { ...formInicial(project), ...form };
  const set = (patch: Partial<DataCenterForm>) => { onForm({ ...f, ...patch }); setConferido(false); setAberto(false); };
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const atualizar = async () => {
    setAtualizando(true);
    try { await onAtualizarProjeto(); setConferido(false); }
    catch { toast.error("Não foi possível reler o cadastro do projeto. Tente de novo."); }
    finally { setAtualizando(false); }
  };
  const falta = faltando(project, f);
  const html = emailHtmlDC(project, f, gp);
  const texto = emailTextoDC(project, f, gp);
  const pronto = falta.length === 0 && conferido;

  const copiar = async () => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie."); return; }
    onCopiado();
    toast.success("E-mail copiado e atividade marcada como feita. No Outlook, clique no corpo e cole (Ctrl+V).");
  };
  const abrirOutlook = async () => {
    const ok = await copiarEmail(html, texto);
    if (!ok) { toast.error("Não foi possível copiar o e-mail. Tente de novo."); return; }
    onCopiado();
    window.location.href = mailtoDC(project, f);
    setAberto(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />E-mail ao Data Center</DialogTitle>
          <DialogDescription>Complete o que muda neste projeto; o resto vem do cadastro. Confira a prévia e abra no Outlook já com destinatário e assunto.</DialogDescription>
          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Do cadastro ou padrão</span>
            <span className="inline-flex items-center gap-1"><PencilLine className="h-3 w-3 text-primary" />Você escolhe</span>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          {/* Formulário */}
          <div className="space-y-6 p-5 lg:overflow-y-auto">
            <Grupo titulo="Solicitação">
              <Fixo label="Selo" valor="Liberação para Criação do BD no DC" origem="padrão" />
              <Fixo label="Departamento" valor="CPQ - PMO" origem="padrão" />
              <div>
                <Label className="text-xs" htmlFor="dc-codigo">Código do cliente *</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Input id="dc-codigo" inputMode="numeric" maxLength={5} placeholder="00745" className="h-9 w-28 font-mono"
                    value={f.codigo} onChange={e => set({ codigo: soDigitos(e.target.value).slice(0, 5) })}
                    onBlur={() => { if (f.codigo && f.codigo.length < 5) set({ codigo: f.codigo.padStart(5, "0") }); }} />
                  <span className="min-w-0 flex-1 truncate rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-[12px]" title={codigoCliente(project, f)}>{codigoCliente(project, f)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Você digita os 5 dígitos; nome, cidade e UF vêm do cadastro e o final vem dos sistemas (TDMax Urbano e Seccionado viram "TDMax").</p>
              </div>
              <div>
                <Label className="text-xs">Sistema * <span className="font-normal text-muted-foreground">(um ou mais)</span></Label>
                <div className="mt-1.5"><Multi label="Sistema" value={f.sistemas} options={[...SISTEMAS]} onToggle={s => set({ sistemas: alternarSistema(f.sistemas, s) })} /></div>
              </div>
            </Grupo>

            <Grupo titulo="Configuração">
              <div>
                <Label className="text-xs">Recolhimento</Label>
                <div className="mt-1.5"><Seg label="Recolhimento" value={f.recolhimento} onChange={v => set({ recolhimento: v })} options={[{ v: "sem", l: "Sem recolhimento" }, { v: "com", l: "Com recolhimento" }]} /></div>
              </div>
              <div>
                <Label className="text-xs">Migração</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Seg label="Migração" value={f.migracao ? "sim" : "nao"} onChange={v => set({ migracao: v === "sim" })} options={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }]} />
                  {f.migracao && <Input aria-label="De qual sistema" placeholder="De qual sistema? Ex.: Prodata" className="h-9 min-w-0 flex-1 basis-48" value={f.migracaoDe} onChange={e => set({ migracaoDe: e.target.value })} />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs" htmlFor="dc-prefixo">Dígitos do prefixo</Label><Input id="dc-prefixo" inputMode="numeric" className="mt-1.5 h-9" value={f.prefixo} onChange={e => set({ prefixo: soDigitos(e.target.value).slice(0, 2) })} /></div>
                <div><Label className="text-xs" htmlFor="dc-mascara">Máscara da linha</Label><Input id="dc-mascara" inputMode="numeric" className="mt-1.5 h-9" value={f.mascara} onChange={e => set({ mascara: soDigitos(e.target.value).slice(0, 2) })} /></div>
              </div>
              <div>
                <Label className="text-xs" htmlFor="dc-obs">Observações (opcional)</Label>
                <Textarea id="dc-obs" className="mt-1.5 min-h-[60px]" value={f.observacoes} onChange={e => set({ observacoes: e.target.value })} />
              </div>
            </Grupo>

            <Grupo titulo="Cliente e frota">
              <Fixo label="Razão social" valor={razaoSocial(project)} />
              {temCnpj(project) ? (
                <Fixo label="CNPJ" valor={project.cnpj ?? ""} />
              ) : (
                <div className="space-y-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px]">
                  <p className="flex items-start gap-1.5 text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span><b>CNPJ não cadastrado no projeto.</b> O CNPJ do e-mail vem do cadastro: abra o projeto, clique em Editar, preencha o CNPJ e salve. Depois clique em Atualizar.</span>
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
              <Fixo label="Cidade/UF" valor={cidadeUf(project)} />
              <Fixo label="Total de carros" valor={String(totalCarros(project))} origem="frota contratada" />
              <Fixo label="Carros reservas" valor={String(reservas(project))} origem="frota reserva" />
              <Fixo label="Carros licenciados" valor={String(licenciados(project))} origem="total − reservas" />
            </Grupo>

            <Grupo titulo="Módulos">
              <div className="grid gap-2 sm:grid-cols-2">
                <SimNao id="dc-crm" label="CRM" value={f.crm} onChange={v => set({ crm: v })} />
                <SimNao id="dc-recarga" label="Recarga Embarcada" value={f.recarga} onChange={v => set({ recarga: v })} />
                <SimNao id="dc-abt" label="ABT" value={f.abt} onChange={v => set({ abt: v })} />
                <SimNao id="dc-billing" label="Billing" value={f.billing} onChange={v => set({ billing: v })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Fixo label="AtlasPay" valor={project.atlas_pay ? "Sim" : "Não"} />
                <Fixo label="Carrier" valor={temCarrier(project) ? "Sim" : "Não"} />
                <Fixo label="TDMax Sendmail" valor="Sim" origem="padrão" />
                <Fixo label="Atlas TDCE" valor="Sim" origem="padrão" />
                <Fixo label="Bilhetagem" valor="Sim" origem="padrão" />
              </div>
            </Grupo>
          </div>

          {/* Prévia */}
          <div className="border-t bg-muted/40 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prévia do e-mail</p>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="font-medium">{DC_DESTINATARIO}</dd></div>
                <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assuntoDC(project, f)}</dd></div>
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
              <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>Agora cole no Outlook:</b> clique no corpo do e-mail, acima da sua assinatura, e use <b>Ctrl+V</b>. Depois é só enviar. A atividade já ficou como feita.</p>
              <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebDC(project, f)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
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
                <label htmlFor="dc-conferi" className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <Checkbox id="dc-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
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
