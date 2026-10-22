import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Building2, CalendarClock, CheckCircle2, CornerDownRight, History, Hourglass, Info, Loader2, MoreHorizontal, Puzzle, Trash2, UserX, XCircle, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChoiceCard } from "@/components/agendamento/AgendaDialogs";
import { errorMessage } from "@/lib/implantationScheduling";
import {
  PENDENCY_REASONS, PENDENCY_REASON_LABEL, cancelPendency, createPendency, deletePendency, resolvePendency,
  type PendencyReason, type ProjectPendency,
} from "@/lib/projectPendencies";

const OTHER = "__outro";
const REASON_ICON: Record<PendencyReason, LucideIcon> = {
  decisao_cliente: UserX, infraestrutura_cliente: Building2, terceiros: Hourglass, outro: MoreHorizontal,
};
const FieldError = ({ msg }: { msg?: string }) => msg ? <p className="mt-1 text-[11px] font-medium text-destructive">{msg}</p> : null;
const norm = (s: string) => s.trim().toLowerCase();
const p2 = (n: number) => String(n).padStart(2, "0");

/** Rascunho do formulário (localStorage, por usuário e por projeto ou card filho). */
type Draft = { choice: string; other: string; reasonKind: PendencyReason | ""; reason: string; expected: string; note: string; savedAt: string };

export type PendencyDialogMode =
  | { kind: "criar"; project: { id: string; company_name: string; status: string; solutions: { id: string; name: string }[] }; openTitles: string[] }
  | { kind: "implantada" | "cancelar" | "excluir"; pendency: ProjectPendency; projectName: string };

/**
 * Criar o card filho (solução pendente), marcar como implantada ou registrar a desistência
 * do cliente. Depois de criar, convida o GP a mover o projeto pai para Implementado,
 * que é o objetivo do card filho.
 */
export default function PendencyDialog({ mode, onOpenChange, onDone, onMoveParent }: {
  mode: PendencyDialogMode | null; onOpenChange: (o: boolean) => void; onDone: () => void;
  /** Move o projeto pai para Implementado; devolve true se deu certo. */
  onMoveParent?: (projectId: string) => Promise<boolean>;
}) {
  const [created, setCreated] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [reasonKind, setReasonKind] = useState<PendencyReason | "">("");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ item?: string; reason?: string; note?: string }>({});
  const [saving, setSaving] = useState(false);
  const [restoredAt, setRestoredAt] = useState<Date | null>(null);
  /** Revisão antes de gravar: o GP confere o card filho e confirma. */
  const [reviewing, setReviewing] = useState(false);
  const { user } = useAuth();

  // Rascunho: o que o GP digitou volta se ele fechar a janela ou sair da tela para buscar uma informação.
  const draftKey = !mode || !user?.id || mode.kind === "excluir" ? null
    : mode.kind === "criar" ? `transdata:card-filho:${user.id}:${mode.project.id}`
      : `transdata:card-filho-nota:${user.id}:${mode.pendency.id}:${mode.kind}`;
  const dirty = !!(choice || other.trim() || reasonKind || reason.trim() || expected || note.trim());

  useEffect(() => {
    if (!mode) return;
    setErrors({}); setCreated(null); setRestoredAt(null); setReviewing(false);
    let d: Partial<Draft> = {};
    try {
      const raw = draftKey ? localStorage.getItem(draftKey) : null;
      if (raw) d = JSON.parse(raw) as Partial<Draft>;
    } catch { d = {}; }
    setChoice(d.choice ?? ""); setOther(d.other ?? ""); setReasonKind(d.reasonKind ?? ""); setReason(d.reason ?? "");
    setExpected(d.expected ?? ""); setNote(d.note ?? "");
    if (d.savedAt) setRestoredAt(new Date(d.savedAt));
  }, [mode, draftKey]);

  useEffect(() => {
    if (!draftKey || created) return;
    const t = setTimeout(() => {
      try {
        if (!dirty) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ choice, other, reasonKind, reason, expected, note, savedAt: new Date().toISOString() } satisfies Draft));
      } catch { /* sem armazenamento no navegador: segue sem rascunho */ }
    }, 400);
    return () => clearTimeout(t);
  }, [draftKey, created, dirty, choice, other, reasonKind, reason, expected, note]);

  if (!mode) return null;
  const close = () => onOpenChange(false);
  const done = () => { close(); onDone(); };
  const clearDraft = () => { try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* ignora */ } };
  const discard = () => {
    clearDraft();
    setChoice(""); setOther(""); setReasonKind(""); setReason(""); setExpected(""); setNote(""); setErrors({}); setRestoredAt(null);
  };
  // preenchido, a janela não fecha com um clique fora dela (o X e o Cancelar continuam fechando)
  const keepOpen = (e: Event) => { if (dirty) e.preventDefault(); };
  const draftBanner = restoredAt && (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
      <History className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">Rascunho recuperado de {p2(restoredAt.getDate())}/{p2(restoredAt.getMonth() + 1)} às {p2(restoredAt.getHours())}:{p2(restoredAt.getMinutes())}.</span>
      <button type="button" onClick={discard} className="font-semibold hover:underline">Descartar</button>
    </div>
  );

  // card filho aberto por engano: confirma e exclui (não fica no histórico)
  if (mode.kind === "excluir") {
    const remove = async () => {
      setSaving(true);
      try {
        await deletePendency(mode.pendency.id);
        toast.success(`Card filho excluído: ${mode.pendency.title}.`);
        done();
      } catch (err) {
        toast.error("Não foi possível excluir", { description: errorMessage(err) });
      } finally { setSaving(false); }
    };
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Excluir card filho?</DialogTitle>
            <DialogDescription>{mode.projectName} · {mode.pendency.title}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>Use só quando o card filho foi <b>aberto por engano</b>. Ele sai do quadro e <b>não fica no histórico</b> do projeto. Se o cliente desistiu da solução, use <b>Cliente desistiu</b>: assim o registro fica guardado.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Voltar</Button>
            <Button variant="destructive" onClick={remove} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}Excluir card filho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode.kind !== "criar") {
    const resolve = mode.kind === "implantada";
    const submit = async () => {
      if (!resolve && note.trim().length < 5) { setErrors({ note: "Conte em poucas palavras por que o cliente desistiu." }); return; }
      setSaving(true);
      try {
        if (resolve) await resolvePendency(mode.pendency.id, note);
        else await cancelPendency(mode.pendency.id, note);
        clearDraft();
        toast.success(resolve ? `${mode.pendency.title} implantada em ${mode.projectName}.` : `Desistência registrada: ${mode.pendency.title}.`);
        done();
      } catch (err) {
        toast.error("Não foi possível salvar", { description: errorMessage(err) });
      } finally { setSaving(false); }
    };
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" onInteractOutside={keepOpen}>
          <DialogHeader>
            <DialogTitle>{resolve ? "Marcar como implantada" : "Cliente desistiu"}</DialogTitle>
            <DialogDescription>{mode.projectName} · {mode.pendency.title}</DialogDescription>
          </DialogHeader>
          {draftBanner}
          <div>
            <Label className="text-xs" htmlFor="pend-note">{resolve ? "Como ficou? (opcional)" : "Motivo da desistência *"}</Label>
            <Textarea id="pend-note" className="mt-1.5" rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}
              placeholder={resolve ? "Ex.: Biometria ativada na visita de 12/11." : "Ex.: Cliente decidiu não usar biometria nesta frota."} />
            <FieldError msg={errors.note} />
            <p className="mt-2 text-[11px] text-muted-foreground">O card filho sai da coluna Implantação pendente e fica no histórico do projeto.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Voltar</Button>
            <Button onClick={submit} disabled={saving}
              className={resolve ? "bg-emerald-600 text-white hover:bg-emerald-500" : ""} variant={resolve ? "default" : "destructive"}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : resolve ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <XCircle className="mr-1.5 h-4 w-4" />}
              {resolve ? "Confirmar implantação" : "Registrar desistência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const { project, openTitles } = mode;

  // card filho criado: o próximo passo é levar o projeto pai para Implementado
  if (created) {
    const move = async () => {
      if (!onMoveParent) return;
      setSaving(true);
      const ok = await onMoveParent(project.id);
      setSaving(false);
      if (ok) close();
    };
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-7 w-7" /></span>
            <DialogHeader className="items-center space-y-1.5 text-center sm:text-center">
              <DialogTitle>Card filho criado. Agora finalize o projeto</DialogTitle>
              <DialogDescription>
                <b className="text-foreground">{created}</b> ficou na coluna Implantação pendente. Mova <b className="text-foreground">{project.company_name}</b> para
                Implementado: o projeto conta como finalizado e o que faltou continua à vista.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-800 dark:text-amber-300">Implantação</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-800 dark:text-emerald-300">Implementado</span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={close}>Agora não</Button>
            <Button onClick={move} disabled={saving} className="bg-emerald-600 text-white hover:bg-emerald-500">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}Mover para Implementado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const pending = (name: string) => openTitles.some(t => norm(t) === norm(name));
  const sol = project.solutions.find(s => s.id === choice);
  const title = choice === OTHER ? other.trim() : sol?.name ?? "";

  // 1º passo: valida e mostra a revisão (nada é gravado ainda)
  const submit = () => {
    const next: typeof errors = {
      item: !choice ? "Escolha a solução que ficou pendente." : choice === OTHER && title.length < 2 ? "Descreva o item pendente." : pending(title) ? "Este item já tem um card filho em aberto." : undefined,
      reason: !reasonKind ? "Escolha o motivo." : reasonKind === "outro" && reason.trim().length < 5 ? "Descreva o motivo no detalhe." : undefined,
    };
    setErrors(next);
    if (next.item || next.reason) return;
    setReviewing(true);
  };

  // 2º passo: o GP conferiu e confirmou
  const confirm = async () => {
    setSaving(true);
    try {
      await createPendency({
        project_id: project.id, solution_id: choice === OTHER ? null : choice, title,
        reason_kind: reasonKind as PendencyReason, reason: reason.trim() || null, expected_date: expected || null,
      });
      clearDraft();
      onDone();
      setReviewing(false);
      if (project.status !== "encerrado" && onMoveParent) setCreated(title);
      else { toast.success(`Card filho criado: ${title}`, { description: "Ele fica na coluna Implantação pendente." }); close(); }
    } catch (err) {
      toast.error("Não foi possível criar o card filho", { description: errorMessage(err) });
    } finally { setSaving(false); }
  };

  if (reviewing) {
    const rows: [string, string][] = [
      ["Projeto", project.company_name],
      ["Item pendente", title],
      ["Motivo", reasonKind ? PENDENCY_REASON_LABEL[reasonKind] : "—"],
      ["Detalhe", reason.trim() || "—"],
      ["Previsão de retomada", expected ? expected.split("-").reverse().join("/") : "Não informada"],
    ];
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" onInteractOutside={keepOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Confira antes de criar</DialogTitle>
            <DialogDescription>O card filho registra que o cliente deixou esta solução para depois.</DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-border/60 rounded-lg border border-border/60">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 px-3.5 py-2 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={`min-w-0 break-words ${k === "Item pendente" ? "font-semibold" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-900 dark:text-amber-100">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Depois de criado, o card filho aparece no Kanban para a equipe e entra nos lembretes até ser implantado. <b>Confira se é mesmo uma solução que ficou para depois.</b></span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReviewing(false)} disabled={saving}>Voltar e corrigir</Button>
            <Button onClick={confirm} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}Confirmar e criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onInteractOutside={keepOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CornerDownRight className="h-5 w-5 text-orange-500" />Criar card filho</DialogTitle>
          <DialogDescription>{project.company_name} · registre o que ficou para depois e finalize o projeto sem perder o rastro.</DialogDescription>
        </DialogHeader>
        {draftBanner}
        <div className="space-y-4">
          <div>
            <Label className="text-xs" id="pend-item">Item pendente *</Label>
            <div role="radiogroup" aria-labelledby="pend-item" className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {project.solutions.map(s => {
                const used = pending(s.name);
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={choice === s.id} disabled={used}
                    onClick={() => { setChoice(s.id); setErrors(e => ({ ...e, item: undefined })); }}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${choice === s.id ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
                    <Puzzle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {used && <span className="text-[10px] font-semibold uppercase text-orange-600 dark:text-orange-400">já pendente</span>}
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={choice === OTHER} onClick={() => { setChoice(OTHER); setErrors(e => ({ ...e, item: undefined })); }}
                className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${choice === OTHER ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
                <MoreHorizontal className="h-4 w-4 shrink-0" />Outro item…
              </button>
            </div>
            {choice === OTHER && <Input autoFocus className="mt-2" maxLength={120} value={other} onChange={e => setOther(e.target.value)} placeholder="Ex.: Integração com o sistema da prefeitura" />}
            {project.solutions.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">Este projeto não tem soluções cadastradas: use "Outro item".</p>}
            <FieldError msg={errors.item} />
          </div>

          <div>
            <Label className="text-xs" id="pend-reason">Por que ficou pendente? *</Label>
            <div role="radiogroup" aria-labelledby="pend-reason" className="mt-1.5 grid grid-cols-2 gap-2">
              {PENDENCY_REASONS.map(r => (
                <ChoiceCard key={r.value} on={reasonKind === r.value} icon={REASON_ICON[r.value]} title={r.label} hint={r.hint}
                  onSelect={() => { setReasonKind(r.value); setErrors(e => ({ ...e, reason: undefined })); }} />
              ))}
            </div>
            <Textarea className="mt-2" rows={2} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}
              placeholder={reasonKind === "outro" ? "Descreva o motivo *" : "Detalhe (opcional). Ex.: cliente vai licitar as câmeras em 2027."} />
            <FieldError msg={errors.reason} />
          </div>

          <div className="max-w-[220px]">
            <Label className="text-xs" htmlFor="pend-expected">Previsão de retomada</Label>
            <Input id="pend-expected" className="mt-1.5" type="date" value={expected} onChange={e => setExpected(e.target.value)} />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-sky-500/10 px-3.5 py-3 text-xs text-sky-800 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>O card filho fica na coluna <b>Implantação pendente</b> e o projeto pode ir para <b>Implementado</b>: logo depois de criar, o portal oferece mover o projeto. Quando o cliente ativar, marque o card filho como implantado.</span>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <History className="h-3 w-3 shrink-0" />O que você preencher fica salvo como rascunho neste navegador: pode fechar e voltar depois.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>{dirty ? "Fechar e continuar depois" : "Cancelar"}</Button>
          <Button onClick={submit}><CornerDownRight className="mr-1.5 h-4 w-4" />Revisar e criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
