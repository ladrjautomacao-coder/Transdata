import type { ReactNode } from "react";
import { Building2, CalendarDays, Check, CheckCircle2, Circle, ClipboardCheck, KeyRound, Lock, MapPin, Plus, Presentation, Store, Trash2, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { agora, dataBr, quando, solutionsOf, type GerProject, type SituacaoAtividade } from "@/lib/gerenciamento";
import {
  CAMPOS_ENCERRAMENTO, CARTOES_OPERACIONAIS, MODULO_03, TIPOS_VISITA, bloqueio03, nomeTipoVisita, situacao03, visitaCompleta, visitasOrdenadas,
  type AtividadeId03, type Modulo03Estado, type TipoVisita, type VisitaTecnica,
} from "@/lib/modulo03";
import { Etapa, Lembrete, Registro, Rodape } from "./Etapa";

const p2 = (n: number) => String(n).padStart(2, "0");
/** Hoje em AAAA-MM-DD (data local). */
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

const ICONE_VISITA: Record<TipoVisita, typeof Warehouse> = { garagem: Warehouse, venda: Store, coleta: Building2 };

/** Item que o GP marca como ok (cartões, visitas): verde quando feito, com a data; clicar de novo desfaz. */
function ItemOk({ titulo, detalhe, em, rotulo, feito = "Feito", onToggle }: {
  titulo: ReactNode; detalhe?: ReactNode; em: string | null; rotulo: string; feito?: string; onToggle: () => void;
}) {
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pl-3 pr-2.5 transition-colors ${em ? "bg-emerald-500/[0.08] shadow-[inset_3px_0_0_0_rgb(16_185_129)]" : ""}`}>
      {em ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden /> : <Circle className="h-[18px] w-[18px] shrink-0 text-muted-foreground/50" aria-hidden />}
      <span className={`min-w-0 flex-1 text-sm font-medium ${em ? "text-emerald-900 dark:text-emerald-100" : ""}`}>
        {titulo}
        {(detalhe || em) && (
          <span className="block text-[11.5px] font-normal text-muted-foreground">
            {detalhe}{detalhe && em && " · "}{em && `${feito} em ${quando(em)}`}
          </span>
        )}
      </span>
      <Button type="button" size="sm" aria-pressed={!!em} aria-label={`${rotulo}: ${em ? "desfazer ok" : "marcar como ok"}`}
        title={em ? "Clique para desfazer" : "Marcar como ok"} onClick={onToggle}
        className={`h-7 w-[60px] px-0 text-xs ${em ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-border bg-background text-foreground hover:border-emerald-500 hover:bg-emerald-500/10"}`}>
        <Check className="mr-1 h-3.5 w-3.5" />OK
      </Button>
    </li>
  );
}

/** Textos registrados (regras de negócio, encerramento), um embaixo do outro. */
function Textos({ itens }: { itens: { label: string; texto: string }[] }) {
  return (
    <dl className="space-y-2.5 rounded-lg border border-border/60 p-3 text-[13px]">
      {itens.map(i => (
        <div key={i.label}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{i.label}</dt>
          <dd className="mt-0.5 whitespace-pre-line">{i.texto.trim() || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Módulo 03 · Atividades presenciais (in loco): o que o GP faz na visita ao cliente, da apresentação
 * da solução ao encerramento da visita técnica. O estado vem de quem chama, que o grava no banco.
 */
export function Modulo03({ project, estado, onChange, userName, cartoesLevados }: {
  project: GerProject;
  estado: Modulo03Estado;
  onChange: (update: (e: Modulo03Estado) => Modulo03Estado) => void;
  userName: string;
  /** Os cartões separados no módulo 02 ("01 Chave · 05 Senha · …"), se já foram separados. */
  cartoesLevados?: string;
}) {
  const set = <K extends keyof Modulo03Estado>(k: K, patch: Partial<Modulo03Estado[K]>) =>
    onChange(e => ({ ...e, [k]: { ...e[k], ...patch } }));
  const setVisitas = (f: (v: VisitaTecnica[]) => VisitaTecnica[]) =>
    onChange(e => ({ ...e, cronograma: { ...e.cronograma, visitas: f(e.cronograma.visitas) } }));

  const apresentacao = () => {
    const a = estado.apresentacao;
    if (a.registradoEm) {
      return (
        <Registro texto={`Apresentação feita em ${dataBr(a.data)} por ${a.por || userName}`} rotulo="Alterar" onDesfazer={() => set("apresentacao", { registradoEm: null })}>
          {a.participantes.trim() && <> · com {a.participantes.trim()}</>}
        </Registro>
      );
    }
    const solucoes = solutionsOf(project);
    const data = a.data || hoje();
    return (
      <div className="space-y-3">
        {solucoes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            <Presentation className="h-4 w-4 shrink-0" aria-hidden />Solução contratada:
            {solucoes.map(s => <span key={s} className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">{s}</span>)}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <Label className="text-xs" htmlFor="m3-apr-data">Data da apresentação</Label>
            <Input id="m3-apr-data" type="date" className="mt-1.5 h-9" value={data} onChange={ev => set("apresentacao", { data: ev.target.value })} />
          </div>
          <div>
            <Label className="text-xs" htmlFor="m3-apr-part">Participantes do cliente (opcional)</Label>
            <Input id="m3-apr-part" className="mt-1.5 h-9" placeholder="Ex.: Carla (gerente de operações), equipe da garagem" value={a.participantes} onChange={ev => set("apresentacao", { participantes: ev.target.value })} />
          </div>
        </div>
        <Rodape falta={[]} dica="Apresente os principais módulos, as funcionalidades e os fluxos operacionais da solução contratada.">
          <Button className="h-9" onClick={() => set("apresentacao", { data, participantes: a.participantes.trim(), registradoEm: agora(), por: userName })}>
            <Check className="mr-1.5 h-4 w-4" />Registrar apresentação
          </Button>
        </Rodape>
      </div>
    );
  };

  const cartoes = () => {
    const c = estado.cartoes;
    const ok = CARTOES_OPERACIONAIS.filter(x => c[x.id]).length;
    return (
      <div className="space-y-2">
        {cartoesLevados && <p className="text-[12px] text-muted-foreground">Cartões separados no módulo 02: <b className="font-semibold text-foreground">{cartoesLevados}</b></p>}
        <ul className="divide-y overflow-hidden rounded-lg border border-border/60">
          {CARTOES_OPERACIONAIS.map(x => (
            <ItemOk key={x.id} titulo={<><b>{x.nome}</b>: {x.texto}</>} em={c[x.id]} rotulo={x.nome}
              onToggle={() => set("cartoes", { [x.id]: c[x.id] ? null : agora(), por: userName })} />
          ))}
        </ul>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {ok === CARTOES_OPERACIONAIS.length ? "Cartões operacionais gravados e configurados." : "As senhas não são registradas no portal."}
        </p>
      </div>
    );
  };

  const cronograma = () => {
    const c = estado.cronograma;
    const lista = visitasOrdenadas(estado);
    if (c.registradoEm) {
      const n = lista.length;
      const datas = lista.map(v => v.data).filter(Boolean);
      const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? ` em ${dataBr(datas[0])}` : ` de ${dataBr(datas[0])} a ${dataBr(datas[datas.length - 1])}`) : "";
      const porTipo = TIPOS_VISITA.map(t => ({ t, q: lista.filter(v => v.tipo === t.id).length })).filter(x => x.q)
        .map(x => `${x.q} ${x.t.nome.toLowerCase()}`).join(", ");
      return (
        <Registro texto={`Cronograma definido em ${quando(c.registradoEm)} por ${c.por || userName} · `} rotulo="Alterar" onDesfazer={() => set("cronograma", { registradoEm: null })}>
          <b>{n} {n === 1 ? "visita" : "visitas"}</b>{periodo} ({porTipo})
        </Registro>
      );
    }
    const novo = (tipo: TipoVisita) => setVisitas(v => [...v, { id: `v${Date.now()}`, tipo, local: "", data: "", feitaEm: null }]);
    const editar = (id: string, patch: Partial<VisitaTecnica>) => setVisitas(v => v.map(x => (x.id === id ? { ...x, ...patch } : x)));
    const remover = (id: string) => setVisitas(v => v.filter(x => x.id !== id));
    const falta = !c.visitas.length ? ["pelo menos uma visita"] : c.visitas.some(v => !visitaCompleta(v)) ? ["local e data de cada visita"] : [];
    return (
      <div className="space-y-3">
        {c.visitas.length > 0 && (
          <ul className="space-y-2">
            {c.visitas.map((v, i) => {
              const Icone = ICONE_VISITA[v.tipo];
              return (
                <li key={v.id} className="grid items-end gap-2 rounded-lg border border-border/60 p-2.5 sm:grid-cols-[150px_minmax(0,1fr)_160px_auto]">
                  <span className="inline-flex h-9 items-center gap-1.5 text-[13px] font-medium"><Icone className="h-4 w-4 shrink-0 text-primary" aria-hidden />{nomeTipoVisita(v.tipo)}</span>
                  <div>
                    <Label className="text-xs" htmlFor={`m3-vis-local-${v.id}`}>Local</Label>
                    <Input id={`m3-vis-local-${v.id}`} className="mt-1.5 h-9" placeholder="Nome ou endereço" value={v.local} onChange={ev => editar(v.id, { local: ev.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`m3-vis-data-${v.id}`}>Data prevista</Label>
                    <Input id={`m3-vis-data-${v.id}`} type="date" className="mt-1.5 h-9" value={v.data} onChange={ev => editar(v.id, { data: ev.target.value })} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 justify-self-end text-muted-foreground hover:text-destructive" onClick={() => remover(v.id)}
                    aria-label={`Tirar a visita ${i + 1} do cronograma`} title="Tirar do cronograma"><Trash2 className="h-4 w-4" /></Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Incluir visita:</span>
          {TIPOS_VISITA.map(t => {
            const Icone = ICONE_VISITA[t.id];
            return <Button key={t.id} variant="outline" size="sm" className="h-8 text-xs" onClick={() => novo(t.id)}><Plus className="mr-1 h-3.5 w-3.5" /><Icone className="mr-1 h-3.5 w-3.5" />{t.nome}</Button>;
          })}
        </div>
        <Rodape falta={falta} dica="Com as visitas combinadas com o cliente, defina o cronograma.">
          <Button className="h-9" disabled={falta.length > 0} onClick={() => set("cronograma", { registradoEm: agora(), por: userName })}>
            <CalendarDays className="mr-1.5 h-4 w-4" />Definir cronograma
          </Button>
        </Rodape>
      </div>
    );
  };

  const visitas = () => {
    const lista = visitasOrdenadas(estado);
    const feitas = lista.filter(v => v.feitaEm).length;
    return (
      <div className="space-y-2">
        <ul className="divide-y overflow-hidden rounded-lg border border-border/60">
          {lista.map(v => (
            <ItemOk key={v.id} titulo={<><b>{nomeTipoVisita(v.tipo)}</b>: {v.local.trim() || "—"}</>} detalhe={`Prevista para ${dataBr(v.data)}`}
              em={v.feitaEm} rotulo={`${nomeTipoVisita(v.tipo)} ${v.local.trim()}`} feito="Feita"
              onToggle={() => setVisitas(vs => vs.map(x => (x.id === v.id ? { ...x, feitaEm: x.feitaEm ? null : agora() } : x)))} />
          ))}
        </ul>
        <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {feitas === lista.length
            ? "Todas as visitas do cronograma foram feitas."
            : `${feitas} de ${lista.length} visitas feitas. Se uma visita não for acontecer, tire do cronograma em Alterar.`}
        </p>
      </div>
    );
  };

  const regras = () => {
    const r = estado.regras;
    const itens = [
      { k: "regras" as const, label: "Regras de negócio da operação *", curto: "Regras de negócio da operação", placeholder: "Ex.: tarifas e integrações, gratuidades e meia-passagem, linhas seccionadas, venda a bordo", alto: true },
      { k: "particularidades" as const, label: "Particularidades e processos (opcional)", curto: "Particularidades e processos", placeholder: "Como a operação funciona hoje: recolhimento, prestação de contas, escalas" },
      { k: "necessidades" as const, label: "Necessidades específicas do cliente (opcional)", curto: "Necessidades específicas do cliente", placeholder: "O que o cliente precisa e não é padrão" },
    ];
    if (r.registradoEm) {
      return (
        <div className="space-y-2">
          <Registro texto={`Regras de negócio registradas em ${quando(r.registradoEm)} por ${r.por || userName}`} rotulo="Alterar" onDesfazer={() => set("regras", { registradoEm: null })} />
          <Textos itens={itens.filter(i => i.k === "regras" || r[i.k].trim()).map(i => ({ label: i.curto, texto: r[i.k] }))} />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {itens.map(i => (
          <div key={i.k}>
            <Label className="text-xs" htmlFor={`m3-regras-${i.k}`}>{i.label}</Label>
            <Textarea id={`m3-regras-${i.k}`} className={`mt-1.5 ${i.alto ? "min-h-[110px]" : "min-h-[72px]"}`} placeholder={i.placeholder}
              value={r[i.k]} onChange={ev => set("regras", { [i.k]: ev.target.value })} />
          </div>
        ))}
        <Rodape falta={r.regras.trim() ? [] : ["regras de negócio da operação"]} dica="Registre o que foi levantado com o cliente. Dá para alterar depois.">
          <Button className="h-9" disabled={!r.regras.trim()} onClick={() => set("regras", { registradoEm: agora(), por: userName })}>
            <ClipboardCheck className="mr-1.5 h-4 w-4" />Registrar regras de negócio
          </Button>
        </Rodape>
      </div>
    );
  };

  const encerramento = () => {
    const e = estado.encerramento;
    if (e.registradoEm) {
      return (
        <div className="space-y-2">
          <Registro texto={`Visita técnica encerrada em ${dataBr(e.data)} · registrado por ${e.por || userName}`} rotulo="Alterar" onDesfazer={() => set("encerramento", { registradoEm: null })} />
          <Textos itens={CAMPOS_ENCERRAMENTO.map(c => ({ label: c.label, texto: e[c.k] }))} />
        </div>
      );
    }
    const data = e.data || hoje();
    const falta = CAMPOS_ENCERRAMENTO.filter(c => !e[c.k].trim()).map(c => c.label.toLowerCase());
    return (
      <div className="space-y-3">
        <Lembrete icone={<ClipboardCheck className="h-4 w-4" />}>
          <b>Todos os campos são obrigatórios.</b> Se não houver nada, escreva "Nenhuma".
        </Lembrete>
        <div className="w-full sm:w-44">
          <Label className="text-xs" htmlFor="m3-enc-data">Data do encerramento</Label>
          <Input id="m3-enc-data" type="date" className="mt-1.5 h-9" value={data} onChange={ev => set("encerramento", { data: ev.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS_ENCERRAMENTO.map(c => (
            <div key={c.k}>
              <Label className="text-xs" htmlFor={`m3-enc-${c.k}`}>{c.label} *</Label>
              <Textarea id={`m3-enc-${c.k}`} className="mt-1.5 min-h-[96px]" placeholder={c.placeholder} value={e[c.k]} onChange={ev => set("encerramento", { [c.k]: ev.target.value })} />
            </div>
          ))}
        </div>
        <Rodape falta={falta} dica="Com tudo registrado, encerre a visita técnica.">
          <Button className="h-9 bg-emerald-600 text-white hover:bg-emerald-500" disabled={falta.length > 0}
            onClick={() => set("encerramento", { data, registradoEm: agora(), por: userName })}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />Encerrar a visita técnica
          </Button>
        </Rodape>
      </div>
    );
  };

  const corpo = (id: AtividadeId03, sit: SituacaoAtividade): ReactNode => {
    if (sit === "bloqueado") {
      return <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" />{bloqueio03(id, estado)?.texto}</p>;
    }
    switch (id) {
      case "apresentacao": return apresentacao();
      case "cartoes": return cartoes();
      case "cronograma": return cronograma();
      case "visitas": return visitas();
      case "regras": return regras();
      case "encerramento": return encerramento();
    }
  };

  /** Selo: o que bloqueia, ou o andamento das visitas e dos cartões. */
  const pillDe = (id: AtividadeId03, sit: SituacaoAtividade) => {
    if (sit === "bloqueado") return bloqueio03(id, estado)?.pill;
    if (sit !== "afazer") return undefined;
    if (id === "visitas") {
      const t = estado.cronograma.visitas.length, f = estado.cronograma.visitas.filter(v => v.feitaEm).length;
      return f ? `${f} de ${t} feitas` : undefined;
    }
    if (id === "cartoes") {
      const f = CARTOES_OPERACIONAIS.filter(x => estado.cartoes[x.id]).length;
      return f ? `${f} de ${CARTOES_OPERACIONAIS.length} ok` : undefined;
    }
    return undefined;
  };

  return (
    <ol className="space-y-3.5">
      {MODULO_03.atividades.map((a, i) => {
        const sit = situacao03(a.id, estado);
        return <Etapa key={a.id} n={i + 1} a={a} sit={sit} pill={pillDe(a.id, sit)} last={i === MODULO_03.atividades.length - 1}>{corpo(a.id, sit)}</Etapa>;
      })}
    </ol>
  );
}
