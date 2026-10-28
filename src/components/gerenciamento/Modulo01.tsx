import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Check, ClipboardList, Copy, ExternalLink, FileText, Lock, Mail, MessageSquareText, RadioTower,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ATIVIDADE_FIXA, MODULO_01, PERGUNTAS_HANDOVER, agora, dataBr, faltandoHandover, linkExterno, quando, respondidasHandover, situacao,
  type Atividade, type AtividadeId, type GerProject, type Modulo01Estado, type PerguntaHandoverId, type SituacaoAtividade,
} from "@/lib/gerenciamento";
import { NOME_OPERADORA } from "@/lib/coberturaOperadoras";
import { soDigitos } from "@/lib/dataCenterEmail";
import { pedidoDesignacaoGp } from "@/lib/pedidoSelo";
import { ChecklistPreRequisitos } from "./ChecklistPreRequisitos";
import { CodigoBdEmailDialog } from "./CodigoBdEmailDialog";
import { CoberturaEmailDialog } from "./CoberturaEmailDialog";
import { DataCenterEmailDialog } from "./DataCenterEmailDialog";
import { AbrirLink, Etapa, Registro } from "./Etapa";
import { PedidoSeloDialog } from "./PedidoSeloDialog";

async function copiar(texto: string, oque: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(`${oque} copiado. Cole no seu e-mail.`); }
  catch { toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."); }
}

/**
 * Módulo 01 · Abertura do projeto: as atividades do GP do cadastro até o Handover.
 * O estado vem de quem chama, que o grava no banco.
 */
export function Modulo01({ project, estado, onChange, userName, ordem, travada, onMover, onAtualizarProjeto, onGerarTap }: {
  project: GerProject;
  /** O Handover foi salvo como última atividade: gera o TAP com o módulo já completo. */
  onGerarTap?: (estado: Modulo01Estado) => void;
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
  const [emailBD, setEmailBD] = useState(false);
  const [pedidoAberto, setPedidoAberto] = useState(false);
  const pedido = pedidoDesignacaoGp(project);
  const codigo = project.project_code ?? "—";
  const lista = ordem.map(id => MODULO_01.atividades.find(a => a.id === id)).filter((a): a is Atividade => !!a);

  const desfazerTarefa = (id: "pedidos" | "totvs" | "drive") => onChange(e => { const feitos = { ...e.feitos }; delete feitos[id]; return { ...e, feitos }; });

  /** O que o GP anotou: link vira "Abrir …" (outra aba); número (anotações antigas) fica em negrito. */
  const valorAnotado = (a: Atividade, valor: string | undefined) => {
    if (!valor) return null;
    const href = linkExterno(valor);
    return href
      ? <> · <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{a.campo?.abrir ?? "Abrir link"}<ExternalLink className="h-3 w-3" /></a></>
      : <> · nº <b>{valor}</b></>;
  };

  const tarefa = (a: Atividade) => {
    const id = a.id as "pedidos" | "totvs" | "drive";
    const f = estado.feitos[id];
    if (f) {
      return (
        <Registro texto={`Feito em ${quando(f.em)} por ${f.por}`} onDesfazer={() => desfazerTarefa(id)}>
          {valorAnotado(a, f.valor)}
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
        {a.campo?.url && <AbrirLink href={linkExterno(campos[id])} />}
        <Button className="h-9" onClick={() => onChange(e => ({ ...e, feitos: { ...e.feitos, [id]: { em: agora(), por: userName, valor: campos[id]?.trim() || undefined } } }))}>
          <Check className="mr-1.5 h-4 w-4" />Marcar como feito
        </Button>
      </div>
    );
  };

  const pedidos = (a: Atividade) => {
    const f = estado.feitos.pedidos;
    // copiar o pedido conclui a atividade; copiar de novo mantém a 1ª data e o nº já informado
    const concluir = () => onChange(e => ({ ...e, feitos: { ...e.feitos, pedidos: {
      em: e.feitos.pedidos?.em ?? agora(), por: e.feitos.pedidos?.por ?? userName, valor: e.feitos.pedidos?.valor ?? (campos.pedidos?.trim() || undefined),
    } } }));
    const link = campos.pedidos?.trim() ?? "";
    const salvarLink = () => onChange(e => (e.feitos.pedidos ? { ...e, feitos: { ...e.feitos, pedidos: { ...e.feitos.pedidos, valor: link } } } : e));
    const verPedido = <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setPedidoAberto(true)}>Ver pedido</button>;
    return (
      <>
        {f ? (
          <div className="space-y-2">
            <Registro texto={`Feito em ${quando(f.em)} por ${f.por}`} onDesfazer={() => desfazerTarefa("pedidos")}>
              {valorAnotado(a, f.valor)}{" · "}{verPedido}
            </Registro>
            {!f.valor && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 basis-56">
                  <Label className="text-xs" htmlFor="ger-pedidos-link">Link do pedido no sistema de pedidos (opcional, pode informar depois)</Label>
                  <Input id="ger-pedidos-link" className="mt-1.5 h-9" type="url" placeholder={a.campo?.placeholder}
                    value={campos.pedidos ?? ""} onChange={ev => setCampos(c => ({ ...c, pedidos: ev.target.value }))} />
                </div>
                <AbrirLink href={linkExterno(link)} />
                <Button variant="outline" className="h-9" disabled={!link} onClick={salvarLink}><Check className="mr-1.5 h-4 w-4" />Salvar link</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button className="h-9" onClick={() => setPedidoAberto(true)}>
                <ClipboardList className="mr-1.5 h-4 w-4" />Gerar pedido para copiar
              </Button>
              <span className="text-[12px] text-muted-foreground">Selo <b className="font-semibold">{pedido.selo}</b> · copie e cole no sistema de pedidos</span>
            </div>
            {tarefa(a)}
          </div>
        )}
        {/* fora do condicional: ao concluir, o diálogo aberto continua o mesmo */}
        <PedidoSeloDialog open={pedidoAberto} onOpenChange={setPedidoAberto} project={project} pedido={pedido}
          onCopiado={concluir} onAtualizarProjeto={onAtualizarProjeto} />
      </>
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
            <Button className="h-9" onClick={() => setEmailDC(true)}>
              <Mail className="mr-1.5 h-4 w-4" />Montar e-mail ao Data Center
            </Button>
            <Button className="h-9" onClick={concluir}><Check className="mr-1.5 h-4 w-4" />Marcar como feito</Button>
            <span className="text-[12px] text-muted-foreground">se o pedido foi feito por fora do portal</span>
          </div>
        )}
        {/* fora do condicional: ao concluir, o diálogo aberto continua o mesmo */}
        <DataCenterEmailDialog open={emailDC} onOpenChange={setEmailDC} project={project} form={d.email} gp={userName}
          codigoBD={estado.codigobd.registradoEm ? estado.codigobd.codigo : undefined}
          onForm={email => set({ email })} onCopiado={concluir} onAtualizarProjeto={onAtualizarProjeto} />
      </>
    );
  };

  const codigobd = () => {
    const c = estado.codigobd;
    const set = (patch: Partial<Modulo01Estado["codigobd"]>) => onChange(e => ({ ...e, codigobd: { ...e.codigobd, ...patch } }));
    // copiar o e-mail deixa a atividade aguardando o código; copiar de novo mantém a 1ª data
    const enviado = () => onChange(e => ({ ...e, codigobd: { ...e.codigobd, enviadoEm: e.codigobd.enviadoEm ?? agora() } }));
    const digitado = soDigitos(campos.codigobd ?? "").slice(0, 5);
    const registrar = () => set({ codigo: digitado.padStart(5, "0"), registradoEm: agora(), por: userName });
    const verEmail = <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setEmailBD(true)}>Ver e-mail</button>;
    return (
      <>
        {c.registradoEm ? (
          <Registro texto={`Código BD `} onDesfazer={() => set({ registradoEm: null })}>
            <b className="font-mono">{c.codigo}</b> registrado em {quando(c.registradoEm)} por {c.por || userName} · vai no e-mail ao Data Center · {verEmail}
          </Registro>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button className="h-9" onClick={() => setEmailBD(true)}><Mail className="mr-1.5 h-4 w-4" />Montar e-mail do código BD</Button>
              {c.enviadoEm
                ? <span className="text-[12px] text-amber-800 dark:text-amber-200">E-mail enviado em {quando(c.enviadoEm)} · aguardando o código BD</span>
                : <span className="text-[12px] text-muted-foreground">para meusuporte@itstransdata.com · copie e cole no Outlook</span>}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full sm:w-56">
                <Label className="text-xs" htmlFor="ger-codigobd">Código BD do cliente (5 dígitos)</Label>
                <Input id="ger-codigobd" inputMode="numeric" maxLength={5} placeholder="00745" className="mt-1.5 h-9 font-mono"
                  value={campos.codigobd ?? ""} onChange={ev => setCampos(s => ({ ...s, codigobd: soDigitos(ev.target.value).slice(0, 5) }))} />
              </div>
              <Button className="h-9" disabled={!digitado} onClick={registrar}><Check className="mr-1.5 h-4 w-4" />Marcar como feito</Button>
              <span className="min-w-0 flex-1 basis-56 pb-2 text-[12px] text-muted-foreground">O código vai direto para o e-mail ao Data Center.</span>
            </div>
          </div>
        )}
        {/* fora do condicional: ao registrar, o diálogo aberto continua o mesmo */}
        <CodigoBdEmailDialog open={emailBD} onOpenChange={setEmailBD} project={project} gp={userName}
          onCopiado={enviado} onAtualizarProjeto={onAtualizarProjeto} />
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
    const respostas = h.respostas ?? {};
    const responder = (id: PerguntaHandoverId, texto: string) => onChange(e => ({ ...e, handover: { ...e.handover, respostas: { ...e.handover.respostas, [id]: texto } } }));
    if (h.registradoEm) {
      return (
        <div className="space-y-3">
          <Registro texto={`Handover registrado em ${quando(h.registradoEm)} por ${userName}`} onDesfazer={() => set({ registradoEm: null })}>
            {h.previsaoEquipamentos && <> · equipamentos previstos para <b>{dataBr(h.previsaoEquipamentos)}</b></>}
          </Registro>
          {respondidasHandover(h) > 0 && (
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Perguntas ao Executivo de Vendas</p>
              <dl className="mt-1.5 space-y-1.5 text-[13px]">
                {PERGUNTAS_HANDOVER.map((q, i) => (
                  <div key={q.id} className="grid gap-x-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <dt className="text-muted-foreground">{i + 1}. {q.curto}</dt>
                    <dd className="whitespace-pre-line font-medium">{respostas[q.id]?.trim() || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
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
    const respondidas = respondidasHandover(h);
    const falta = faltandoHandover(h);
    // é a última atividade que falta no módulo? salvar já gera o TAP
    const fechaModulo = lista.every(a => a.id === "handover" || ["feito", "naoaplica"].includes(situacao(a.id, estado, project, ordem)));
    const salvar = () => {
      const novo: Modulo01Estado = { ...estado, handover: { ...estado.handover, registradoEm: agora() } };
      onChange(() => novo);
      if (fechaModulo) onGerarTap?.(novo);
    };
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div><Label className="text-xs" htmlFor="ger-ho-data">Data e hora da reunião *</Label><Input id="ger-ho-data" type="datetime-local" className="mt-1.5 h-9" value={h.agendadoPara} onChange={ev => set({ agendadoPara: ev.target.value })} /></div>
          <div><Label className="text-xs" htmlFor="ger-ho-part">Participantes</Label><Input id="ger-ho-part" className="mt-1.5 h-9" placeholder={`Executivo de Vendas: ${project.executive?.full_name ?? "—"}, GP: ${project.manager?.full_name ?? "—"}`} value={h.participantes} onChange={ev => set({ participantes: ev.target.value })} /></div>
        </div>

        {/* Questionário: tudo o que não pode deixar de ser perguntado ao Executivo de Vendas */}
        <section aria-labelledby="ger-ho-perguntas" className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-3.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <MessageSquareText className="h-4 w-4 text-primary" aria-hidden />
            <h4 id="ger-ho-perguntas" className="text-[14px] font-semibold">Perguntas ao Executivo de Vendas</h4>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${respondidas === PERGUNTAS_HANDOVER.length ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
              {respondidas} de {PERGUNTAS_HANDOVER.length} respondidas
            </span>
            <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-primary/15" aria-hidden>
              <span className="block h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(respondidas / PERGUNTAS_HANDOVER.length) * 100}%` }} />
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Faça as cinco perguntas a {project.executive?.full_name ?? "o Executivo de Vendas"}. Todas são obrigatórias: se não houver nada, responda "Não".
          </p>
          <ol className="space-y-2.5">
            {PERGUNTAS_HANDOVER.map((q, i) => {
              const r = respostas[q.id] ?? "";
              const ok = !!r.trim();
              return (
                <li key={q.id} className={`rounded-lg border bg-card p-3 transition-colors ${ok ? "border-emerald-500/40" : "border-border/70"}`}>
                  <div className="flex items-start gap-2.5">
                    <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${ok ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary"}`}>
                      {ok ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <Label htmlFor={`ger-ho-q-${q.id}`} className="text-[13.5px] font-medium leading-snug">{q.texto}</Label>
                  </div>
                  <Textarea id={`ger-ho-q-${q.id}`} className="mt-2 min-h-[64px]" placeholder="Resposta do Executivo de Vendas"
                    value={r} onChange={ev => responder(q.id, ev.target.value)} />
                  {!ok && (
                    <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs text-muted-foreground" onClick={() => responder(q.id, "Não.")}>
                      Responder "Não"
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid items-end gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <Label className="text-xs" htmlFor="ger-ho-equip">Previsão de entrega dos equipamentos *</Label>
            <Input id="ger-ho-equip" type="date" className="mt-1.5 h-9" value={h.previsaoEquipamentos ?? ""} onChange={ev => set({ previsaoEquipamentos: ev.target.value })} />
          </div>
          <p className="pb-2 text-[12px] text-muted-foreground">Data combinada para os equipamentos chegarem ao cliente. Vai no TAP.</p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Anotações do Handover (opcional)</p>
          <div className="grid gap-3 md:grid-cols-3">
            {blocos.map(b => (
              <div key={b.k}>
                <Label className="text-xs" htmlFor={`ger-ho-${b.k}`}>{b.l}</Label>
                <Textarea id={`ger-ho-${b.k}`} className="mt-1.5 min-h-[96px]" value={h[b.k]} onChange={ev => set({ [b.k]: ev.target.value })} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          {falta.length > 0
            ? <p className="flex min-w-0 flex-1 basis-60 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Falta: {falta.join(", ")}.</p>
            : <p className="min-w-0 flex-1 basis-60 text-[13px] text-muted-foreground">{fechaModulo ? "É a última atividade do módulo: ao salvar, o módulo chega a 100% e o TAP já é gerado." : "Tudo respondido. Salve para registrar o Handover."}</p>}
          <Button className="h-9" disabled={falta.length > 0} onClick={salvar}>
            {fechaModulo ? <><FileText className="mr-1.5 h-4 w-4" />Salvar Handover e gerar o TAP</> : <><Check className="mr-1.5 h-4 w-4" />Salvar Handover</>}
          </Button>
        </div>
      </div>
    );
  };

  const carrier = (sit: SituacaoAtividade) => {
    const c = estado.carrier;
    const set = (patch: Partial<Modulo01Estado["carrier"]>) => onChange(e => ({ ...e, carrier: { ...e.carrier, ...patch } }));
    if (sit === "naoaplica") return <p className="text-[13px] text-muted-foreground">Só nos projetos com Carrier, ITS ou Gestão de Frota. Este projeto não tem nenhuma dessas soluções.</p>;
    // copiar o e-mail (ou avisar que enviou por fora) conclui; copiar de novo mantém a 1ª data
    const concluir = (recs: Modulo01Estado["carrier"]["recomendadas"]) =>
      onChange(e => ({ ...e, carrier: {
        ...e.carrier, concluidoEm: e.carrier.concluidoEm ?? agora(),
        recomendada: recs.length ? recs[0].operadora : e.carrier.recomendada,
        recomendadas: recs.length ? recs : e.carrier.recomendadas,
      } }));
    // várias cidades: "Caçador/SC: Claro · Videira/SC: Vivo"
    const recTexto = (c.recomendadas?.length ?? 0) > 1
      ? ` · recomendadas: ${c.recomendadas.map(r => `${r.cidade}: ${r.operadora ? NOME_OPERADORA[r.operadora] : "nenhuma"}`).join(" · ")}`
      : c.recomendada ? ` · recomendada: ${NOME_OPERADORA[c.recomendada]}` : "";
    return (
      <>
        {c.concluidoEm ? (
          <Registro texto={`E-mail de cobertura enviado em ${quando(c.concluidoEm)} por ${userName}${recTexto}`}
            onDesfazer={() => set({ concluidoEm: null })}>
            {" · "}<button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setEmailCobertura(true)}>Ver e-mail</button>
          </Registro>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-9" onClick={() => setEmailCobertura(true)}>
              <RadioTower className="mr-1.5 h-4 w-4" />Montar e-mail de cobertura
            </Button>
            <Button className="h-9" onClick={() => concluir([])}><Check className="mr-1.5 h-4 w-4" />Marcar como feito</Button>
            <span className="text-[12px] text-muted-foreground">se o e-mail foi enviado por fora do portal</span>
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
      case "pedidos": return pedidos(a);
      case "totvs": case "drive": return tarefa(a);
      case "checklist": return <ChecklistPreRequisitos project={project} estado={estado} onChange={onChange} userName={userName} />;
      case "codigobd": return codigobd();
      case "datacenter": return datacenter();
      case "handover": return handover();
      case "carrier": return carrier(sit);
    }
  };

  const pillDe = (a: Atividade, sit: SituacaoAtividade) =>
    sit !== "aguardando" ? undefined : a.id === "checklist" ? "Com pendências" : a.id === "codigobd" ? "Aguardando o código" : "Aguardando o Data Center";

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
