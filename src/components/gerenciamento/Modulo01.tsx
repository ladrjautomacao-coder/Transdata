import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, Check, CheckCircle2, Copy, ExternalLink, Lock, Mail, RadioTower, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ATIVIDADE_FIXA, MODULO_01, RESPONSAVEL_LABEL, situacao,
  type Atividade, type AtividadeId, type GerProject, type Modulo01Estado, type SituacaoAtividade,
} from "@/lib/gerenciamento";
import { NOME_OPERADORA, type OperadoraCobertura } from "@/lib/coberturaOperadoras";
import { ChecklistPreRequisitos } from "./ChecklistPreRequisitos";
import { CoberturaEmailDialog } from "./CoberturaEmailDialog";
import { DataCenterEmailDialog } from "./DataCenterEmailDialog";

const p2 = (n: number) => String(n).padStart(2, "0");
/** 25/10/2026 às 14:30 */
const quando = (iso: string) => { const d = new Date(iso); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const agora = () => new Date().toISOString();

const SITUACAO: Record<SituacaoAtividade, { dot: string; pill: string; label: string }> = {
  feito: { dot: "bg-emerald-600 text-white", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Feito" },
  afazer: { dot: "bg-primary text-primary-foreground", pill: "bg-primary/10 text-primary", label: "A fazer" },
  aguardando: { dot: "bg-amber-500 text-white", pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200", label: "Aguardando" },
  bloqueado: { dot: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground", label: "Aguarda o checklist" },
  naoaplica: { dot: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground", label: "Não se aplica" },
};

async function copiar(texto: string, oque: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(`${oque} copiado. Cole no seu e-mail.`); }
  catch { toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."); }
}

/** Setas para subir/descer a atividade enquanto a ordem oficial não é definida. */
interface Mover { up: boolean; down: boolean; onMove: (dir: -1 | 1) => void }

/** Uma atividade na linha do módulo: número/estado à esquerda, cartão à direita. */
function Etapa({ n, a, sit, pill, last, mover, children }: { n: number; a: Atividade; sit: SituacaoAtividade; pill?: string; last: boolean; mover?: Mover; children: ReactNode }) {
  const s = SITUACAO[sit];
  const muted = sit === "bloqueado" || sit === "naoaplica";
  return (
    <li className="relative pl-11 sm:pl-12">
      <span aria-hidden className={`absolute left-0 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ring-4 ring-background ${s.dot}`}>
        {sit === "feito" ? <Check className="h-4 w-4" /> : sit === "bloqueado" ? <Lock className="h-4 w-4" /> : n}
      </span>
      {!last && <span aria-hidden className="absolute bottom-[-14px] left-[17px] top-12 w-0.5 bg-border" />}
      <div className={`rounded-xl border p-4 ${muted ? "border-dashed border-border bg-muted/30" : "border-border/60 bg-card shadow-sm"}`}>
        {/* no celular os selos descem para baixo do título */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={`text-[15px] font-semibold ${muted ? "text-muted-foreground" : ""}`}>{a.titulo}</h3>
            <p className="text-[13px] text-muted-foreground">{a.descricao}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:order-last">
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{RESPONSAVEL_LABEL[a.responsavel]}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}>{pill ?? s.label}</span>
            {mover && (
              <span className="ml-1 flex overflow-hidden rounded-md border border-border/70 bg-background">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" disabled={!mover.up} onClick={() => mover.onMove(-1)} aria-label={`Subir ${a.titulo}`} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border-l border-border/70" disabled={!mover.down} onClick={() => mover.onMove(1)} aria-label={`Descer ${a.titulo}`} title="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
              </span>
            )}
          </div>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

/** Linha "Feito em … por …" com desfazer. */
function Registro({ texto, onDesfazer, children }: { texto: string; onDesfazer?: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-[13px]">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0 flex-1">{texto}{children}</span>
      {onDesfazer && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onDesfazer}><RotateCcw className="mr-1 h-3.5 w-3.5" />Desfazer</Button>}
    </div>
  );
}

/**
 * Módulo 01 · Abertura do projeto: as atividades do GP do cadastro até o Handover.
 * Protótipo: o estado vem de quem chama e ainda não é gravado.
 */
export function Modulo01({ project, estado, onChange, userName, ordem, travada, onMover, onAtualizarProjeto }: {
  project: GerProject;
  /** Relê o cadastro do projeto sem sair da tela. */
  onAtualizarProjeto: () => Promise<unknown>;
  estado: Modulo01Estado;
  onChange: (update: (e: Modulo01Estado) => Modulo01Estado) => void;
  userName: string;
  /** Ordem atual das atividades. */
  ordem: AtividadeId[];
  /** Ordem travada: some as setas de subir/descer. */
  travada: boolean;
  onMover: (id: AtividadeId, dir: -1 | 1) => void;
}) {
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [emailDC, setEmailDC] = useState(false);
  const [emailCobertura, setEmailCobertura] = useState(false);
  const codigo = project.project_code ?? "—";
  const lista = ordem.map(id => MODULO_01.atividades.find(a => a.id === id)).filter((a): a is Atividade => !!a);

  const tarefa = (a: Atividade) => {
    const id = a.id as "pedidos" | "totvs" | "drive";
    const f = estado.feitos[id];
    if (f) {
      return (
        <Registro texto={`Feito em ${quando(f.em)} por ${f.por}`} onDesfazer={() => onChange(e => { const feitos = { ...e.feitos }; delete feitos[id]; return { ...e, feitos }; })}>
          {f.valor && (a.campo?.url
            ? <> · <a href={f.valor} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Abrir pasta<ExternalLink className="h-3 w-3" /></a></>
            : <> · <b>{f.valor}</b></>)}
        </Registro>
      );
    }
    return (
      <div className="flex flex-wrap items-end gap-2">
        {id === "totvs" && (
          <div className="w-full rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
            Código do projeto para o TOTVS: <b className="font-mono">{codigo}</b>
            <Button variant="ghost" size="sm" className="ml-1 h-7 px-2 text-xs" onClick={() => copiar(codigo, "Código")}><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button>
          </div>
        )}
        {a.campo && (
          <div className="min-w-0 flex-1 basis-56">
            <Label className="text-xs" htmlFor={`ger-${id}`}>{a.campo.label}</Label>
            <Input id={`ger-${id}`} className="mt-1.5 h-9" type={a.campo.url ? "url" : "text"} placeholder={a.campo.placeholder}
              value={campos[id] ?? ""} onChange={ev => setCampos(c => ({ ...c, [id]: ev.target.value }))} />
          </div>
        )}
        <Button className="h-9" onClick={() => onChange(e => ({ ...e, feitos: { ...e.feitos, [id]: { em: agora(), por: userName, valor: campos[id]?.trim() || undefined } } }))}>
          <Check className="mr-1.5 h-4 w-4" />Marcar como feito
        </Button>
      </div>
    );
  };

  const datacenter = () => {
    const d = estado.datacenter;
    const set = (patch: Partial<Modulo01Estado["datacenter"]>) => onChange(e => ({ ...e, datacenter: { ...e.datacenter, ...patch } }));
    // copiar o e-mail (ou avisar que pediu por fora) já conclui a atividade; copiar de novo mantém a 1ª data
    const concluir = () => onChange(e => ({ ...e, datacenter: { ...e.datacenter, concluidoEm: e.datacenter.concluidoEm ?? agora() } }));
    return (
      <>
        {d.concluidoEm ? (
          <Registro texto={`Pedido ao Data Center feito em ${quando(d.concluidoEm)} por ${userName}`} onDesfazer={() => set({ concluidoEm: null })}>
            {d.email && <> · <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setEmailDC(true)}>Ver e-mail</button></>}
          </Registro>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8" onClick={() => setEmailDC(true)}>
              <Mail className="mr-1.5 h-3.5 w-3.5" />Montar e-mail ao Data Center
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={concluir}>Já pedi por fora: marcar como feito</Button>
          </div>
        )}
        {/* fora do condicional: ao concluir, o diálogo aberto continua o mesmo */}
        <DataCenterEmailDialog open={emailDC} onOpenChange={setEmailDC} project={project} form={d.email} gp={userName}
          onForm={email => set({ email })} onCopiado={concluir} onAtualizarProjeto={onAtualizarProjeto} />
      </>
    );
  };

  const handover = () => {
    const h = estado.handover;
    const set = (patch: Partial<Modulo01Estado["handover"]>) => onChange(e => ({ ...e, handover: { ...e.handover, ...patch } }));
    const blocos = [
      { k: "particularidades" as const, l: "Particularidades do projeto" },
      { k: "atencao" as const, l: "Pontos de atenção" },
      { k: "expectativas" as const, l: "Expectativas do cliente" },
    ];
    if (h.registradoEm) {
      return (
        <div className="space-y-3">
          <Registro texto={`Handover registrado em ${quando(h.registradoEm)} por ${userName}`} onDesfazer={() => set({ registradoEm: null })} />
          <div className="grid gap-3 md:grid-cols-3">
            {blocos.map(b => (
              <div key={b.k} className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{b.l}</p>
                <p className="mt-1 whitespace-pre-line text-[13px]">{h[b.k] || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div><Label className="text-xs" htmlFor="ger-ho-data">Data e hora da reunião *</Label><Input id="ger-ho-data" type="datetime-local" className="mt-1.5 h-9" value={h.agendadoPara} onChange={ev => set({ agendadoPara: ev.target.value })} /></div>
          <div><Label className="text-xs" htmlFor="ger-ho-part">Participantes</Label><Input id="ger-ho-part" className="mt-1.5 h-9" placeholder={`Executivo de Vendas: ${project.executive?.full_name ?? "—"}, GP: ${project.manager?.full_name ?? "—"}`} value={h.participantes} onChange={ev => set({ participantes: ev.target.value })} /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {blocos.map(b => (
            <div key={b.k}>
              <Label className="text-xs" htmlFor={`ger-ho-${b.k}`}>{b.l}</Label>
              <Textarea id={`ger-ho-${b.k}`} className="mt-1.5 min-h-[96px]" value={h[b.k]} onChange={ev => set({ [b.k]: ev.target.value })} />
            </div>
          ))}
        </div>
        <Button disabled={!h.agendadoPara} onClick={() => set({ registradoEm: agora() })}><Check className="mr-1.5 h-4 w-4" />Registrar Handover</Button>
      </div>
    );
  };

  const carrier = (sit: SituacaoAtividade) => {
    const c = estado.carrier;
    const set = (patch: Partial<Modulo01Estado["carrier"]>) => onChange(e => ({ ...e, carrier: { ...e.carrier, ...patch } }));
    if (sit === "naoaplica") return <p className="text-[13px] text-muted-foreground">Só nos projetos com Carrier, ITS ou Gestão de Frota. Este projeto não tem nenhuma dessas soluções.</p>;
    // copiar o e-mail (ou avisar que enviou por fora) conclui; copiar de novo mantém a 1ª data
    const concluir = (rec: OperadoraCobertura | null) =>
      onChange(e => ({ ...e, carrier: { ...e.carrier, concluidoEm: e.carrier.concluidoEm ?? agora(), recomendada: rec ?? e.carrier.recomendada } }));
    return (
      <>
        {c.concluidoEm ? (
          <Registro texto={`E-mail de cobertura enviado em ${quando(c.concluidoEm)} por ${userName}${c.recomendada ? ` · recomendada: ${NOME_OPERADORA[c.recomendada]}` : ""}`}
            onDesfazer={() => set({ concluidoEm: null })}>
            {" · "}<button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setEmailCobertura(true)}>Ver e-mail</button>
          </Registro>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8" onClick={() => setEmailCobertura(true)}>
              <RadioTower className="mr-1.5 h-3.5 w-3.5" />Montar e-mail de cobertura
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => concluir(null)}>Já enviei por fora: marcar como feito</Button>
          </div>
        )}
        {/* fora do condicional: ao concluir, o diálogo aberto continua o mesmo */}
        <CoberturaEmailDialog open={emailCobertura} onOpenChange={setEmailCobertura} project={project} estado={c} onEstado={set}
          remetente={userName} onCopiado={concluir} />
      </>
    );
  };

  const corpo = (a: Atividade, sit: SituacaoAtividade): ReactNode => {
    if (sit === "bloqueado") {
      return <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" />Bloqueado até o checklist estar atendido ou com exceção autorizada pela diretoria.</p>;
    }
    switch (a.id) {
      case "portal":
        return (
          <dl className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-muted-foreground">Código</dt><dd className="font-mono font-medium">{codigo}</dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground">Cadastrado em</dt><dd className="font-medium">{quando(project.created_at)}</dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground">GP</dt><dd className="font-medium">{project.manager?.full_name ?? "Sem GP"}</dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground">Executivo de Vendas</dt><dd className="font-medium">{project.executive?.full_name ?? "—"}</dd></div>
          </dl>
        );
      case "pedidos": case "totvs": case "drive": return tarefa(a);
      case "checklist": return <ChecklistPreRequisitos project={project} estado={estado} onChange={onChange} userName={userName} />;
      case "datacenter": return datacenter();
      case "handover": return handover();
      case "carrier": return carrier(sit);
    }
  };

  const pillDe = (a: Atividade, sit: SituacaoAtividade) =>
    sit !== "aguardando" ? undefined : a.id === "checklist" ? "Com pendências" : "Aguardando o Data Center";

  return (
    <ol className="space-y-3.5">
      {lista.map((a, i) => {
        const sit = situacao(a.id, estado, project, ordem);
        // o cadastro no portal fica sempre em 1º; as demais sobem até a 2ª posição
        const mover = travada || a.id === ATIVIDADE_FIXA ? undefined
          : { up: i > 1, down: i < lista.length - 1, onMove: (dir: -1 | 1) => onMover(a.id, dir) };
        return <Etapa key={a.id} n={i + 1} a={a} sit={sit} pill={pillDe(a, sit)} last={i === lista.length - 1} mover={mover}>{corpo(a, sit)}</Etapa>;
      })}
    </ol>
  );
}
