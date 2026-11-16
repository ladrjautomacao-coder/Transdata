import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Check, ChevronDown, Clock3, Copy, ExternalLink, FileText, History, Info, Loader2, Mail, Paperclip, PackageCheck, Search, Truck,
  UserRound, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { copiarEmail } from "@/lib/emailOutlook";
import { fetchAssistenteProjetos, quando, type GerProject } from "@/lib/gerenciamento";
import {
  DESPACHADO, ETAPAS_04, EVIDENCIA_ACEITA, STATUS_04, aguardandoAnterior, alterarEtapa, concluida, corDaEtapa, dataBr04, diasAtraso,
  enviarEvidencia, faltaParaConcluir, hoje04, linkEvidencia, pendencias04, previstaDe, proximaAcao, registrar, resumo04, statusDef, tituloEtapa,
  type ConsultaPedido, type Cor, type EtapaId04, type Evidencia, type Modulo04Estado,
} from "@/lib/modulo04";
import { SISTEMA_PEDIDOS } from "@/lib/sistemaPedidos";
import {
  assuntoComunicacaoAp, emailHtmlComunicacaoAp, emailTextoComunicacaoAp, faltandoComunicacaoAp, mailtoComunicacaoAp,
} from "@/lib/entregaCartoesEmail";
import { PassoColar } from "./DataCenterEmailDialog";

/** Cores das situações (cinza, azul, amarelo, verde, vermelho), na pílula e no número da etapa. */
const PILULA: Record<Cor, string> = {
  cinza: "bg-muted text-muted-foreground",
  azul: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  amarelo: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  verde: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  vermelho: "bg-red-500/15 text-red-700 dark:text-red-300",
};
const NUMERO: Record<Cor, string> = {
  cinza: "bg-muted text-muted-foreground",
  azul: "bg-sky-600 text-white",
  amarelo: "bg-amber-500 text-white",
  verde: "bg-emerald-600 text-white",
  vermelho: "bg-red-600 text-white",
};
const PONTO: Record<Cor, string> = { cinza: "bg-muted-foreground/50", azul: "bg-sky-500", amarelo: "bg-amber-500", verde: "bg-emerald-500", vermelho: "bg-red-500" };

/** Quem executa e quem acompanha cada etapa (separados: o GP não executa o que é de outra área). */
export interface Pessoas04 { executante: Record<EtapaId04, string>; acompanhamento: string }

/** Campo de texto que grava ao sair (uma linha no histórico por alteração, não por letra). */
function CampoTexto({ id, label, valor, onSalvar, placeholder, multilinha, className }: {
  id: string; label: string; valor: string; onSalvar: (v: string) => void; placeholder?: string; multilinha?: boolean; className?: string;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const salvar = () => { if (v.trim() !== valor.trim()) onSalvar(v.trim()); };
  return (
    <div className={className}>
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      {multilinha
        ? <Textarea id={id} rows={2} className="mt-1.5 min-h-[60px] text-sm" placeholder={placeholder} value={v} onChange={e => setV(e.target.value)} onBlur={salvar} />
        : <Input id={id} className="mt-1.5 h-9" placeholder={placeholder} value={v} onChange={e => setV(e.target.value)} onBlur={salvar}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />}
    </div>
  );
}

function CampoData({ id, label, valor, onSalvar }: { id: string; label: string; valor: string; onSalvar: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <Input id={id} type="date" className="mt-1.5 h-9" value={valor} onChange={e => onSalvar(e.target.value)} />
    </div>
  );
}

function Pilula({ cor, children }: { cor: Cor; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", PILULA[cor])}>
    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", PONTO[cor])} />{children}
  </span>;
}

/** Executante e acompanhamento, sempre separados. */
function Papeis({ executante, acompanhamento }: { executante: string; acompanhamento: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />Executa: <b className="font-semibold text-foreground">{executante}</b></span>
      <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />Acompanha: <b className="font-semibold text-foreground">{acompanhamento}</b></span>
    </span>
  );
}

/* ─── Comunicação da entrega dos cartões para AP ─── */

function ComunicacaoDialog({ open, onOpenChange, project, estado, responsavel, gp, onPara, onCopiado }: {
  open: boolean; onOpenChange: (o: boolean) => void; project: GerProject; estado: Modulo04Estado; responsavel: string; gp: string;
  onPara: (para: string) => void; onCopiado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (open) setAberto(false); }, [open]);
  const d = { etapa: estado.cartoesAp, responsavel, gp };
  const falta = faltandoComunicacaoAp(d);
  const html = emailHtmlComunicacaoAp(project, d), texto = emailTextoComunicacaoAp(project, d);
  const copiar = async (abrir: boolean) => {
    if (!(await copiarEmail(html, texto))) { toast.error("Não foi possível copiar. Tente de novo."); return; }
    onCopiado();
    if (abrir) { window.location.href = mailtoComunicacaoAp(project, estado.cartoesAp.para); setAberto(true); }
    else toast.success("Comunicação copiada. No Outlook, clique no corpo e cole (Ctrl+V).");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Comunicação da entrega dos cartões para AP</DialogTitle>
          <DialogDescription>Os dados vêm do projeto e da etapa. Confira a prévia, copie e cole no Outlook. A comunicação fica registrada como evidência da etapa.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/40 p-5">
          <CampoTexto id="m4-para" label="Para (e-mail de AP, opcional)" valor={estado.cartoesAp.para} onSalvar={onPara} placeholder="ap@itstransdata.com" className="max-w-md" />
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="font-medium">{estado.cartoesAp.para || "—"}</dd></div>
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assuntoComunicacaoAp(project)}</dd></div>
            </dl>
            {/* o e-mail é branco como no Outlook, também no tema escuro */}
            <div className="overflow-x-auto bg-white p-4" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
        <div className="border-t bg-card px-5 py-3.5">
          {aberto ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>Agora cole no Outlook:</b> clique no corpo do e-mail e use <b>Ctrl+V</b>. Depois é só enviar.</p>
              <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {falta.length > 0
                ? <p className="flex min-w-0 flex-1 basis-72 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Falta na etapa: {falta.join(", ")}.</p>
                : <p className="min-w-0 flex-1 basis-72 text-[13px] text-muted-foreground">Copiar registra a comunicação no histórico e como evidência.</p>}
              <Button variant="outline" className="h-9" disabled={falta.length > 0} onClick={() => void copiar(false)}><Copy className="mr-1.5 h-4 w-4" />Copiar e-mail</Button>
              <Button className="h-9" disabled={falta.length > 0} onClick={() => void copiar(true)}><Mail className="mr-1.5 h-4 w-4" />Copiar e abrir no Outlook</Button>
              {falta.length === 0 && <PassoColar />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Consulta ao Sistema de Pedidos (manual enquanto não houver integração) ─── */

interface RegistroConsulta {
  consulta: ConsultaPedido;
  status?: string;
  despacho?: { transportadora: string; rastreio: string; despachoEfetivo: string; prevista: string };
  arquivo?: File;
}

function PedidoDialog({ open, onOpenChange, etapa, estado, linkPedidos, userName, onRegistrar }: {
  open: boolean; onOpenChange: (o: boolean) => void; etapa: "apAt" | "equipamentos"; estado: Modulo04Estado; linkPedidos: string | null;
  userName: string; onRegistrar: (r: RegistroConsulta) => Promise<void>;
}) {
  const e = estado[etapa];
  const despacho = etapa === "equipamentos";
  const [numero, setNumero] = useState(""), [status, setStatus] = useState(""), [data, setData] = useState(hoje04());
  const [obs, setObs] = useState(""), [novoStatus, setNovoStatus] = useState("manter"), [arquivo, setArquivo] = useState<File | null>(null);
  const [transp, setTransp] = useState(""), [rastreio, setRastreio] = useState(""), [despachoEm, setDespachoEm] = useState(""), [previsao, setPrevisao] = useState("");
  const [gravando, setGravando] = useState(false);
  useEffect(() => {
    if (!open) return;
    setNumero(e.pedido); setStatus(e.statusPedido); setData(hoje04()); setObs(""); setNovoStatus("manter"); setArquivo(null);
    if (etapa === "equipamentos") {
      const q = estado.equipamentos;
      setTransp(q.transportadora); setRastreio(q.rastreio); setDespachoEm(q.despachoEfetivo); setPrevisao(q.prevista);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const falta = [
    !numero.trim() && "número do pedido", !status.trim() && "status", !data && "data da consulta", !obs.trim() && !arquivo && "evidência ou observação",
  ].filter(Boolean) as string[];
  const gravar = async () => {
    setGravando(true);
    try {
      await onRegistrar({
        consulta: { em: new Date().toISOString(), por: userName, numero: numero.trim(), status: status.trim(), data, observacao: obs.trim(), fonte: "manual" },
        status: novoStatus === "manter" ? undefined : novoStatus,
        despacho: despacho ? { transportadora: transp.trim(), rastreio: rastreio.trim(), despachoEfetivo: despachoEm, prevista: previsao } : undefined,
        arquivo: arquivo ?? undefined,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível registrar a consulta.", { description: err instanceof Error ? err.message : String(err) });
    } finally { setGravando(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">{despacho ? <Truck className="h-5 w-5 text-primary" /> : <Search className="h-5 w-5 text-primary" />}
            {despacho ? "Consultar despacho" : "Verificar no Sistema de Pedidos"}</DialogTitle>
          <DialogDescription>{tituloEtapa(etapa)}</DialogDescription>
        </DialogHeader>
        {!SISTEMA_PEDIDOS.integrado && (
          <div className="flex flex-wrap items-start gap-3 rounded-lg bg-sky-500/10 px-3.5 py-2.5 text-[13px] text-sky-900 dark:text-sky-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 basis-64">Consulte o pedido no Sistema de Pedidos e registre aqui o que ele mostra. Fica registrado quem consultou e quando.</p>
            {linkPedidos && (
              <Button variant="outline" size="sm" className="h-8 bg-background" asChild>
                <a href={linkPedidos} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir o Sistema de Pedidos</a>
              </Button>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs" htmlFor="pd-num">Número do pedido *</Label><Input id="pd-num" className="mt-1.5 h-9 font-mono" value={numero} onChange={ev => setNumero(ev.target.value)} /></div>
          <div><Label className="text-xs" htmlFor="pd-status">Status no Sistema de Pedidos *</Label><Input id="pd-status" className="mt-1.5 h-9" placeholder="Ex.: Faturado, Expedido" value={status} onChange={ev => setStatus(ev.target.value)} /></div>
          <div><Label className="text-xs" htmlFor="pd-data">Data da consulta *</Label><Input id="pd-data" type="date" className="mt-1.5 h-9" value={data} onChange={ev => setData(ev.target.value)} /></div>
          <div>
            <Label className="text-xs">Atualizar a situação da etapa</Label>
            <Select value={novoStatus} onValueChange={setNovoStatus}>
              <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manter">Manter: {statusDef(etapa, e.status).nome}</SelectItem>
                {STATUS_04[etapa].filter(s => s.id !== e.status && !s.concluido).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {despacho && <>
            <div><Label className="text-xs" htmlFor="pd-transp">Transportadora</Label><Input id="pd-transp" className="mt-1.5 h-9" value={transp} onChange={ev => setTransp(ev.target.value)} /></div>
            <div><Label className="text-xs" htmlFor="pd-rastreio">Código de rastreamento</Label><Input id="pd-rastreio" className="mt-1.5 h-9 font-mono" value={rastreio} onChange={ev => setRastreio(ev.target.value)} /></div>
            <div><Label className="text-xs" htmlFor="pd-desp">Data do despacho</Label><Input id="pd-desp" type="date" className="mt-1.5 h-9" value={despachoEm} onChange={ev => setDespachoEm(ev.target.value)} /></div>
            <div><Label className="text-xs" htmlFor="pd-prev">Previsão de entrega</Label><Input id="pd-prev" type="date" className="mt-1.5 h-9" value={previsao} onChange={ev => setPrevisao(ev.target.value)} /></div>
          </>}
          <div className="sm:col-span-2">
            <Label className="text-xs" htmlFor="pd-obs">Evidência ou observação *</Label>
            <Textarea id="pd-obs" rows={2} className="mt-1.5 text-sm" placeholder="O que o sistema mostrou, quem confirmou, etc." value={obs} onChange={ev => setObs(ev.target.value)} />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-primary hover:underline">
              <Paperclip className="h-3.5 w-3.5" />{arquivo ? arquivo.name : "Anexar o print ou o comprovante (opcional)"}
              <input type="file" accept={EVIDENCIA_ACEITA} className="sr-only" onChange={ev => setArquivo(ev.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          {falta.length > 0
            ? <p className="flex min-w-0 flex-1 basis-60 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Falta: {falta.join(", ")}.</p>
            : <p className="min-w-0 flex-1 basis-60 text-[13px] text-muted-foreground">Fica registrado com data, hora e o seu nome.</p>}
          <Button className="h-9" disabled={falta.length > 0 || gravando} onClick={() => void gravar()}>
            {gravando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}Registrar consulta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Uma etapa: linha resumida que abre os detalhes ─── */

function EtapaCard({ id, n, estado, pessoas, aberta, onAlternar, onAlterar, onEvidencia, onAbrirComunicacao, onAbrirPedido, onConcluir, enviando }: {
  id: EtapaId04; n: number; estado: Modulo04Estado; pessoas: Pessoas04; aberta: boolean; onAlternar: () => void;
  onAlterar: (patch: Record<string, string>) => void; onEvidencia: (f: File) => void; onAbrirComunicacao: () => void; onAbrirPedido: () => void;
  onConcluir: () => void; enviando: boolean;
}) {
  const e = estado[id];
  const st = statusDef(id, e.status);
  const cor = corDaEtapa(id, estado);
  const atraso = diasAtraso(id, estado);
  const esperando = aguardandoAnterior(id, estado);
  const falta = faltaParaConcluir(id, estado);
  const fechada = concluida(id, estado);
  const arquivo = useRef<HTMLInputElement>(null);
  const hist = estado.historico.filter(h => h.etapa === id).slice().reverse();
  const consultas = id === "cartoesAp" ? [] : estado[id].consultas.slice().reverse();
  const evid = estado.evidencias[id];
  const v = e as unknown as Record<string, string>;
  const pid = (c: string) => `m4-${id}-${c}`;

  return (
    <li id={`ger-atv-${id}`} className="scroll-mt-6">
      <div className={cn("overflow-hidden rounded-xl border bg-card shadow-sm transition-colors", atraso > 0 ? "border-red-500/40" : "border-border/60")}>
        {/* linha resumida */}
        <button type="button" onClick={onAlternar} aria-expanded={aberta}
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold", NUMERO[cor])}>
            {fechada ? <Check className="h-4 w-4" /> : n}
          </span>
          <span className="min-w-0 flex-1 basis-64">
            <span className="block text-[15px] font-semibold">{tituloEtapa(id)}</span>
            <Papeis executante={pessoas.executante[id]} acompanhamento={pessoas.acompanhamento} />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {esperando ? <Pilula cor="cinza">Aguardando etapa anterior</Pilula> : <Pilula cor={st.cor}>{st.nome}</Pilula>}
            {atraso > 0 && <Pilula cor="vermelho">Atrasado · {atraso} {atraso === 1 ? "dia" : "dias"}</Pilula>}
          </span>
          <span className="w-[118px] shrink-0 text-[12px] text-muted-foreground">
            <span className="block text-[10.5px] font-semibold uppercase tracking-wide">Previsto</span>
            <span className={cn("font-medium", atraso > 0 ? "text-red-700 dark:text-red-300" : "text-foreground")}>{dataBr04(previstaDe(id, estado))}</span>
          </span>
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", aberta && "rotate-180")} />
          {!fechada && (
            <span className="basis-full pl-[52px] text-[12.5px] text-orange-800 dark:text-orange-200">
              <b className="font-semibold">Próxima ação:</b> {proximaAcao(id, estado)}
            </span>
          )}
        </button>

        {/* detalhes */}
        {aberta && (
          <div className="space-y-5 border-t bg-muted/20 px-4 py-4">
            {id === "equipamentos" && DESPACHADO.includes(e.status) && (
              <div className="grid gap-3 rounded-xl border border-sky-500/30 bg-sky-500/[0.07] p-3.5 sm:grid-cols-4">
                {[["Transportadora", estado.equipamentos.transportadora || "—"], ["Código de rastreamento", estado.equipamentos.rastreio || "—"],
                  ["Data do despacho", dataBr04(estado.equipamentos.despachoEfetivo)], ["Previsão de entrega", dataBr04(estado.equipamentos.prevista)]].map(([l, x]) => (
                  <div key={l}><p className="text-[10.5px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">{l}</p><p className="mt-0.5 font-mono text-[15px] font-semibold">{x}</p></div>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="text-xs">Situação</Label>
                <Select value={e.status} onValueChange={s => onAlterar({ status: s })}>
                  <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_04[id].filter(s => !s.concluido || s.id === e.status).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {id !== "cartoesAp" && <CampoTexto id={pid("pedido")} label="Número do pedido" valor={v.pedido} onSalvar={x => onAlterar({ pedido: x })} placeholder="Ex.: 48213" />}
              {id === "equipamentos" && <CampoTexto id={pid("equip")} label="Equipamento" valor={v.equipamento} onSalvar={x => onAlterar({ equipamento: x })} placeholder="Ex.: AtlasBox FULL" />}
              <CampoTexto id={pid("qtd")} label={id === "equipamentos" ? "Quantidade" : "Quantidade de cartões"} valor={v.quantidade} onSalvar={x => onAlterar({ quantidade: x.replace(/\D/g, "") })} placeholder="Ex.: 300" />
              {id === "equipamentos" ? <>
                <CampoData id={pid("dprev")} label="Data prevista de despacho" valor={v.despachoPrevisto} onSalvar={x => onAlterar({ despachoPrevisto: x })} />
                <CampoData id={pid("def")} label="Data efetiva de despacho" valor={v.despachoEfetivo} onSalvar={x => onAlterar({ despachoEfetivo: x })} />
                <CampoTexto id={pid("transp")} label="Transportadora" valor={v.transportadora} onSalvar={x => onAlterar({ transportadora: x })} />
                <CampoTexto id={pid("rastreio")} label="Código de rastreamento" valor={v.rastreio} onSalvar={x => onAlterar({ rastreio: x })} />
                <CampoData id={pid("prev")} label="Data prevista de entrega" valor={v.prevista} onSalvar={x => onAlterar({ prevista: x })} />
                <CampoData id={pid("efet")} label="Data efetiva da entrega" valor={v.efetiva} onSalvar={x => onAlterar({ efetiva: x })} />
              </> : <>
                <CampoData id={pid("prev")} label="Data prevista" valor={v.prevista} onSalvar={x => onAlterar({ prevista: x })} />
                <CampoData id={pid("efet")} label={id === "cartoesAp" ? "Data efetiva da entrega" : "Data efetiva"} valor={v.efetiva} onSalvar={x => onAlterar({ efetiva: x })} />
              </>}
              {id !== "cartoesAp" && <CampoTexto id={pid("stped")} label="Status do pedido" valor={v.statusPedido} onSalvar={x => onAlterar({ statusPedido: x })} placeholder="Como o Sistema de Pedidos mostra" />}
              <CampoTexto id={pid("obs")} label="Observações" valor={v.observacoes} onSalvar={x => onAlterar({ observacoes: x })} multilinha className="sm:col-span-2 lg:col-span-4" />
            </div>

            {/* ações */}
            <div className="flex flex-wrap items-center gap-2">
              {id === "cartoesAp"
                ? <Button variant="outline" className="h-9 bg-background" onClick={onAbrirComunicacao}><Mail className="mr-1.5 h-4 w-4" />Preparar comunicação de entrega</Button>
                : <Button variant="outline" className="h-9 bg-background" onClick={onAbrirPedido}>
                    {id === "equipamentos" ? <><Truck className="mr-1.5 h-4 w-4" />Consultar despacho</> : <><Search className="mr-1.5 h-4 w-4" />Verificar no Sistema de Pedidos</>}
                  </Button>}
              {!fechada && (
                <Button className="h-9 bg-emerald-600 text-white hover:bg-emerald-500" disabled={falta.length > 0} onClick={onConcluir}
                  title={falta.length ? `Falta: ${falta.join(", ")}` : undefined}>
                  <PackageCheck className="mr-1.5 h-4 w-4" />Marcar como {((n: string) => n.charAt(0).toLowerCase() + n.slice(1))(STATUS_04[id].find(s => s.concluido)!.nome)}
                </Button>
              )}
              {!fechada && falta.length > 0 && <span className="text-[12px] text-amber-800 dark:text-amber-200">Para concluir falta: {falta.join(", ")}.</span>}
              {fechada && <span className="text-[12.5px] text-emerald-700 dark:text-emerald-300"><Check className="mr-1 inline h-4 w-4" />Concluída em {quando(e.concluidoEm!)} por {e.por}</span>}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* evidências */}
              <section className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" /><p className="text-xs font-semibold">Evidências</p>
                  <input ref={arquivo} type="file" accept={EVIDENCIA_ACEITA} className="sr-only" aria-label="Arquivo de evidência" onChange={ev => { const f = ev.target.files?.[0]; if (f) onEvidencia(f); ev.target.value = ""; }} />
                  <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" disabled={enviando} onClick={() => arquivo.current?.click()}>
                    {enviando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-1 h-3.5 w-3.5" />}Anexar
                  </Button>
                </div>
                {evid.length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">Nenhuma evidência. PDF, imagem, comprovante, e-mail ou documento.</p> : (
                  <ul className="mt-2 space-y-1.5">{evid.map(x => <ItemEvidencia key={x.id} x={x} />)}</ul>
                )}
                {consultas.length > 0 && (
                  <div className="mt-3 border-t pt-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Consultas ao Sistema de Pedidos</p>
                    <ul className="mt-1.5 space-y-1.5">{consultas.map((c, k) => (
                      <li key={k} className="text-[12px]"><b>Pedido {c.numero}</b>: {c.status} <span className="text-muted-foreground">· consultado em {dataBr04(c.data)} · registrado por {c.por} em {quando(c.em)} · {c.fonte === "manual" ? "manual" : "automático"}</span>
                        {c.observacao && <span className="block text-muted-foreground">{c.observacao}</span>}</li>
                    ))}</ul>
                  </div>
                )}
              </section>
              {/* histórico */}
              <section className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><p className="text-xs font-semibold">Histórico</p><span className="ml-auto text-[11px] text-muted-foreground">nunca é apagado</span></div>
                {hist.length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">Nenhuma alteração ainda.</p> : (
                  <ol className="mt-2 max-h-56 space-y-2 overflow-y-auto border-l-2 border-border pl-3">
                    {hist.map((h, k) => (
                      <li key={k} className="relative text-[12px]">
                        <span aria-hidden className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-primary" />
                        <span className="text-muted-foreground">{quando(h.em)} · {h.por}</span>
                        <span className="block"><b className="font-semibold">{h.campo}</b>{h.de !== "—" ? <>: de <span className="text-muted-foreground line-through decoration-muted-foreground/50">{h.de}</span> para <b className="font-semibold">{h.para}</b></> : <>: {h.para}</>}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function ItemEvidencia({ x }: { x: Evidencia }) {
  const abrir = async () => {
    if (!x.caminho) return;
    const url = await linkEvidencia(x.caminho);
    if (url) window.open(url, "_blank", "noopener"); else toast.error("Não foi possível abrir o anexo.");
  };
  return (
    <li className="flex items-center gap-2 text-[12.5px]">
      {x.tipo === "email" ? <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      {x.caminho ? <button type="button" onClick={() => void abrir()} className="min-w-0 truncate font-medium text-primary hover:underline">{x.nome}</button> : <span className="min-w-0 truncate font-medium">{x.nome}</span>}
      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{x.por} · {quando(x.em)}</span>
    </li>
  );
}

/* ─── O módulo ─── */

/**
 * Módulo 04 · Entrega de cartões e equipamentos: resumo, pendências e as três etapas, cada uma com
 * executante e responsável pelo acompanhamento separados, prazo, evidências e histórico.
 */
export function Modulo04({ project, estado, onChange, userName, linkPedidos }: {
  project: GerProject;
  estado: Modulo04Estado;
  onChange: (update: (e: Modulo04Estado) => Modulo04Estado) => void;
  userName: string;
  /** Link do pedido do projeto no Sistema de Pedidos (módulo 01), para abrir na consulta. */
  linkPedidos: string | null;
}) {
  const { user } = useAuth();
  const { data: assistente = null } = useQuery({ queryKey: ["assistente-projetos"], queryFn: fetchAssistenteProjetos, staleTime: 300_000 });
  const gp = project.manager?.full_name ?? "Gerente do Projeto";
  const pessoas: Pessoas04 = {
    executante: { cartoesAp: assistente ? `${assistente} · Assistente de Projetos` : "Assistente de Projetos", apAt: "AP", equipamentos: "AT / área de despacho" },
    acompanhamento: `${gp} · GP`,
  };
  const [aberta, setAberta] = useState<EtapaId04 | null>(null);
  const [comunicacao, setComunicacao] = useState(false);
  const [pedido, setPedido] = useState<"apAt" | "equipamentos" | null>(null);
  const [enviando, setEnviando] = useState<EtapaId04 | null>(null);

  const r = resumo04(estado);
  const pend = pendencias04(estado);
  const alterar = (id: EtapaId04, patch: Record<string, string>) => onChange(e => alterarEtapa(e, id, patch as never, userName));
  const concluir = (id: EtapaId04) => {
    const fim = STATUS_04[id].find(s => s.concluido)!.id;
    onChange(e => alterarEtapa(e, id, { status: fim, ...(e[id].efetiva ? {} : { efetiva: hoje04() }) } as never, userName));
    toast.success(`${tituloEtapa(id)}: concluída e registrada no histórico.`);
  };
  const anexar = async (id: EtapaId04, f: File) => {
    setEnviando(id);
    try {
      const ev = await enviarEvidencia(project.id, id, f, user?.id ?? null, userName);
      onChange(e => registrar({ ...e, evidencias: { ...e.evidencias, [id]: [...e.evidencias[id], ev] } }, id, "Evidência anexada", ev.nome, userName));
      toast.success("Evidência anexada. Ela também aparece nos anexos do projeto.");
    } catch (err) {
      toast.error("Não foi possível anexar.", { description: err instanceof Error ? err.message : String(err) });
    } finally { setEnviando(null); }
  };
  const comunicacaoCopiada = () => onChange(e => {
    const agora = new Date().toISOString();
    const jaTem = e.evidencias.cartoesAp.some(x => x.tipo === "email");
    const ev: Evidencia = { id: `email-${agora}`, tipo: "email", nome: "Comunicação de entrega para AP (e-mail)", em: agora, por: userName };
    const e2 = { ...e, cartoesAp: { ...e.cartoesAp, comunicacaoEm: e.cartoesAp.comunicacaoEm ?? agora }, evidencias: jaTem ? e.evidencias : { ...e.evidencias, cartoesAp: [...e.evidencias.cartoesAp, ev] } };
    return registrar(e2, "cartoesAp", "Comunicação de entrega", "preparada e copiada para o Outlook", userName, agora);
  });
  const registrarConsulta = async (etapa: "apAt" | "equipamentos", rc: RegistroConsulta) => {
    const anexo = rc.arquivo ? await enviarEvidencia(project.id, etapa, rc.arquivo, user?.id ?? null, userName) : null;
    onChange(e => {
      const patch: Record<string, string> = { pedido: rc.consulta.numero, statusPedido: rc.consulta.status };
      if (rc.status) patch.status = rc.status;
      if (rc.despacho) Object.assign(patch, Object.fromEntries(Object.entries(rc.despacho).filter(([, x]) => x)));
      let e2 = alterarEtapa(e, etapa, patch as never, userName);
      e2 = { ...e2, [etapa]: { ...e2[etapa], consultas: [...e2[etapa].consultas, rc.consulta] } };
      const ref: Evidencia = { id: `pedido-${rc.consulta.em}`, tipo: "pedido", nome: `Sistema de Pedidos · pedido ${rc.consulta.numero}: ${rc.consulta.status}`, em: rc.consulta.em, por: userName };
      e2 = { ...e2, evidencias: { ...e2.evidencias, [etapa]: [...e2.evidencias[etapa], ref, ...(anexo ? [anexo] : [])] } };
      return registrar(e2, etapa, "Consulta ao Sistema de Pedidos", `pedido ${rc.consulta.numero}: ${rc.consulta.status} (consulta de ${dataBr04(rc.consulta.data)}, manual)`, userName);
    });
    toast.success("Consulta registrada no histórico.");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* resumo */}
      <section aria-label="Resumo do módulo" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { l: "Concluídas", v: `${r.concluidas} de ${r.total}`, d: `${r.pct}% do módulo` },
          { l: "Pendentes", v: String(r.pendentes), d: r.proxima ? tituloEtapa(r.proxima) : "nenhuma" },
          { l: "Atrasadas", v: String(r.atrasadas), d: r.atrasadas ? "prazo vencido" : "tudo no prazo", alerta: r.atrasadas > 0 },
          { l: "Previsão de conclusão", v: dataBr04(r.previsao), d: r.situacao },
          { l: "Acompanhamento", v: gp.split(" ").slice(0, 2).join(" "), d: "Gerente do Projeto" },
        ].map(k => (
          <div key={k.l} className={cn("rounded-xl border bg-card px-4 py-3 shadow-sm", k.alerta ? "border-red-500/40" : "border-border/60")}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.l}</p>
            <p className={cn("mt-0.5 font-display text-2xl font-bold leading-tight", k.alerta && "text-red-700 dark:text-red-300")}>{k.v}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{k.d}</p>
          </div>
        ))}
      </section>

      {/* pendências */}
      {pend.length > 0 && (
        <section aria-labelledby="m4-pend" className="overflow-hidden rounded-xl border border-red-500/30 bg-card shadow-sm">
          <span aria-hidden className="block h-1 bg-gradient-to-r from-red-500 to-amber-400" />
          <div className="flex items-center gap-2 px-4 pb-2 pt-3">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <h3 id="m4-pend" className="text-base font-bold uppercase tracking-wide">Pendências</h3>
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold leading-none text-white">{pend.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead><tr className="border-y bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                {["Atividade", "Motivo", "Executante", "Acompanhamento", "Em aberto", "Próxima ação"].map(h => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>{pend.map((p, k) => (
                <tr key={k} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2"><button type="button" className="text-left font-semibold text-primary hover:underline" onClick={() => setAberta(p.etapa)}>{tituloEtapa(p.etapa)}</button></td>
                  <td className="px-3 py-2"><span className={cn("inline-flex items-start gap-1.5", p.grave ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200")}>
                    {p.grave ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{p.motivo}</span></td>
                  <td className="px-3 py-2">{pessoas.executante[p.etapa]}</td>
                  <td className="px-3 py-2">{pessoas.acompanhamento}</td>
                  <td className="px-3 py-2 tabular-nums">{p.dias} {p.dias === 1 ? "dia" : "dias"}</td>
                  <td className="px-3 py-2">{p.acao}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {/* etapas */}
      <ol className="space-y-3">
        {ETAPAS_04.map((id, i) => (
          <EtapaCard key={id} id={id} n={i + 1} estado={estado} pessoas={pessoas} aberta={aberta === id} onAlternar={() => setAberta(a => (a === id ? null : id))}
            onAlterar={p => alterar(id, p)} onEvidencia={f => void anexar(id, f)} enviando={enviando === id}
            onAbrirComunicacao={() => setComunicacao(true)} onAbrirPedido={() => setPedido(id as "apAt" | "equipamentos")} onConcluir={() => concluir(id)} />
        ))}
      </ol>
      <p className="text-[12px] text-muted-foreground">
        As etapas seguem esta ordem, mas a próxima não fica travada: ela mostra "Aguardando etapa anterior" e pode andar em paralelo.
      </p>

      <ComunicacaoDialog open={comunicacao} onOpenChange={setComunicacao} project={project} estado={estado} responsavel={pessoas.executante.cartoesAp}
        gp={userName} onPara={x => alterar("cartoesAp", { para: x })} onCopiado={comunicacaoCopiada} />
      {pedido && <PedidoDialog open onOpenChange={o => { if (!o) setPedido(null); }} etapa={pedido} estado={estado} linkPedidos={linkPedidos} userName={userName}
        onRegistrar={rc => registrarConsulta(pedido, rc)} />}
    </div>
  );
}

/** Resumo do módulo 04 no progresso do projeto (rodapé do cartão do módulo). */
export function ResumoModulo04({ estado, gp }: { estado: Modulo04Estado; gp: string | null }) {
  const r = resumo04(estado);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      <b className="font-semibold text-foreground">{r.pct}%</b>
      <span>Pendentes: <b className="font-semibold text-foreground">{r.pendentes}</b></span>
      <span className={r.atrasadas ? "font-semibold text-red-700 dark:text-red-300" : ""}>Atrasadas: <b>{r.atrasadas}</b></span>
      {r.proximaAcao && <span>Próxima ação: <b className="font-semibold text-foreground">{r.proximaAcao}</b></span>}
      <span>Previsão: <b className="font-semibold text-foreground">{dataBr04(r.previsao)}</b></span>
      {gp && <span>Acompanha: <b className="font-semibold text-foreground">{gp.split(" ").slice(0, 2).join(" ")}</b></span>}
    </span>
  );
}
