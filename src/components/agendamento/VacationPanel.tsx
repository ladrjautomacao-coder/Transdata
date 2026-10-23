import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Palmtree, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approvedVisitsDuring, currentOrNextVacation, dateOfYmd, deleteTechnicianVacation, errorMessage, fmtVacation,
  saveTechnicianVacation, ymdOf, type Technician, type TechnicianVacation,
} from "@/lib/implantationScheduling";
import { fmtDayRange, visitDays } from "@/lib/agendaTecnica";

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
/** "AAAA-MM-DD" → "03/11/2026" */
const fullDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const dayCount = (v: TechnicianVacation) => Math.round((+dateOfYmd(v.end_date) - +dateOfYmd(v.start_date)) / 864e5) + 1;

/** Selo na linha do técnico: de férias agora ou as próximas férias. */
export function VacationChip({ tech }: { tech: Technician }) {
  const cur = currentOrNextVacation(tech, new Date());
  if (!cur) return null;
  const { vacation: v, now } = cur;
  return (
    <span title={`Férias de ${fullDate(v.start_date)} a ${fullDate(v.end_date)}${v.note ? ` · ${v.note}` : ""}`}
      className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-semibold leading-4 ${now ? "bg-sky-500/15 text-sky-800 dark:text-sky-200" : "bg-muted text-muted-foreground"}`}>
      <Palmtree aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">{now ? `De férias até ${fmtVacation({ start_date: v.end_date, end_date: v.end_date })}` : `Férias ${fmtVacation(v)}`}</span>
    </span>
  );
}

/**
 * Férias do técnico (abre embaixo da linha dele no cadastro): lista as férias atuais e
 * futuras e cadastra um novo período. Nesses dias ele fica indisponível na aprovação.
 */
export function VacationPanel({ tech, onChange }: {
  tech: Technician;
  /** Atualiza as férias do técnico na lista do cadastro (e avisa as telas da agenda). */
  onChange: (update: (list: TechnicianVacation[]) => TechnicianVacation[]) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const name = firstName(tech.full_name);
  const today = ymdOf(new Date());
  const all = tech.vacations ?? [];
  const upcoming = all.filter(v => v.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = all.length - upcoming.length;
  const ids = { start: `vac-start-${tech.id}`, end: `vac-end-${tech.id}`, note: `vac-note-${tech.id}` };

  const add = async () => {
    if (!start || !end) { setError("Informe o primeiro e o último dia das férias."); return; }
    if (end < start) { setError("O último dia deve ser igual ou depois do primeiro."); return; }
    setError(null);
    setSaving(true);
    try {
      const v = await saveTechnicianVacation({ technician_id: tech.id, start_date: start, end_date: end, note: note.trim() || null });
      onChange(list => [...list, v]);
      setStart(""); setEnd(""); setNote("");
      // visita já aprovada nesse período continua na agenda: avisa para trocar o técnico
      const visits = await approvedVisitsDuring(tech.id, v.start_date, v.end_date).catch(() => []);
      if (visits.length) {
        toast.warning(`Férias de ${name} cadastradas, mas ${visits.length === 1 ? "há 1 visita aprovada" : `há ${visits.length} visitas aprovadas`} com ele nesse período`, {
          description: `${visits.map(r => `${r.project?.company_name ?? "Projeto removido"} (${fmtDayRange(visitDays(r).first, visitDays(r).last)})`).join("; ")}. Revise no Calendário: a visita aparece com o alerta de férias.`,
          duration: 12000,
        });
      } else {
        toast.success(`Férias de ${name} cadastradas: ${fmtVacation(v)}.`, { description: "Nesse período ele não fica disponível na aprovação." });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally { setSaving(false); }
  };

  const remove = async (v: TechnicianVacation) => {
    setBusyId(v.id);
    try {
      await deleteTechnicianVacation(v.id);
      onChange(list => list.filter(x => x.id !== v.id));
      toast.success(`Férias de ${name} (${fmtVacation(v)}) removidas.`, {
        action: {
          label: "Desfazer",
          onClick: () => {
            saveTechnicianVacation({ technician_id: tech.id, start_date: v.start_date, end_date: v.end_date, note: v.note })
              .then(back => onChange(list => [...list, back]))
              .catch(err => toast.error("Não foi possível desfazer", { description: errorMessage(err) }));
          },
        },
      });
    } catch (err) {
      toast.error("Não foi possível remover as férias", { description: errorMessage(err) });
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3 bg-sky-500/[0.05] px-3 py-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Palmtree className="h-4 w-4 text-sky-600 dark:text-sky-400" />Férias de {name}</p>
        <p className="text-[11px] text-muted-foreground">Nos dias de férias ele aparece como indisponível na aprovação e no calendário.</p>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum período de férias programado.</p>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map(v => (
            <li key={v.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium tabular-nums">
                  {fullDate(v.start_date)} a {fullDate(v.end_date)}
                  {v.start_date <= today && <span className="rounded-full bg-sky-500/15 px-1.5 text-[10.5px] font-semibold leading-4 text-sky-800 dark:text-sky-200">em andamento</span>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{dayCount(v)} {dayCount(v) === 1 ? "dia" : "dias"}{v.note ? ` · ${v.note}` : ""}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(v)} disabled={busyId === v.id} aria-label={`Remover férias de ${fullDate(v.start_date)} a ${fullDate(v.end_date)}`} title="Remover férias">
                {busyId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-md border border-dashed border-sky-500/40 bg-card p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs" htmlFor={ids.start}>Primeiro dia</Label>
            <Input id={ids.start} type="date" className="mt-1.5 h-9" value={start}
              onChange={e => { setStart(e.target.value); setError(null); if (!end || end < e.target.value) setEnd(e.target.value); }} />
          </div>
          <div>
            <Label className="text-xs" htmlFor={ids.end}>Último dia</Label>
            <Input id={ids.end} type="date" className="mt-1.5 h-9" value={end} min={start || undefined}
              onChange={e => { setEnd(e.target.value); setError(null); }} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Label className="text-xs" htmlFor={ids.note}>Observação (opcional)</Label>
            <Input id={ids.note} className="mt-1.5 h-9" maxLength={200} placeholder="Ex.: férias anuais" value={note}
              onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
          </div>
          <Button className="h-9 shrink-0" onClick={add} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}Adicionar
          </Button>
        </div>
        {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
      </div>
      {past > 0 && <p className="text-[11px] text-muted-foreground">{past === 1 ? "1 período de férias já passou e" : `${past} períodos de férias já passaram e`} não aparece{past === 1 ? "" : "m"} aqui.</p>}
    </div>
  );
}
