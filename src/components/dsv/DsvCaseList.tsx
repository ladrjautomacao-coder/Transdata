import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Code2, ExternalLink, Headset, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { errorMessage } from "@/lib/implantationScheduling";
import { DSV_KIND_LABEL, deleteDsvCase, reopenDsvCase, resolveDsvCase, type DsvCase } from "@/lib/dsvCases";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Lista dos casos DSV de um projeto, com o link para o Azure e as ações do GP. */
export default function DsvCaseList({ cases, canEdit, onChanged }: {
  cases: DsvCase[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DsvCase | null>(null);

  const run = async (c: DsvCase, action: () => Promise<void>, ok: string) => {
    setBusy(c.id);
    try { await action(); toast.success(ok); onChanged(); }
    catch (err) { toast.error("Não foi possível salvar", { description: errorMessage(err) }); }
    finally { setBusy(null); }
  };

  if (cases.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum caso DSV registrado neste projeto.</p>;
  }
  return (
    <>
      <ul className="space-y-2.5">
        {cases.map(c => {
          const open = c.status === "aberto";
          const Icon = c.kind === "suporte" ? Headset : Code2;
          return (
            <li key={c.id} className={`rounded-lg border p-3.5 ${open ? "border-sky-500/40 bg-card" : "border-border/60 bg-muted/30"}`}>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${open ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {c.azure_id && <span className="font-mono text-xs font-semibold text-muted-foreground">#{c.azure_id}</span>}
                    <span className={`min-w-0 break-words text-sm font-semibold ${open ? "" : "text-muted-foreground"}`}>{c.title}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {DSV_KIND_LABEL[c.kind]} · aberto em {fmt(c.created_at)}{c.created_by_name ? ` por ${c.created_by_name}` : ""}
                    {!open && c.resolved_at ? ` · resolvido em ${fmt(c.resolved_at)}${c.resolved_by_name ? ` por ${c.resolved_by_name}` : ""}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${open ? "bg-sky-500/15 text-sky-800 dark:text-sky-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
                  {open ? "Aberto" : "Resolvido"}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2 pl-12">
                <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                  <a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir no Azure</a>
                </Button>
                {canEdit && (open ? (
                  <Button size="sm" className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-500" disabled={busy === c.id}
                    onClick={() => void run(c, () => resolveDsvCase(c.id), `Caso${c.azure_id ? ` #${c.azure_id}` : ""} resolvido.`)}>
                    {busy === c.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Marcar como resolvido
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy === c.id}
                    onClick={() => void run(c, () => reopenDsvCase(c.id), "Caso reaberto.")}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reabrir
                  </Button>
                ))}
                {canEdit && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => setToDelete(c)} title="Caso registrado por engano">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!toDelete} onOpenChange={o => { if (!o && !busy) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir caso DSV?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.azure_id ? `#${toDelete.azure_id} · ` : ""}{toDelete?.title}. Use só quando o caso foi registrado por engano: ele deixa de contar nos indicadores do projeto. Se o problema foi resolvido, use "Marcar como resolvido".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={!!busy}
              onClick={e => {
                e.preventDefault();
                const c = toDelete;
                if (c) void run(c, () => deleteDsvCase(c.id), "Caso DSV excluído.").then(() => setToDelete(null));
              }}>
              Excluir caso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
