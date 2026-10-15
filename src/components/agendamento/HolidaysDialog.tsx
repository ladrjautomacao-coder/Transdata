import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Constants } from "@/integrations/supabase/types";
import {
  HOLIDAY_SCOPE_LABEL, deleteCustomHoliday, formatHolidayDate, holidaysForVisit, nationalHolidays, saveCustomHoliday,
  type Holiday,
} from "@/lib/holidays";
import { errorMessage } from "@/lib/implantationScheduling";

type CustomScope = "empresa" | "estadual" | "municipal";

/** Lista os feriados do ano (nacionais calculados + cadastrados) e permite cadastrar/excluir os próprios. */
export function HolidaysDialog({ open, onOpenChange, custom, canEdit, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; custom: Holiday[]; canEdit: boolean; onChanged: () => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<CustomScope>("empresa");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => { if (open) setYear(new Date().getFullYear()); }, [open]);

  const list = useMemo(() => [...nationalHolidays(year), ...custom.filter(h => h.date.startsWith(`${year}-`))]
    .sort((a, b) => a.date.localeCompare(b.date)), [year, custom]);

  const invalid = !date || !name.trim() || (scope !== "empresa" && !state) || (scope === "municipal" && !city.trim());

  const add = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await saveCustomHoliday({
        holiday_date: date, name: name.trim(), scope,
        state: scope === "empresa" ? null : state, city: scope === "municipal" ? city.trim() : null,
      });
      toast.success("Feriado cadastrado", { description: `${formatHolidayDate(date)} · ${name.trim()}` });
      setDate(""); setName(""); setCity("");
      onChanged();
    } catch (e) {
      toast.error("Não foi possível cadastrar o feriado", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h: Holiday) => {
    if (!h.id) return;
    setRemoving(h.id);
    try {
      await deleteCustomHoliday(h.id);
      toast.success("Feriado excluído");
      onChanged();
    } catch (e) {
      toast.error("Não foi possível excluir", { description: errorMessage(e) });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5 text-primary" />Feriados da agenda</DialogTitle>
          <DialogDescription>
            Os nacionais entram automaticamente. Cadastre aqui os da empresa, de um estado ou de uma cidade — os regionais
            só geram aviso nas visitas daquele local.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold">Novo feriado</p>
            <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
              <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1.5 h-9" /></div>
              <div><Label className="text-xs">Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Aniversário de Marília" className="mt-1.5 h-9" /></div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[140px_100px_1fr]">
              <div>
                <Label className="text-xs">Abrangência</Label>
                <Select value={scope} onValueChange={v => setScope(v as CustomScope)}>
                  <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="estadual">Estadual</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope !== "empresa" && (
                <div>
                  <Label className="text-xs">UF</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{Constants.public.Enums.brazilian_state.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {scope === "municipal" && (
                <div><Label className="text-xs">Cidade</Label><Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex.: Marília" className="mt-1.5 h-9" /></div>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={add} disabled={invalid || saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}Cadastrar feriado
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Feriados de {year}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setYear(y => y - 1)}>{year - 1}</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setYear(y => y + 1)}>{year + 1}</Button>
          </div>
        </div>
        <ul className="divide-y rounded-lg border border-border/60">
          {list.map((h, i) => (
            <li key={h.id ?? `${h.date}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 font-semibold text-rose-700 dark:text-rose-300">{formatHolidayDate(h.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{h.name}{h.optional && <span className="text-muted-foreground"> (ponto facultativo)</span>}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {HOLIDAY_SCOPE_LABEL[h.scope]}{h.scope === "estadual" ? ` · ${h.state}` : h.scope === "municipal" ? ` · ${h.city}/${h.state}` : ""}
                </span>
              </span>
              {canEdit && h.id && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(h)}
                  disabled={removing === h.id} aria-label={`Excluir ${h.name}`} title="Excluir">
                  {removing === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Aviso usado ao solicitar/aprovar: o período inclui feriado(s) que valem para o local do projeto. */
export function HolidayWarning({ start, end, custom, place }: {
  start: Date | null; end: Date | null; custom: Holiday[]; place?: { city?: string | null; state?: string | null };
}) {
  if (!start || !end || isNaN(+start) || isNaN(+end) || end < start) return null;
  const hits = holidaysForVisit(start, end, custom, place);
  if (!hits.length) return null;
  return (
    <div className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <b>O período inclui feriado:</b>{" "}
        {hits.map(h => `${formatHolidayDate(h.date)} · ${h.name}${h.optional ? " (ponto facultativo)" : ""}`).join("; ")}.
        {" "}Confirme com o cliente se haverá operação nesses dias.
      </span>
    </div>
  );
}
