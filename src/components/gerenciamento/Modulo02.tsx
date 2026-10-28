import { useState, type ReactNode } from "react";
import {
  AlertTriangle, CalendarCheck, CalendarClock, Check, CheckCircle2, Circle, FileText, KeyRound, Laptop, Lock, Mail, Plane, ReceiptText, ScanLine, Send, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agora, dataBr, dataHoraBr, quando, type GerProject, type SituacaoAtividade } from "@/lib/gerenciamento";
import {
  MEIO_LABEL, MODULO_02, bloqueio02, contaCustos, diasAtePe, faltandoCustos, linhasCustos, moeda, prazoPe, situacao02, valorBr,
  type AtividadeId02, type MeioDeslocamento, type Modulo02Estado,
} from "@/lib/modulo02";
import {
  assuntoCustos, assuntoFinanceiro, emailHtmlCustos, emailHtmlFinanceiro, emailTextoCustos, emailTextoFinanceiro, linhasVisita, periodoViagem,
} from "@/lib/visitaPeEmail";
import { cartoesDoTermo, qtdTermo } from "@/lib/termoCartoes";
import { CartoesTermo } from "./CartoesTermo";
import { Seg } from "./DataCenterEmailDialog";
import { Etapa, Registro } from "./Etapa";
import { TermoCartoesDialog } from "./TermoCartoesDialog";
import { VisitaPeEmailDialog } from "./VisitaPeEmailDialog";

const p2 = (n: number) => String(n).padStart(2, "0");
/** Hoje em AAAA-MM-DD (data local). */
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

/** Valor em reais digitado como o GP escreve ("1.250,00"). */
function CampoValor({ id, label, value, onChange, className = "" }: { id: string; label: string; value: string; onChange: (v: string) => void; className?: string }) {
  const invalido = value.trim() !== "" && valorBr(value) === null;
  return (
    <div className={className}>
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">R$</span>
        <Input id={id} inputMode="decimal" placeholder="0,00" className={`h-9 pl-9 tabular-nums ${invalido ? "border-destructive" : ""}`}
          value={value} onChange={ev => onChange(ev.target.value.replace(/[^\d.,]/g, ""))} />
      </div>
      {invalido && <p className="mt-1 text-[11px] text-destructive">Use só números, ex.: 1.250,00</p>}
    </div>
  );
}

/** Lembrete do que não pode ficar para trás na viagem. */
function Lembrete({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-900 dark:text-amber-100">
      <span className="mt-0.5 shrink-0">{icone}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Rodapé das atividades com formulário: o que falta, ou a dica, e o botão. */
function Rodape({ falta, dica, children }: { falta: string[]; dica: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-3">
      {falta.length > 0
        ? <p className="flex min-w-0 flex-1 basis-60 items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Falta: {falta.join(", ")}.</p>
        : <p className="min-w-0 flex-1 basis-60 text-[13px] text-muted-foreground">{dica}</p>}
      {children}
    </div>
  );
}

/** A reunião de PE agendada (ou o aviso de que falta agendar), no medidor e no destaque do módulo. */
export function ReuniaoPe({ reuniaoPe, sobreMarca = false }: { reuniaoPe: string | null; sobreMarca?: boolean }) {
  const dias = reuniaoPe ? diasAtePe(reuniaoPe) : null;
  const cor = sobreMarca ? "bg-primary-foreground/15" : reuniaoPe ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  return (
    <p className={`inline-flex flex-wrap items-center gap-x-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${cor}`}>
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
      {reuniaoPe ? <>Reunião de PE: <b>{dataHoraBr(reuniaoPe)}</b>{dias !== null && <span>· {prazoPe(dias)}</span>}</> : "Reunião de PE ainda não agendada"}
    </p>
  );
}

/** Tabela dos custos (registro dos custos e da aprovação). */
function TabelaCustos({ c }: { c: Modulo02Estado["custos"] }) {
  return (
    <dl className="divide-y overflow-hidden rounded-lg border border-border/60 text-[13px]">
      {linhasCustos(c).map(l => (
        <div key={l.item} className="flex flex-wrap items-baseline gap-x-3 px-3 py-1.5">
          <dt className="font-medium">{l.item}</dt>
          <dd className="min-w-0 flex-1 text-muted-foreground">{l.detalhe}</dd>
          <dd className="font-semibold tabular-nums">{moeda(l.valor)}</dd>
        </div>
      ))}
      <div className="flex items-baseline gap-3 bg-muted/50 px-3 py-2">
        <dt className="flex-1 font-semibold">Total</dt>
        <dd className="text-base font-bold tabular-nums text-primary">{moeda(contaCustos(c).total)}</dd>
      </div>
    </dl>
  );
}

/**
 * Módulo 02 · Preparação da visita de PE: do contato com o cliente até o material da gravação
 * dos cartões pronto para a viagem. O estado vem de quem chama, que o grava no banco.
 */
export function Modulo02({ project, estado, onChange, userName, emailCliente }: {
  project: GerProject;
  estado: Modulo02Estado;
  onChange: (update: (e: Modulo02Estado) => Modulo02Estado) => void;
  userName: string;
  /** E-mail do cliente já usado no módulo 01 (cobertura das operadoras): sugestão para os custos. */
  emailCliente?: string;
}) {
  const [emailCustos, setEmailCustos] = useState(false);
  const [emailFinanceiro, setEmailFinanceiro] = useState(false);
  const [termoAberto, setTermoAberto] = useState(false);
  const set = <K extends keyof Modulo02Estado>(k: K, patch: Partial<Modulo02Estado[K]>) =>
    onChange(e => ({ ...e, [k]: { ...e[k], ...patch } }));
  const verEmail = (abrir: () => void) => <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={abrir}>Ver e-mail</button>;
  const gp = project.manager?.full_name ?? userName;
  const total = moeda(contaCustos(estado.custos).total);

  const contato = () => {
    const c = estado.contato;
    if (c.registradoEm) {
      const dias = diasAtePe(c.reuniaoPe);
      return (
        <Registro texto="Reunião de PE agendada para " rotulo="Alterar" onDesfazer={() => set("contato", { registradoEm: null })}>
          <b>{dataHoraBr(c.reuniaoPe)}</b>{dias !== null && <> ({prazoPe(dias)})</>}
          {c.local.trim() && <> · {c.local.trim()}</>}{c.com.trim() && <> · combinado com {c.com.trim()}</>} · registrado por {c.por || userName}
        </Registro>
      );
    }
    const salvar = () => set("contato", { com: c.com.trim() || project.client_manager_name || "", registradoEm: agora(), por: userName });
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_230px]">
          <div>
            <Label className="text-xs" htmlFor="pe-com">Contato no cliente</Label>
            <Input id="pe-com" className="mt-1.5 h-9" placeholder={project.client_manager_name || "Com quem você falou"} value={c.com} onChange={ev => set("contato", { com: ev.target.value })} />
            <p className="mt-1 text-[11px] text-muted-foreground">{project.client_manager_name ? "Em branco, vale o Gerente de Projetos no cliente do cadastro." : "Quem vai receber a equipe na reunião."}</p>
          </div>
          <div>
            <Label className="text-xs" htmlFor="pe-data">Data e hora da reunião de PE *</Label>
            <Input id="pe-data" type="datetime-local" className="mt-1.5 h-9" value={c.reuniaoPe} onChange={ev => set("contato", { reuniaoPe: ev.target.value })} />
          </div>
        </div>
        <div>
          <Label className="text-xs" htmlFor="pe-local">Local da reunião (opcional)</Label>
          <Input id="pe-local" className="mt-1.5 h-9" placeholder="Ex.: sede do cliente, garagem central" value={c.local} onChange={ev => set("contato", { local: ev.target.value })} />
        </div>
        <Rodape falta={c.reuniaoPe ? [] : ["data e hora da reunião de PE"]} dica="Depois de se apresentar e combinar a data com o cliente, salve o agendamento.">
          <Button className="h-9" disabled={!c.reuniaoPe} onClick={salvar}><CalendarCheck className="mr-1.5 h-4 w-4" />Salvar agendamento</Button>
        </Rodape>
      </div>
    );
  };

  const custos = () => {
    const c = estado.custos;
    const k = contaCustos(c);
    if (c.registradoEm) {
      const aprovado = !!estado.aprovacao.registradoEm;
      return (
        <div className="space-y-2">
          <Registro texto={`Custos salvos em ${quando(c.registradoEm)} por ${c.por || userName} · `} rotulo="Alterar"
            onDesfazer={aprovado ? undefined : () => set("custos", { registradoEm: null })}>
            <b>{periodoViagem(c)}</b>{c.onfly && " · simulado na Onfly"}
          </Registro>
          <TabelaCustos c={c} />
          {aprovado && <p className="text-[12px] text-muted-foreground">Aprovados pelo cliente. Para mudar os valores, desfaça a aprovação primeiro.</p>}
        </div>
      );
    }
    const falta = faltandoCustos(c);
    const datas = !!c.ida && !!c.volta && c.volta >= c.ida;
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[170px_170px_minmax(0,1fr)]">
          <div><Label className="text-xs" htmlFor="pe-ida">Ida *</Label><Input id="pe-ida" type="date" className="mt-1.5 h-9" value={c.ida} onChange={ev => set("custos", { ida: ev.target.value })} /></div>
          <div><Label className="text-xs" htmlFor="pe-volta">Volta *</Label><Input id="pe-volta" type="date" className="mt-1.5 h-9" min={c.ida || undefined} value={c.volta} onChange={ev => set("custos", { volta: ev.target.value })} /></div>
          <div><Label className="text-xs" htmlFor="pe-viajantes">Quem viaja</Label><Input id="pe-viajantes" className="mt-1.5 h-9" placeholder={gp} value={c.viajantes} onChange={ev => set("custos", { viajantes: ev.target.value })} /></div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Deslocamento */}
          <fieldset className="space-y-3 rounded-lg border border-border/60 p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deslocamento</legend>
            <div>
              <p className="text-xs font-medium">Meio *</p>
              <div className="mt-1.5"><Seg<MeioDeslocamento> label="Meio de deslocamento" value={c.meio} onChange={v => set("custos", { meio: v })}
                options={(Object.keys(MEIO_LABEL) as MeioDeslocamento[]).map(v => ({ v, l: MEIO_LABEL[v] }))} /></div>
            </div>
            <CampoValor id="pe-desl" label="Valor total, ida e volta *" value={c.deslocamento} onChange={v => set("custos", { deslocamento: v })} />
          </fieldset>
          {/* Hospedagem */}
          <fieldset className="space-y-3 rounded-lg border border-border/60 p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hospedagem</legend>
            {!datas ? <p className="text-[13px] text-muted-foreground">Informe a ida e a volta: as diárias são as noites entre as duas datas.</p>
              : k.noites === 0 ? <p className="text-[13px] text-muted-foreground">Ida e volta no mesmo dia: sem hospedagem.</p>
              : (
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <CampoValor id="pe-diaria" label={`Valor da diária * · ${k.noites} ${k.noites === 1 ? "diária" : "diárias"}`} value={c.diaria} onChange={v => set("custos", { diaria: v })} />
                  <p className="pb-2 text-[13px]">= <b className="tabular-nums">{moeda(k.hospedagem)}</b></p>
                </div>
              )}
          </fieldset>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div><Label className="text-xs" htmlFor="pe-outros-desc">Outros custos (opcional)</Label><Input id="pe-outros-desc" className="mt-1.5 h-9" placeholder="Ex.: locação de carro, alimentação" value={c.outrosDescricao} onChange={ev => set("custos", { outrosDescricao: ev.target.value })} /></div>
          <CampoValor id="pe-outros" label="Valor" value={c.outros} onChange={v => set("custos", { outros: v })} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/50 px-3.5 py-2.5">
          <label htmlFor="pe-onfly" className="flex min-w-0 flex-1 basis-60 cursor-pointer items-center gap-2 text-[13px] font-medium">
            <Checkbox id="pe-onfly" checked={c.onfly} onCheckedChange={v => set("custos", { onfly: v === true })} />
            Valores simulados na Onfly <span className="font-normal text-muted-foreground">(quando possível)</span>
          </label>
          <p className="text-[13px]">Total estimado <b className="ml-1 text-lg tabular-nums text-primary">{moeda(k.total)}</b></p>
        </div>

        <Rodape falta={falta} dica="Tudo preenchido. Salve os custos para enviar ao cliente.">
          <Button className="h-9" disabled={falta.length > 0} onClick={() => set("custos", { registradoEm: agora(), por: userName })}><Check className="mr-1.5 h-4 w-4" />Salvar custos</Button>
        </Rodape>
      </div>
    );
  };

  const aprovacao = () => {
    const a = estado.aprovacao;
    if (a.registradoEm) {
      return (
        <Registro texto={`Custos aprovados por ${a.aprovadoPor || "—"} em ${dataBr(a.aprovadoEm)} · total `} onDesfazer={() => set("aprovacao", { registradoEm: null })}>
          <b>{total}</b>{a.enviadoEm && <> · {verEmail(() => setEmailCustos(true))}</>}
        </Registro>
      );
    }
    const data = a.aprovadoEm || hoje();
    const registrar = () => set("aprovacao", { aprovadoPor: a.aprovadoPor.trim() || estado.contato.com.trim() || project.client_manager_name || "", aprovadoEm: data, registradoEm: agora() });
    const quem = a.aprovadoPor.trim() || estado.contato.com.trim() || project.client_manager_name || "";
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button className="h-9" onClick={() => { if (!a.para && emailCliente) set("aprovacao", { para: emailCliente }); setEmailCustos(true); }}>
            <Mail className="mr-1.5 h-4 w-4" />Montar e-mail ao cliente
          </Button>
          {a.enviadoEm
            ? <span className="text-[12px] text-amber-800 dark:text-amber-200">E-mail enviado em {quando(a.enviadoEm)} · aguardando a aprovação do cliente</span>
            : <span className="text-[12px] text-muted-foreground">Total de <b className="font-semibold text-foreground">{total}</b> · copie e cole no Outlook</span>}
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-semibold">Aprovação do cliente</p>
          <p className="text-[12px] text-muted-foreground">Registre quando o cliente aprovar os custos (por e-mail, telefone ou WhatsApp).</p>
          <div className="mt-2.5 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <Label className="text-xs" htmlFor="pe-aprov-quem">Aprovado por</Label>
              <Input id="pe-aprov-quem" className="mt-1.5 h-9" placeholder={estado.contato.com || project.client_manager_name || "Nome de quem aprovou"} value={a.aprovadoPor} onChange={ev => set("aprovacao", { aprovadoPor: ev.target.value })} />
            </div>
            <div className="w-full sm:w-44">
              <Label className="text-xs" htmlFor="pe-aprov-data">Data da aprovação</Label>
              <Input id="pe-aprov-data" type="date" className="mt-1.5 h-9" value={data} onChange={ev => set("aprovacao", { aprovadoEm: ev.target.value })} />
            </div>
            <Button className="h-9" disabled={!quem} onClick={registrar}><Check className="mr-1.5 h-4 w-4" />Registrar aprovação</Button>
          </div>
        </div>
      </div>
    );
  };

  const reservas = () => {
    const r = estado.reservas;
    if (r.registradoEm) {
      const det = [r.deslocamento.trim() && `deslocamento: ${r.deslocamento.trim()}`, r.hospedagem.trim() && `hospedagem: ${r.hospedagem.trim()}`].filter(Boolean).join(" · ");
      return <Registro texto={`Reservas feitas em ${quando(r.registradoEm)} por ${r.por || userName}${det ? ` · ${det}` : ""}`} onDesfazer={() => set("reservas", { registradoEm: null })} />;
    }
    const k = contaCustos(estado.custos);
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <Label className="text-xs" htmlFor="pe-res-desl">Deslocamento: localizador ou empresa (opcional)</Label>
          <Input id="pe-res-desl" className="mt-1.5 h-9" placeholder={estado.custos.meio === "aereo" ? "Ex.: LATAM · localizador XKQ7PL" : "Ex.: Viação Catarinense"} value={r.deslocamento} onChange={ev => set("reservas", { deslocamento: ev.target.value })} />
        </div>
        {k.noites > 0 && (
          <div className="min-w-0 flex-1 basis-56">
            <Label className="text-xs" htmlFor="pe-res-hosp">Hospedagem: hotel (opcional)</Label>
            <Input id="pe-res-hosp" className="mt-1.5 h-9" placeholder="Ex.: Hotel Central · reserva 88213" value={r.hospedagem} onChange={ev => set("reservas", { hospedagem: ev.target.value })} />
          </div>
        )}
        <Button className="h-9" onClick={() => set("reservas", { registradoEm: agora(), por: userName })}><Check className="mr-1.5 h-4 w-4" />Marcar como feito</Button>
      </div>
    );
  };

  const financeiro = () => {
    const f = estado.financeiro;
    // copiar o e-mail (ou avisar que enviou por fora) conclui; copiar de novo mantém a 1ª data
    const concluir = () => onChange(e => ({ ...e, financeiro: { ...e.financeiro, enviadoEm: e.financeiro.enviadoEm ?? agora(), por: e.financeiro.por || userName } }));
    return f.enviadoEm ? (
      <Registro texto={`Comprovantes enviados ao Financeiro em ${quando(f.enviadoEm)} por ${f.por || userName} · `} onDesfazer={() => set("financeiro", { enviadoEm: null })}>
        {verEmail(() => setEmailFinanceiro(true))}
      </Registro>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-9" onClick={() => setEmailFinanceiro(true)}><ReceiptText className="mr-1.5 h-4 w-4" />Montar e-mail ao Financeiro</Button>
        <Button className="h-9" onClick={concluir}><Check className="mr-1.5 h-4 w-4" />Marcar como feito</Button>
        <span className="text-[12px] text-muted-foreground">se os comprovantes foram enviados por fora do portal</span>
      </div>
    );
  };

  const adiantamento = (sit: SituacaoAtividade) => {
    const a = estado.adiantamento;
    const desfazer = () => set("adiantamento", { necessario: null, registradoEm: null });
    if (sit === "feito" && a.registradoEm) {
      return (
        <Registro texto={`Adiantamento${valorBr(a.valor) ? ` de ${moeda(valorBr(a.valor)!)}` : ""} solicitado na Onfly em ${quando(a.registradoEm)} por ${a.por || userName}`} onDesfazer={desfazer} />
      );
    }
    if (sit === "naoaplica" && a.registradoEm) {
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span className="min-w-0 flex-1">Sem adiantamento: marcado como não necessário em {quando(a.registradoEm)} por {a.por || userName}.</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={desfazer}>Desfazer</Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-end gap-2">
        <CampoValor id="pe-adiant" label="Valor solicitado (opcional)" className="w-full sm:w-48" value={a.valor} onChange={v => set("adiantamento", { valor: v })} />
        <Button className="h-9" onClick={() => set("adiantamento", { necessario: true, registradoEm: agora(), por: userName })}><Wallet className="mr-1.5 h-4 w-4" />Solicitei na Onfly</Button>
        <Button variant="outline" className="h-9" onClick={() => set("adiantamento", { necessario: false, registradoEm: agora(), por: userName })}>Não é necessário</Button>
      </div>
    );
  };

  /** Lembrete com um botão de conferido (leitoras). */
  const conferido = (k: "leitoras", icone: ReactNode, lembrete: ReactNode, botao: string, feito: string) => {
    const r = estado[k];
    if (r.registradoEm) return <Registro texto={`${feito} · conferido em ${quando(r.registradoEm)} por ${r.por || userName}`} onDesfazer={() => set(k, { registradoEm: null })} />;
    return (
      <div className="space-y-3">
        <Lembrete icone={icone}>{lembrete}</Lembrete>
        <Button className="h-9" onClick={() => set(k, { registradoEm: agora(), por: userName })}><Check className="mr-1.5 h-4 w-4" />{botao}</Button>
      </div>
    );
  };

  const cartoes = () => {
    const c = estado.cartoes;
    // "01 Chave · 05 Senha · 40 Acesso · 01 MK TRANSPORT"
    const resumo = cartoesDoTermo(project, c).filter(x => x.quantidade > 0).map(x => `${qtdTermo(x.quantidade)} ${x.tipo.trim() || "outro"}`).join(" · ");
    if (c.registradoEm) {
      return (
        <Registro texto={`Cartões separados em ${quando(c.registradoEm)} por ${c.por || userName} · `} onDesfazer={() => set("cartoes", { registradoEm: null })}>
          <b>{resumo}</b>
        </Registro>
      );
    }
    return (
      <div className="space-y-3">
        <Lembrete icone={<KeyRound className="h-4 w-4" />}>
          <b>Não esqueça os cartões-chave e as respectivas senhas</b> para a reunião de PE. As senhas não são registradas no portal. Os cartões abaixo vão no Termo de Recebimento.
        </Lembrete>
        <CartoesTermo project={project} cartoes={c} onChange={patch => set("cartoes", patch)} />
        <Button className="h-9" onClick={() => set("cartoes", { registradoEm: agora(), por: userName })}><Check className="mr-1.5 h-4 w-4" />Cartões e senhas separados</Button>
      </div>
    );
  };

  const termo = () => {
    const t = estado.termo;
    const verTermo = <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setTermoAberto(true)}>Ver termo</button>;
    if (t.registradoEm) {
      return <Registro texto={`Termo de Recebimento dos Cartões gerado em ${quando(t.registradoEm)} por ${t.por || userName} · `} onDesfazer={() => set("termo", { registradoEm: null })}>{verTermo}</Registro>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-9" onClick={() => setTermoAberto(true)}><FileText className="mr-1.5 h-4 w-4" />Gerar Termo em PDF</Button>
        <Button className="h-9" onClick={() => set("termo", { registradoEm: agora(), por: userName })}><Check className="mr-1.5 h-4 w-4" />Marcar como feito</Button>
        <span className="text-[12px] text-muted-foreground">se o termo foi gerado por fora do portal</span>
      </div>
    );
  };

  const software = () => {
    const s = estado.software;
    const itens = [
      { k: "saminit" as const, nome: "SAMINIT" },
      { k: "sasm" as const, nome: "SASM CHAVE" },
    ];
    const ok = itens.filter(i => s[i.k]).length;
    return (
      <div className="space-y-2">
        <ul className="divide-y overflow-hidden rounded-lg border border-border/60">
          {itens.map(i => {
            const em = s[i.k];
            return (
              <li key={i.k} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pl-3 pr-2.5 transition-colors ${em ? "bg-emerald-500/[0.08] shadow-[inset_3px_0_0_0_rgb(16_185_129)]" : ""}`}>
                {em ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden /> : <Circle className="h-[18px] w-[18px] shrink-0 text-muted-foreground/50" aria-hidden />}
                <span className={`min-w-0 flex-1 text-sm font-medium ${em ? "text-emerald-900 dark:text-emerald-100" : ""}`}>
                  <b>{i.nome}</b> instalado e funcionando no notebook
                  {em && <span className="block text-[11.5px] font-normal text-muted-foreground">Conferido em {quando(em)}</span>}
                </span>
                <Button type="button" size="sm" aria-pressed={!!em} aria-label={`${i.nome}: ${em ? "desfazer ok" : "marcar como ok"}`}
                  title={em ? "Clique para desfazer" : "Marcar como ok"}
                  onClick={() => set("software", { [i.k]: em ? null : agora(), por: userName })}
                  className={`h-7 w-[60px] px-0 text-xs ${em ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-border bg-background text-foreground hover:border-emerald-500 hover:bg-emerald-500/10"}`}>
                  <Check className="mr-1 h-3.5 w-3.5" />OK
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {ok === itens.length ? "Notebook pronto para a gravação dos cartões." : "Abra cada software no notebook, com a leitora conectada, antes de viajar."}
        </p>
      </div>
    );
  };

  const corpo = (id: AtividadeId02, sit: SituacaoAtividade): ReactNode => {
    if (sit === "bloqueado") {
      return <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" />{bloqueio02(id, estado)?.texto}</p>;
    }
    switch (id) {
      case "contato": return contato();
      case "custos": return custos();
      case "aprovacao": return aprovacao();
      case "reservas": return reservas();
      case "financeiro": return financeiro();
      case "adiantamento": return adiantamento(sit);
      case "cartoes": return cartoes();
      case "termo": return termo();
      case "leitoras":
        return conferido("leitoras", <ScanLine className="h-4 w-4" />,
          <><b>Leve as duas leitoras inteligentes</b> para a gravação dos cartões.</>,
          "As duas leitoras estão separadas", "Duas leitoras inteligentes separadas para a viagem");
      case "software": return software();
    }
  };

  const pillDe = (id: AtividadeId02, sit: SituacaoAtividade) =>
    sit === "bloqueado" ? bloqueio02(id, estado)?.pill : sit === "aguardando" ? "Aguardando o cliente" : undefined;

  const para = (k: "aprovacao" | "financeiro") => (v: string) => set(k, { para: v });
  const custosParaEmail = { ...estado.custos, viajantes: estado.custos.viajantes || gp };

  return (
    <>
      <ol className="space-y-3.5">
        {MODULO_02.atividades.map((a, i) => {
          const sit = situacao02(a.id, estado);
          return <Etapa key={a.id} n={i + 1} a={a} sit={sit} pill={pillDe(a.id, sit)} last={i === MODULO_02.atividades.length - 1}>{corpo(a.id, sit)}</Etapa>;
        })}
      </ol>
      <VisitaPeEmailDialog open={emailCustos} onOpenChange={setEmailCustos}
        icone={<Plane className="h-5 w-5 text-primary" />} titulo="E-mail ao cliente: custos da visita de PE"
        descricao="Envie ao cliente os custos estimados de deslocamento e hospedagem e peça a aprovação. Confira a prévia e abra no Outlook já com destinatário e assunto."
        paraLabel="E-mail do cliente" paraPlaceholder="contato@cliente.com.br" para={estado.aprovacao.para} onPara={para("aprovacao")}
        linhas={[...linhasVisita(project, { ...estado, custos: custosParaEmail }), { label: "Total estimado", valor: total }]}
        assunto={assuntoCustos(project)} html={emailHtmlCustos(project, { ...estado, custos: custosParaEmail }, userName)}
        texto={emailTextoCustos(project, { ...estado, custos: custosParaEmail }, userName)}
        onCopiado={() => onChange(e => ({ ...e, aprovacao: { ...e.aprovacao, enviadoEm: e.aprovacao.enviadoEm ?? agora() } }))} />
      <VisitaPeEmailDialog open={emailFinanceiro} onOpenChange={setEmailFinanceiro}
        icone={<Send className="h-5 w-5 text-primary" />} titulo="E-mail ao Financeiro: comprovantes da viagem"
        descricao="Encaminhe ao Financeiro da Transdata os comprovantes das reservas, com os custos aprovados pelo cliente."
        paraLabel="E-mail do Financeiro" paraPlaceholder="financeiro@itstransdata.com" para={estado.financeiro.para} onPara={para("financeiro")}
        linhas={[{ label: "Período da viagem", valor: estado.custos.ida ? periodoViagem(estado.custos) : "—" }, { label: "Total aprovado", valor: total },
          { label: "Reserva do deslocamento", valor: estado.reservas.deslocamento.trim() || "—" }, { label: "Reserva da hospedagem", valor: estado.reservas.hospedagem.trim() || "—" }]}
        assunto={assuntoFinanceiro(project)} html={emailHtmlFinanceiro(project, { ...estado, custos: custosParaEmail }, userName)}
        texto={emailTextoFinanceiro(project, { ...estado, custos: custosParaEmail }, userName)}
        anexos="Anexe os comprovantes das reservas (passagens e hotel) no Outlook antes de enviar."
        onCopiado={() => onChange(e => ({ ...e, financeiro: { ...e.financeiro, enviadoEm: e.financeiro.enviadoEm ?? agora(), por: e.financeiro.por || userName } }))} />
      {/* baixar o PDF registra o termo; baixar de novo mantém a 1ª data */}
      <TermoCartoesDialog open={termoAberto} onOpenChange={setTermoAberto} project={project} estado={estado}
        onCartoes={patch => set("cartoes", patch)} onTermo={patch => set("termo", patch)}
        onBaixado={() => onChange(e => ({ ...e, termo: { ...e.termo, registradoEm: e.termo.registradoEm ?? agora(), por: e.termo.por || userName } }))} />
    </>
  );
}
