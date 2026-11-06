import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CODIGO_VALIDO, atvsDe, etapaNum, mensagemGo, norm, salvarAtividade, sugerirCodigo, type GoAtividade, type GoDados, type GoProjeto,
} from "@/lib/grandesOperacoes/dados";
import { cn } from "@/lib/utils";
import { Dot } from "./GoShared";

const NOVA = "nova";

/** Lista de atividades do projeto para escolher várias: as escolhidas em chips, a busca inclui mais. */
function SeletorAtividades({ id, rotulo, dica, opcoes, valor, onChange, tom }: {
  id: string; rotulo: string; dica: string; opcoes: GoAtividade[]; valor: number[]; onChange: (v: number[]) => void;
  /** Cor dos chips: roxo para o que vem antes, laranja para o que vem depois (as cores do quadro). */
  tom: "antes" | "depois";
}) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const escolhidas = valor.map(v => opcoes.find(o => o.id === v)).filter((o): o is GoAtividade => !!o);
  const lista = opcoes.filter(o => !valor.includes(o.id) && (!q.trim() || norm(`${o.codigo} ${o.titulo}`).includes(norm(q.trim()))));
  const chip = tom === "antes" ? "border-primary/30 bg-primary/10 text-primary" : "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-200";
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{rotulo}</Label>
      <p className="text-[11px] text-muted-foreground">{dica}</p>
      {escolhidas.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {escolhidas.map(o => (
            <li key={o.id} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-1 text-[12px]", chip)}>
              <span className="font-mono text-[11px]">{o.codigo}</span>
              <span className="max-w-[200px] truncate" title={o.titulo}>{o.titulo}</span>
              <button type="button" onClick={() => onChange(valor.filter(v => v !== o.id))} aria-label={`Tirar ${o.codigo}`}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-background/60"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} className="pl-9" placeholder="Buscar código ou nome" value={q} autoComplete="off"
          onChange={e => { setQ(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} />
      </div>
      {aberto && (
        <div className="mt-1 overflow-hidden rounded-lg border border-border/60 bg-card">
          <ul className="max-h-44 overflow-y-auto py-1" aria-label={`Atividades para ${rotulo.toLowerCase()}`}>
            {lista.length ? lista.map(o => (
              <li key={o.id}>
                <button type="button" onClick={() => { onChange([...valor, o.id]); setQ(""); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                  <Dot status={o.status} /><span className="shrink-0 font-mono text-[11px] text-muted-foreground">{o.codigo}</span>
                  <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
                </button>
              </li>
            )) : <li className="px-3 py-2 text-[12.5px] text-muted-foreground">{opcoes.length ? "Nenhuma atividade com essa busca." : "O projeto ainda não tem outras atividades."}</li>}
          </ul>
          <button type="button" onClick={() => { setAberto(false); setQ(""); }} className="w-full border-t border-border/60 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground hover:bg-muted/50">Fechar a lista</button>
        </div>
      )}
    </div>
  );
}

/**
 * Atividade nova (`atividadeId` null) ou a edição de uma existente: etapa (ou uma etapa nova),
 * código, título, responsáveis entre os stakeholders do projeto, tempo, início previsto, objetivo, o
 * que vem antes (predecessoras) e o que depende dela (dependentes). O status continua no selo.
 */
export function AtividadeFormGO({ dados, projeto, atividadeId, aberto, onFechar, onSalvo }: {
  dados: GoDados;
  projeto: GoProjeto;
  atividadeId: number | null;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: (id: number) => Promise<void>;
}) {
  const a = atividadeId != null ? dados.act.get(atividadeId) : undefined;
  const doProjeto = useMemo(() => atvsDe(dados, [projeto.id]), [dados, projeto.id]);
  // etapas na ordem do quadro (pelo código das atividades), as vazias no fim
  const etapas = useMemo(() => {
    const num = new Map<number, string>();
    doProjeto.forEach(x => { if (!num.has(x.etapa_id)) num.set(x.etapa_id, etapaNum(x.codigo)); });
    const ordem = Array.from(num.keys());
    return dados.etapas.filter(e => e.projeto_id === projeto.id)
      .sort((x, y) => (num.has(x.id) ? ordem.indexOf(x.id) : 1e6 + x.ordem) - (num.has(y.id) ? ordem.indexOf(y.id) : 1e6 + y.ordem))
      .map(e => ({ ...e, num: num.get(e.id) ?? "" }));
  }, [dados.etapas, doProjeto, projeto.id]);

  const [etapa, setEtapa] = useState<string>(NOVA);
  const [etapaNova, setEtapaNova] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoTocado, setCodigoTocado] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [resp, setResp] = useState<number[]>([]);
  const [respTocado, setRespTocado] = useState(false);
  const [duracao, setDuracao] = useState("");
  const [inicio, setInicio] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [preds, setPreds] = useState<number[]>([]);
  const [deps, setDeps] = useState<number[]>([]);
  const [tentou, setTentou] = useState(false);
  const [gravando, setGravando] = useState(false);

  // ao abrir: os dados da atividade, ou uma nova na etapa da última atividade do projeto
  useEffect(() => {
    if (!aberto) return;
    const atual = atividadeId != null ? dados.act.get(atividadeId) : undefined;
    const etapaIni = atual?.etapa_id ?? doProjeto[doProjeto.length - 1]?.etapa_id ?? etapas[etapas.length - 1]?.id ?? null;
    setEtapa(etapaIni != null ? String(etapaIni) : NOVA);
    setEtapaNova("");
    setCodigo(atual?.codigo ?? sugerirCodigo(dados, projeto.id, etapaIni));
    setCodigoTocado(!!atual);
    setTitulo(atual?.titulo ?? "");
    setResp(atual?.stakeholders ?? []);
    setRespTocado(false);
    setDuracao(atual?.duracao ?? "");
    setInicio(atual?.data_prevista ?? "");
    setObjetivo(atual?.objetivo ?? "");
    setPreds(atual?.predecessoras ?? []);
    setDeps(atual ? dados.succ.get(atual.id) ?? [] : []);
    setTentou(false);
    // só ao abrir: os dados relidos por trás não apagam o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, atividadeId]);

  const trocarEtapa = (v: string) => {
    setEtapa(v);
    if (!codigoTocado) setCodigo(sugerirCodigo(dados, projeto.id, v === NOVA ? null : Number(v)));
  };

  const outras = doProjeto.filter(x => x.id !== atividadeId);
  const cod = codigo.trim();
  const erros = {
    etapa: etapa === NOVA && !etapaNova.trim() ? "Dê um nome para a etapa nova."
      : etapa === NOVA && etapas.some(e => norm(e.nome) === norm(etapaNova.trim())) ? "Já existe uma etapa com esse nome. Escolha ela na lista." : "",
    codigo: !cod ? "Informe o código." : !CODIGO_VALIDO.test(cod) ? "Use números separados por ponto (ex.: 1.2.3)."
      : outras.some(x => x.codigo === cod) ? `${cod} já é de outra atividade deste projeto.` : "",
    titulo: !titulo.trim() ? "Informe o título." : "",
    ligacoes: preds.filter(p => deps.includes(p)).length ? "Uma atividade não pode vir antes e depois desta ao mesmo tempo." : "",
  };
  const valido = !Object.values(erros).some(Boolean);
  const erro = (k: keyof typeof erros) => (tentou && erros[k] ? <p className="mt-1 text-[11px] text-destructive">{erros[k]}</p> : null);

  const salvar = async () => {
    setTentou(true);
    if (!valido) return;
    setGravando(true);
    try {
      const id = await salvarAtividade({
        id: a?.id, projeto_id: projeto.id,
        etapa_id: etapa === NOVA ? null : Number(etapa), etapa_nova: etapa === NOVA ? etapaNova.trim() : undefined,
        codigo: cod, titulo: titulo.trim(), objetivo: objetivo.trim(), duracao: duracao.trim(), data_prevista: inicio || null,
        predecessoras: preds, dependentes: deps,
        // atividade antiga sem stakeholders mantém o texto da planilha até alguém escolher
        responsaveis: !a || a.stakeholders.length || respTocado ? resp : undefined,
      });
      await onSalvo(id);
      toast.success(a ? `${cod} atualizada` : `${cod} criada`, { description: titulo.trim() });
      onFechar();
    } catch (err) {
      toast.error(a ? "Não foi possível salvar a atividade." : "Não foi possível criar a atividade.", { description: mensagemGo(err) });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o && !gravando) onFechar(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">{projeto.curto || projeto.nome}</p>
          <DialogTitle>{a ? `Editar ${a.codigo}` : "Nova atividade"}</DialogTitle>
          <DialogDescription>{a ? "O status continua sendo mudado no selo da atividade ou arrastando no quadro." : "Ela começa Em espera. Os campos com * são obrigatórios."}</DialogDescription>
        </DialogHeader>

        <form id="go-form-atividade" className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void salvar(); }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="min-w-0">
              <Label className="text-xs" id="go-form-etapa">Etapa *</Label>
              <Select value={etapa} onValueChange={trocarEtapa}>
                <SelectTrigger className="mt-1.5" aria-labelledby="go-form-etapa"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {etapas.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.num ? `${e.num} · ` : ""}{e.nome}</SelectItem>)}
                  <SelectItem value={NOVA}>+ Nova etapa</SelectItem>
                </SelectContent>
              </Select>
              {etapa === NOVA && (
                <Input className="mt-2" aria-label="Nome da etapa nova" placeholder="Nome da etapa nova (ex.: Integração)" value={etapaNova}
                  onChange={e => setEtapaNova(e.target.value)} maxLength={150} />
              )}
              {erro("etapa")}
            </div>
            <div>
              <Label htmlFor="go-form-codigo" className="text-xs">Código *</Label>
              <Input id="go-form-codigo" className="mt-1.5 font-mono" value={codigo} maxLength={30} inputMode="decimal"
                onChange={e => { setCodigo(e.target.value); setCodigoTocado(true); }} />
              {erro("codigo") ?? <p className="mt-1 text-[11px] text-muted-foreground">{codigoTocado ? "Ordena o quadro e o Gantt." : "Sugerido pela etapa."}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="go-form-titulo" className="text-xs">Título *</Label>
            <Input id="go-form-titulo" className="mt-1.5" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={255} placeholder="O que precisa ser feito" />
            {erro("titulo")}
          </div>

          <div>
            <Label className="text-xs" id="go-form-resp">Responsáveis</Label>
            {projeto.stakeholders.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-labelledby="go-form-resp">
                {projeto.stakeholders.map(s => {
                  const on = resp.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => { setRespTocado(true); setResp(r => (on ? r.filter(x => x !== s.id) : [...r, s.id])); }}
                      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40 hover:bg-primary/[0.04]")}>
                      {on && <Check className="h-3.5 w-3.5" />}{s.nome}{s.empresa && <span className={on ? "opacity-80" : "text-muted-foreground"}>· {s.empresa}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px] text-muted-foreground">O projeto ainda não tem stakeholders. Cadastre as pessoas em Detalhes do projeto para escolher os responsáveis.</p>
            )}
            {a && !a.stakeholders.length && a.responsavel && !respTocado && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Hoje está como “{a.responsavel}” (texto da planilha). Ao escolher stakeholders, ele é trocado pelos nomes.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="go-form-duracao" className="text-xs">Tempo estimado</Label>
              <Input id="go-form-duracao" className="mt-1.5" value={duracao} onChange={e => setDuracao(e.target.value)} maxLength={50} placeholder="Ex.: 3 dias" />
              <p className="mt-1 text-[11px] text-muted-foreground">A previsão do Gantt usa o primeiro número, em dias úteis.</p>
            </div>
            <div>
              <Label htmlFor="go-form-inicio" className="text-xs">Início previsto</Label>
              <Input id="go-form-inicio" className="mt-1.5" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="go-form-objetivo" className="text-xs">Objetivo</Label>
            <Textarea id="go-form-objetivo" className="mt-1.5" rows={2} value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Para que serve esta atividade" />
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/60 bg-muted/20 p-3 md:grid-cols-2">
            <SeletorAtividades id="go-form-preds" rotulo="Vem antes (predecessoras)" dica="Esta só começa depois delas." tom="antes"
              opcoes={outras} valor={preds} onChange={setPreds} />
            <SeletorAtividades id="go-form-deps" rotulo="Vem depois (dependentes)" dica="Elas só começam depois desta." tom="depois"
              opcoes={outras} valor={deps} onChange={setDeps} />
            {tentou && erros.ligacoes && <p className="text-[11px] text-destructive md:col-span-2">{erros.ligacoes}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={gravando}>Cancelar</Button>
          <Button type="submit" form="go-form-atividade" disabled={gravando}>
            {gravando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{a ? "Salvar atividade" : "Criar atividade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
