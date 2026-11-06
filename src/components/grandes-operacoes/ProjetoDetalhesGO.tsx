import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, Loader2, Pencil, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  atvsDe, mensagemGo, removerStakeholder, salvarNomeProjeto, salvarStakeholder, type GoDados, type GoProjeto, type GoStakeholder,
} from "@/lib/grandesOperacoes/dados";

const ID_EMPRESAS = "go-empresas-sugeridas";

/** Nome e empresa de um stakeholder, para incluir ou editar. */
function CamposStakeholder({ inicial, onSalvar, onCancelar, rotulo }: {
  inicial: { nome: string; empresa: string };
  onSalvar: (v: { nome: string; empresa: string }) => Promise<boolean>;
  onCancelar?: () => void;
  rotulo: string;
}) {
  const [v, setV] = useState(inicial);
  const [gravando, setGravando] = useState(false);
  const salvar = async () => {
    if (!v.nome.trim()) return;
    setGravando(true);
    const ok = await onSalvar(v);
    setGravando(false);
    if (ok && !onCancelar) setV({ nome: "", empresa: v.empresa });
  };
  return (
    <form className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]" onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <Input aria-label="Nome do stakeholder" placeholder="Nome" value={v.nome} onChange={e => setV({ ...v, nome: e.target.value })} maxLength={150} autoFocus={!!onCancelar} />
      <Input aria-label="Empresa" placeholder="Empresa" list={ID_EMPRESAS} value={v.empresa} onChange={e => setV({ ...v, empresa: e.target.value })} maxLength={100} />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" className="h-9 flex-1 sm:flex-none" disabled={gravando || !v.nome.trim()}>
          {gravando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : onCancelar ? <Check className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}{rotulo}
        </Button>
        {onCancelar && <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onCancelar} aria-label="Cancelar a edição"><X className="h-4 w-4" /></Button>}
      </div>
    </form>
  );
}

/**
 * Detalhes do projeto no Hub: nome e os stakeholders (as pessoas do projeto, com a empresa de cada
 * uma). Os stakeholders são os responsáveis escolhidos nas atividades.
 */
export function ProjetoDetalhesGO({ dados, projeto, aberto, podeEditar, onFechar, onMudou }: {
  dados: GoDados;
  projeto: GoProjeto;
  aberto: boolean;
  podeEditar: boolean;
  onFechar: () => void;
  /** Algo foi gravado: relê os dados. */
  onMudou: () => Promise<unknown>;
}) {
  const [nome, setNome] = useState(projeto.nome);
  const [curto, setCurto] = useState(projeto.curto);
  const [gravandoNome, setGravandoNome] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [remover, setRemover] = useState<GoStakeholder | null>(null);
  useEffect(() => { if (aberto) { setNome(projeto.nome); setCurto(projeto.curto); setEditando(null); } }, [aberto, projeto.nome, projeto.curto]);

  const cliente = dados.cli.get(projeto.cliente_id);
  const atividades = useMemo(() => atvsDe(dados, [projeto.id]), [dados, projeto.id]);
  const usoDe = (s: GoStakeholder) => atividades.filter(a => a.stakeholders.includes(s.id)).length;
  const empresas = Array.from(new Set(["Transdata", cliente?.nome ?? "", ...projeto.responsaveis, ...projeto.stakeholders.map(s => s.empresa)]
    .map(x => x.trim()).filter(Boolean)));
  const nomeMudou = nome.trim() !== projeto.nome || curto.trim() !== projeto.curto;

  const gravarNome = async () => {
    if (!nome.trim()) return;
    setGravandoNome(true);
    try {
      await salvarNomeProjeto(projeto.id, nome, curto);
      await onMudou();
      toast.success("Nome do projeto salvo");
    } catch (err) {
      toast.error("Não foi possível salvar o nome.", { description: mensagemGo(err) });
    } finally {
      setGravandoNome(false);
    }
  };
  const gravarStakeholder = async (v: { nome: string; empresa: string }, s?: GoStakeholder) => {
    try {
      const ordem = s ? s.ordem : Math.max(0, ...projeto.stakeholders.map(x => x.ordem)) + 1;
      await salvarStakeholder(projeto.id, { id: s?.id, nome: v.nome, empresa: v.empresa, ordem });
      await onMudou();
      if (s) setEditando(null);
      toast.success(s ? "Stakeholder atualizado" : `${v.nome.trim()} incluído nos stakeholders`);
      return true;
    } catch (err) {
      toast.error(s ? "Não foi possível salvar o stakeholder." : "Não foi possível incluir o stakeholder.", { description: mensagemGo(err) });
      return false;
    }
  };
  const confirmarRemocao = async () => {
    const s = remover;
    setRemover(null);
    if (!s) return;
    try {
      await removerStakeholder(s.id);
      await onMudou();
      toast.success(`${s.nome} saiu dos stakeholders`);
    } catch (err) {
      toast.error("Não foi possível tirar o stakeholder.", { description: mensagemGo(err) });
    }
  };

  return (
    <>
      <Dialog open={aberto} onOpenChange={o => { if (!o) onFechar(); }}>
        {/* sem foco automático: o nome do projeto não abre selecionado (uma tecla o apagaria) */}
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">Detalhes do projeto</p>
            <DialogTitle>{projeto.curto || projeto.nome}</DialogTitle>
            <DialogDescription>{[cliente?.nome, cliente?.local].filter(Boolean).join(" · ")}</DialogDescription>
          </DialogHeader>

          {projeto.project_id && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-sky-500/10 px-3 py-2 text-[12.5px] text-sky-800 dark:text-sky-200">
              Veio do cadastro de projetos do portal. Situação e GP são mudados lá.
              <Link to={`/projetos/${projeto.project_id}`} className="inline-flex items-center gap-1 font-semibold hover:underline">Abrir o cadastro<ExternalLink className="h-3 w-3" /></Link>
            </p>
          )}

          {podeEditar && (
            <section className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div><Label htmlFor="go-proj-nome" className="text-xs">Nome do projeto *</Label><Input id="go-proj-nome" className="mt-1.5" value={nome} onChange={e => setNome(e.target.value)} maxLength={150} /></div>
                <div><Label htmlFor="go-proj-curto" className="text-xs">Nome curto</Label><Input id="go-proj-curto" className="mt-1.5" value={curto} onChange={e => setCurto(e.target.value)} maxLength={80} placeholder="Opcional" /></div>
              </div>
              {nomeMudou && (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setNome(projeto.nome); setCurto(projeto.curto); }}>Desfazer</Button>
                  <Button size="sm" onClick={() => void gravarNome()} disabled={gravandoNome || !nome.trim()}>
                    {gravandoNome && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar nome
                  </Button>
                </div>
              )}
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />Stakeholders <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{projeto.stakeholders.length}</span></h3>
              <p className="text-[12px] text-muted-foreground">As pessoas do projeto. Nas atividades, os responsáveis são escolhidos entre elas.</p>
            </div>
            <datalist id={ID_EMPRESAS}>{empresas.map(e => <option key={e} value={e} />)}</datalist>

            {projeto.stakeholders.length ? (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                {projeto.stakeholders.map(s => {
                  const uso = usoDe(s);
                  return (
                    <li key={s.id} className="px-3 py-2">
                      {editando === s.id ? (
                        <CamposStakeholder inicial={{ nome: s.nome, empresa: s.empresa }} rotulo="Salvar" onSalvar={v => gravarStakeholder(v, s)} onCancelar={() => setEditando(null)} />
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold">{s.nome}</span>
                            <span className="block truncate text-[12px] text-muted-foreground">{s.empresa || "Sem empresa"} · {uso ? `responsável em ${uso} ${uso === 1 ? "atividade" : "atividades"}` : "sem atividades"}</span>
                          </span>
                          {podeEditar && (
                            <span className="flex shrink-0 gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditando(s.id)} aria-label={`Editar ${s.nome}`} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRemover(s)} aria-label={`Tirar ${s.nome}`} title="Tirar dos stakeholders"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[13px] text-muted-foreground">
                {podeEditar ? "Nenhum stakeholder ainda. Inclua abaixo as pessoas do projeto." : "Nenhum stakeholder cadastrado neste projeto."}
              </p>
            )}

            {podeEditar && (
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="mb-1.5 text-xs font-medium">Incluir stakeholder</p>
                <CamposStakeholder inicial={{ nome: "", empresa: "" }} rotulo="Incluir" onSalvar={v => gravarStakeholder(v)} />
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!remover} onOpenChange={o => { if (!o) setRemover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar {remover?.nome} dos stakeholders?</AlertDialogTitle>
            <AlertDialogDescription>
              {remover && usoDe(remover)
                ? `Essa pessoa é responsável em ${usoDe(remover)} ${usoDe(remover) === 1 ? "atividade" : "atividades"} e sai delas também.`
                : "Essa pessoa não é responsável por nenhuma atividade."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void confirmarRemocao()}>Tirar {remover?.nome}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
