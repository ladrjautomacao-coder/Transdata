import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Ban, CalendarRange, Camera, Check, CheckCircle2, History, Info, Loader2,
  MapPin, MessageSquareWarning, Monitor, Pencil, Plus, RotateCcw, Send, Trash2, Video, X, type LucideIcon,
} from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import {
  HIDDEN_BY_DEFAULT_STATUSES, VISIT_PURPOSE_GROUPS, VISIT_PURPOSE_PRESETS, cancelRequest, createRequest,
  ATTENDANCE_LABEL, cancelApprovedRequest, errorMessage, fetchHistory, fetchTechnicians, formatPeriod, periodOf, registerAttendance,
  countTechnicianVisits, rejectRequest, removeTechnician, saveTechnician, type Attendance,
  photoFileProblem, removeTechnicianPhoto, techniciansOf, toLocalInput, uploadTechnicianPhoto,
  VISIT_FORMAT_LABEL, formatAddress, normalizeMeetingUrl, type VisitFormat,
  type EligibleProject, type HistoryEntry, type ImplantationRequest, type Technician,
} from "@/lib/implantationScheduling";
import { MeetingLink, ProjectBox, StatusPill, TechAvatar } from "./AgendaShared";
import { HolidayWarning } from "./HolidaysDialog";
import { useCustomHolidays } from "@/hooks/useCustomHolidays";

const OTHER = "__outro";
const fmtDT = (iso: string | Date) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const FieldError = ({ msg }: { msg?: string }) => msg ? <p className="mt-1 text-[11px] font-medium text-destructive">{msg}</p> : null;

/* ─── Solicitar agenda (GP) ─────────────────────────────────────────────── */
const DUPLICATE_PURPOSE_MSG = "Você já agendou este projeto justamente com este objetivo da visita, revise o Projeto.";
const normPurpose = (s: string) => s.trim().toLowerCase();
const FORMAT_OPTIONS: { value: VisitFormat; icon: LucideIcon; hint: string }[] = [
  { value: "presencial", icon: MapPin, hint: "No endereço do cliente" },
  { value: "remoto", icon: Video, hint: "Por videochamada" },
];
const joinPt = (xs: string[]) => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : xs[0] ?? "";

export function RequestDialog({ project, open, onOpenChange, onCreated, existing = [] }: {
  project: EligibleProject | null; open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void;
  /** Solicitações já existentes (todas); usadas para impedir objetivo repetido no mesmo projeto. */
  existing?: ImplantationRequest[];
}) {
  const [purpose, setPurpose] = useState("");
  const [custom, setCustom] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState<VisitFormat | "">("");
  const [street, setStreet] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const { custom: customHolidays } = useCustomHolidays(open);
  const [errors, setErrors] = useState<{ purpose?: string; dates?: string; format?: string; address?: string; meeting?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    const s = new Date(); s.setDate(s.getDate() + 7); s.setHours(8, 0, 0, 0);
    const e = new Date(s); e.setDate(e.getDate() + 2); e.setHours(18, 0, 0, 0);
    setPurpose(""); setCustom(""); setStart(toLocalInput(s)); setEnd(toLocalInput(e));
    // o formato é escolha obrigatória do GP; cidade e UF já vêm do projeto
    setFormat(""); setStreet(""); setDistrict(""); setCity(project.city ?? ""); setUf(project.state ?? ""); setMeetingUrl("");
    setNotes(""); setErrors({});
  }, [open, project]);

  if (!project) return null;
  const isBR = (project.country_code ?? "BR") === "BR";
  const phase = project.sub_phase ? subPhasesByStatus[project.status as keyof typeof subPhasesByStatus]?.find(s => s.id === project.sub_phase)?.label : null;

  // Visitas ativas (pendente/aprovada) deste projeto: o mesmo objetivo não pode se repetir
  const activeVisits = existing
    .filter(r => r.project_id === project.id && (r.status === "pendente" || r.status === "aprovada"))
    .sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  const usedPurpose = (p: string) => activeVisits.find(r => normPurpose(r.visit_purpose) === normPurpose(p));
  const chosen = purpose === OTHER ? custom : purpose;
  const duplicate = chosen.trim() ? usedPurpose(chosen) : undefined;

  const submit = async () => {
    const finalPurpose = purpose === OTHER ? custom.trim() : purpose;
    const s = new Date(start), e = new Date(end);
    const presencial = format === "presencial";
    const url = format === "remoto" ? normalizeMeetingUrl(meetingUrl) : null;
    const missing = presencial
      ? [!street.trim() && "rua e número", !district.trim() && "bairro", !city.trim() && "cidade", isBR && !uf && "estado"].filter((x): x is string => !!x)
      : [];
    const next: typeof errors = {
      purpose: !purpose ? "Escolha o objetivo da visita." : purpose === OTHER && !custom.trim() ? "Digite o nome da visita." : duplicate ? DUPLICATE_PURPOSE_MSG : undefined,
      dates: isNaN(+s) || isNaN(+e) ? "Informe início e fim." : e <= s ? "O fim deve ser depois do início." : s < new Date() ? "O início não pode ser no passado." : undefined,
      format: !format ? "Escolha se o treinamento é presencial ou remoto." : undefined,
      address: missing.length ? `Informe ${joinPt(missing)}.` : undefined,
      meeting: format === "remoto" && !url
        ? meetingUrl.trim() ? "Link inválido. Cole o endereço completo da reunião (ex.: https://meet.google.com/...)." : "Cole o link da reunião."
        : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const address = presencial
      ? { address_street: street.trim(), address_district: district.trim(), address_city: city.trim(), address_state: uf.trim() || null }
      : { address_street: null, address_district: null, address_city: null, address_state: null };
    setSaving(true);
    try {
      await createRequest({
        project_id: project.id, visit_purpose: finalPurpose,
        visit_purpose_is_custom: !(VISIT_PURPOSE_PRESETS as readonly string[]).includes(finalPurpose),
        requested_start: s.toISOString(), requested_end: e.toISOString(),
        visit_format: format as VisitFormat, ...address, meeting_url: url,
        location: presencial ? formatAddress(address) : VISIT_FORMAT_LABEL.remoto,
        notes: notes.trim() || null,
      });
      toast.success(`Solicitação enviada para ${project.company_name}. Aguardando o Aprovador.`);
      onOpenChange(false); onCreated();
    } catch (err) {
      toast.error("Não foi possível enviar a solicitação", { description: errorMessage(err) });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar agenda de visita técnica</DialogTitle>
          <DialogDescription>O Aprovador avalia e define os técnicos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ProjectBox project={project} extra={<> · <span className="font-semibold text-primary">{phase ?? statusLabels[project.status as keyof typeof statusLabels]}</span></>} />
          {HIDDEN_BY_DEFAULT_STATUSES.includes(project.status) && (
            <div className="flex items-start gap-2.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3.5 py-2.5 text-xs text-teal-800 dark:text-teal-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Projeto já <b>{statusLabels.encerrado.toLowerCase()}</b>: esta solicitação será uma <b>visita extra</b>.</span>
            </div>
          )}
          <div>
            <Label className="text-xs">Objetivo da visita *</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {VISIT_PURPOSE_GROUPS.map((g, i) => (
                  <SelectGroup key={i}>
                    {g.label && <SelectLabel>{g.label}</SelectLabel>}
                    {g.items.map(it => {
                      const used = usedPurpose(it);
                      return (
                        <SelectItem key={it} value={it}>
                          {it}{used && <span className="ml-2 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">já agendada</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
                <SelectSeparator />
                <SelectItem value={OTHER}>Outro (digitar nome da visita)…</SelectItem>
              </SelectContent>
            </Select>
            {purpose === OTHER && (
              <Input autoFocus className="mt-2" value={custom} maxLength={80} onChange={e => setCustom(e.target.value)} placeholder="Ex.: Vistoria pós-instalação" />
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">Use um objetivo padrão ou selecione “Outro” para digitar livremente.</p>
            {duplicate ? (
              <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <b>{DUPLICATE_PURPOSE_MSG}</b>
                  <br />“{duplicate.visit_purpose}” já está {duplicate.status === "aprovada" ? "aprovada" : "pendente de aprovação"} para {formatPeriod(periodOf(duplicate).start, periodOf(duplicate).end)}.
                </span>
              </div>
            ) : <FieldError msg={errors.purpose} />}
          </div>
          {activeVisits.length > 0 && (
            <div className="rounded-lg border border-border/60 px-3.5 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visitas já na agenda deste projeto</p>
              <ul className="space-y-1">
                {activeVisits.map(r => (
                  <li key={r.id} className="flex items-center gap-2 text-xs">
                    <StatusPill status={r.status} />
                    <span className="font-medium">{r.visit_purpose}</span>
                    <span className="text-muted-foreground">· {formatPeriod(periodOf(r).start, periodOf(r).end)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Início desejado *</Label><Input className="mt-1.5" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><Label className="text-xs">Fim desejado *</Label><Input className="mt-1.5" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <FieldError msg={errors.dates} />
          <HolidayWarning start={start ? new Date(start) : null} end={end ? new Date(end) : null} custom={customHolidays}
            place={{ city: project?.city, state: project?.state }} />
          <div>
            <Label className="text-xs" id="req-format-label">Formato do treinamento *</Label>
            <div role="radiogroup" aria-labelledby="req-format-label" className="mt-1.5 grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map(o => {
                const on = format === o.value;
                const Icon = o.icon;
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={on}
                    onClick={() => { setFormat(o.value); setErrors(er => ({ ...er, format: undefined, address: undefined, meeting: undefined })); }}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium ${on ? "text-primary" : ""}`}>{VISIT_FORMAT_LABEL[o.value]}</span>
                      <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <FieldError msg={errors.format} />
          </div>
          {format === "presencial" && (
            <div className="rounded-lg border border-border/60 p-3">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Endereço do treinamento</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_96px]">
                <div className="sm:col-span-3">
                  <Label className="text-xs" htmlFor="req-street">Rua e número *</Label>
                  <Input id="req-street" className="mt-1.5" value={street} maxLength={160} onChange={e => setStreet(e.target.value)} placeholder="Ex.: Rua das Flores, 120" />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="req-district">Bairro *</Label>
                  <Input id="req-district" className="mt-1.5" value={district} maxLength={80} onChange={e => setDistrict(e.target.value)} placeholder="Ex.: Centro" />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="req-city">Cidade *</Label>
                  <Input id="req-city" className="mt-1.5" value={city} maxLength={100} onChange={e => setCity(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="req-uf">{isBR ? "Estado *" : "Estado"}</Label>
                  {isBR ? (
                    <Select value={uf || undefined} onValueChange={setUf}>
                      <SelectTrigger id="req-uf" className="mt-1.5"><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent className="max-h-60">{Constants.public.Enums.brazilian_state.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input id="req-uf" className="mt-1.5" value={uf} maxLength={60} onChange={e => setUf(e.target.value)} />
                  )}
                </div>
              </div>
              <FieldError msg={errors.address} />
            </div>
          )}
          {format === "remoto" && (
            <div>
              <Label className="text-xs" htmlFor="req-meeting">Link da reunião *</Label>
              <Input id="req-meeting" className="mt-1.5" type="url" inputMode="url" value={meetingUrl} maxLength={2000}
                onChange={e => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." />
              {errors.meeting ? <FieldError msg={errors.meeting} />
                : <p className="mt-1 text-[11px] text-muted-foreground">Teams, Meet, Zoom ou outro. Os técnicos abrem o link pela Área do Implantador.</p>}
            </div>
          )}
          <div><Label className="text-xs">Observações</Label><Textarea className="mt-1.5" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informações úteis para o Aprovador e os técnicos..." /></div>
          <div className="flex items-start gap-2.5 rounded-lg bg-sky-500/10 px-3.5 py-3 text-xs text-sky-800 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>A solicitação fica <b>pendente</b> até o Aprovador avaliar. Os <b>técnicos são definidos pelo Aprovador</b> na aprovação, e a visita só entra no calendário depois de aprovada.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !!duplicate} title={duplicate ? DUPLICATE_PURPOSE_MSG : undefined}>{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Enviar solicitação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reprovar (Aprovador) ──────────────────────────────────────────────── */
const REJECT_SUGGESTIONS = ["Técnicos indisponíveis no período", "Cliente sem liberação de acesso", "Pré-requisitos do projeto pendentes"];
export function RejectDialog({ request, open, onOpenChange, onDone }: {
  request: ImplantationRequest | null; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!request) return null;
  const ok = reason.trim().length >= 5;
  const submit = async () => {
    setSaving(true);
    try {
      await rejectRequest(request.id, reason.trim());
      toast.warning(`Solicitação reprovada. ${request.requester_name ?? "O solicitante"} verá a justificativa.`);
      onOpenChange(false); onDone();
    } catch (err) {
      toast.error("Não foi possível reprovar", { description: errorMessage(err) });
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reprovar solicitação</DialogTitle>
          <DialogDescription>{request.project?.company_name} · {request.visit_purpose}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Justificativa *</Label>
            <Textarea className="mt-1.5" rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explique o motivo para o Gerente de Projeto..." />
            <p className="mt-1 text-[11px] text-muted-foreground">Obrigatória. O GP verá esta justificativa na solicitação.</p>
            {reason && !ok && <FieldError msg="Escreva uma justificativa um pouco mais completa." />}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_SUGGESTIONS.map(s => (
              <button key={s} type="button" onClick={() => setReason(`${s}.`)} className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{s}</button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" onClick={submit} disabled={!ok || saving}>{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <X className="mr-1.5 h-4 w-4" />}Reprovar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Cancelar (GP) ─────────────────────────────────────────────────────── */
export function CancelDialog({ request, open, onOpenChange, onDone }: {
  request: ImplantationRequest | null; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  if (!request) return null;
  const submit = async () => {
    setSaving(true);
    try {
      await cancelRequest(request.id);
      toast.info("Solicitação cancelada.");
      onOpenChange(false); onDone();
    } catch (err) {
      toast.error("Não foi possível cancelar", { description: errorMessage(err) });
    } finally { setSaving(false); }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
          <AlertDialogDescription>
            A solicitação de <b>{request.project?.company_name}</b> ({request.visit_purpose}) será cancelada e sairá da fila do Aprovador. Você poderá fazer uma nova depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={e => { e.preventDefault(); submit(); }} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            <Ban className="mr-1.5 h-4 w-4" />Cancelar solicitação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─── Detalhe (painel lateral) ──────────────────────────────────────────── */
const ACTION_TEXT: Record<HistoryEntry["action"], string> = {
  criada: "Solicitada", aprovada: "Aprovada", reprovada: "Reprovada", cancelada: "Cancelada", periodo_alterado: "Período ajustado",
  atendida: "Atendimento registrado",
};

/** Aprovador: registra como a visita foi realizada ou cancela uma visita já aprovada. */
function VisitResultBox({ request, onChanged }: { request: ImplantationRequest; onChanged: () => void }) {
  const [mode, setMode] = useState<Attendance | null>(request.attendance);
  const [note, setNote] = useState(request.attendance_note ?? "");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMode(request.attendance); setNote(request.attendance_note ?? ""); setCancelling(false); setReason(""); }, [request]);
  const started = periodOf(request).start <= new Date();
  const unchanged = mode === request.attendance && note.trim() === (request.attendance_note ?? "");

  const save = async () => {
    if (!mode) return;
    setSaving(true);
    try {
      await registerAttendance(request.id, mode, note.trim());
      toast.success("Atendimento registrado", { description: ATTENDANCE_LABEL[mode] });
      onChanged();
    } catch (e) { toast.error("Não foi possível registrar", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };
  const cancel = async () => {
    setSaving(true);
    try {
      await cancelApprovedRequest(request.id, reason.trim());
      toast.success("Visita cancelada", { description: "Saiu do calendário e conta como cancelada na Área do Implantador." });
      onChanged();
    } catch (e) { toast.error("Não foi possível cancelar", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-3.5">
      <p className="mb-2 text-xs font-semibold">Resultado da visita</p>
      {started ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {([["presencial", "Presencial", MapPin], ["remoto", "Remoto", Monitor]] as const).map(([k, l, Icon]) => (
              <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${mode === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />{l}
              </button>
            ))}
          </div>
          <Textarea className="mt-2" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Observação (opcional)" />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={save} disabled={!mode || saving || unchanged}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              {request.attendance ? "Atualizar atendimento" : "Registrar atendimento"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">O atendimento pode ser registrado a partir do início da visita.</p>
      )}
      {!request.attendance && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {cancelling ? (
            <>
              <Label className="text-xs">Motivo do cancelamento *</Label>
              <Textarea className="mt-1.5" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: cliente desmarcou a visita" />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCancelling(false)} disabled={saving}>Voltar</Button>
                <Button size="sm" variant="destructive" onClick={cancel} disabled={reason.trim().length < 5 || saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}Cancelar visita
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setCancelling(true)}>
              <Ban className="mr-1.5 h-4 w-4" />Cancelar esta visita
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
export function RequestDetailSheet({ request, open, onOpenChange, mode, onApprove, onReject, onCancel, onNewRequest, onGoCalendar, onResultChanged }: {
  request: ImplantationRequest | null; open: boolean; onOpenChange: (o: boolean) => void; mode: "gp" | "ap" | "cal";
  onApprove?: () => void; onReject?: () => void; onCancel?: () => void; onNewRequest?: () => void; onGoCalendar?: () => void;
  /** Presente = quem abre pode registrar atendimento ou cancelar visita aprovada (Aprovador). */
  onResultChanged?: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  useEffect(() => {
    if (!open || !request) return;
    setHistory(null);
    fetchHistory(request.id).then(setHistory).catch(() => setHistory([]));
  }, [open, request]);
  if (!request) return null;
  const { start, end } = periodOf(request);
  const techs = techniciansOf(request);
  const histText = (h: HistoryEntry) => {
    const d = h.details as Record<string, string | string[]>;
    if (h.action === "aprovada" && Array.isArray(d.technicians)) return `Aprovada · técnicos: ${d.technicians.join(", ")}`;
    if (h.action === "periodo_alterado" && d.start) return `Período ajustado para ${formatPeriod(new Date(d.start as string), new Date(d.end as string))}`;
    if (h.action === "atendida" && d.mode) return `${ATTENDANCE_LABEL[d.mode as Attendance]}${d.note ? ` · "${d.note}"` : ""}`;
    if (h.action === "cancelada" && d.reason) return `Cancelada após aprovação · "${d.reason}"`;
    return ACTION_TEXT[h.action];
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{request.status === "aprovada" ? "Agendamento aprovado" : "Solicitação de agenda"}</p>
          <SheetTitle>{request.visit_purpose}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-2"><StatusPill status={request.status} />
              {request.visit_purpose_is_custom && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">objetivo personalizado</span>}</div>
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          {request.project && <ProjectBox project={request.project} />}
          <dl className="grid grid-cols-[120px_1fr] gap-y-2.5 text-[13px]">
            <dt className="text-muted-foreground">Período</dt><dd className="font-medium">{formatPeriod(start, end)}</dd>
            {request.status === "aprovada" && request.approved_start && (+new Date(request.approved_start) !== +new Date(request.requested_start) || +new Date(request.approved_end!) !== +new Date(request.requested_end)) && (
              <><dt className="text-muted-foreground">Pedido original</dt><dd className="text-muted-foreground">{formatPeriod(new Date(request.requested_start), new Date(request.requested_end))}</dd></>
            )}
            {request.visit_format && <><dt className="text-muted-foreground">Formato</dt><dd>{VISIT_FORMAT_LABEL[request.visit_format]}</dd></>}
            {request.visit_format === "remoto"
              ? <><dt className="text-muted-foreground">Link da reunião</dt><dd className="min-w-0"><MeetingLink url={request.meeting_url} /></dd></>
              : <><dt className="text-muted-foreground">{request.visit_format ? "Endereço" : "Local"}</dt><dd>{request.location || "—"}</dd></>}
            <dt className="text-muted-foreground">Solicitante</dt><dd>{request.requester_name ?? "—"}</dd>
            <dt className="text-muted-foreground">GP do projeto</dt><dd>{request.project?.manager?.full_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Técnicos</dt>
            <dd>{techs.length ? (
              <div className="flex flex-wrap gap-1.5">{techs.map(t => (
                <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2.5 text-xs"><TechAvatar tech={t} size="h-5 w-5 text-[8px]" />{t.full_name}</span>
              ))}</div>
            ) : <span className="text-muted-foreground">Definidos pelo Aprovador na aprovação</span>}</dd>
            {request.notes && <><dt className="text-muted-foreground">Observações</dt><dd className="whitespace-pre-line text-muted-foreground">{request.notes}</dd></>}
          </dl>
          {request.attendance && (
            <div className="rounded-lg bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-200">
              <p className="font-semibold"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{ATTENDANCE_LABEL[request.attendance]}</p>
              {request.attendance_note && <p className="mt-1">{request.attendance_note}</p>}
              {request.attended_by_name && <p className="mt-1 text-[11px] opacity-80">Registrado por {request.attended_by_name}{request.attended_at ? ` em ${fmtDT(request.attended_at)}` : ""}</p>}
            </div>
          )}
          {request.status === "cancelada" && request.cancel_reason && (
            <div className="rounded-lg bg-muted p-3.5 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground"><Ban className="mr-1 inline h-3.5 w-3.5" />Cancelada após aprovação</p>
              {request.cancel_reason}
            </div>
          )}
          {request.status === "aprovada" && onResultChanged && <VisitResultBox request={request} onChanged={onResultChanged} />}
          {request.status === "reprovada" && request.rejection_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <p className="mb-1 font-semibold"><MessageSquareWarning className="mr-1 inline h-3.5 w-3.5" />Justificativa da reprovação</p>
              {request.rejection_reason}
            </div>
          )}
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><History className="h-3.5 w-3.5" />Histórico</p>
            {history === null ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Carregando…</p> : (
              <ol className="space-y-3 border-l-2 border-border pl-4">
                {history.slice().reverse().map((h, i) => (
                  <li key={h.id} className="relative">
                    <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-background ${i === 0 ? "bg-primary" : "bg-border"}`} />
                    <p className="text-[13px]">{histText(h)}{h.actor_name ? <span className="text-muted-foreground"> por {h.actor_name}</span> : null}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDT(h.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        {(() => {
          const acts =
            request.status === "pendente" && mode === "ap" ? <>
              <Button className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500" onClick={onApprove}><Check className="mr-1.5 h-4 w-4" />Aprovar</Button>
              <Button variant="outline" className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onReject}><X className="mr-1.5 h-4 w-4" />Reprovar</Button>
            </> : request.status === "pendente" && mode === "gp" ? <Button variant="outline" className="flex-1" onClick={onCancel}><Ban className="mr-1.5 h-4 w-4" />Cancelar solicitação</Button>
            : request.status === "aprovada" && mode !== "cal" && onGoCalendar ? <Button className="flex-1" onClick={onGoCalendar}><CalendarRange className="mr-1.5 h-4 w-4" />Ver no calendário</Button>
            : request.status === "reprovada" && mode === "gp" && onNewRequest ? <Button className="flex-1" onClick={onNewRequest}><RotateCcw className="mr-1.5 h-4 w-4" />Nova solicitação para este projeto</Button>
            : null;
          return acts ? <div className="flex gap-2 border-t px-5 py-3">{acts}</div> : null;
        })()}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Técnicos (cadastro do módulo) ─────────────────────────────────────── */
/** Avatar clicável do cadastro: sem foto, abre o seletor de arquivo; com foto, menu Trocar/Remover. */
function TechPhotoButton({ tech, busy, onPick, onRemove }: { tech: Technician; busy: boolean; onPick: () => void; onRemove: () => void }) {
  const face = (
    <button type="button" disabled={busy} onClick={tech.photo_url ? undefined : onPick}
      className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait"
      aria-label={tech.photo_url ? `Trocar ou remover a foto de ${tech.full_name}` : `Enviar foto de ${tech.full_name}`}>
      <TechAvatar tech={tech} size="h-10 w-10 text-xs" />
      <span className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </span>
      {!tech.photo_url && !busy && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
          <Camera className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
  if (!tech.photo_url) return face;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{face}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={onPick}><Camera className="mr-2 h-4 w-4" />Trocar foto</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Remover foto</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TechniciansDialog({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void }) {
  const [list, setList] = useState<Technician[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [toRemove, setToRemove] = useState<{ tech: Technician; visits: number | null } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; full_name: string; email: string; area: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickFor = useRef<Technician | "novo" | null>(null);

  const load = () => fetchTechnicians(true).then(setList).catch(err => { setList([]); toast.error("Erro ao carregar técnicos", { description: errorMessage(err) }); });
  useEffect(() => { if (open) { setList(null); setEditing(null); load(); } }, [open]);
  useEffect(() => {
    if (!newPhoto) { setNewPhotoUrl(null); return; }
    const url = URL.createObjectURL(newPhoto);
    setNewPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newPhoto]);

  const firstName = (n: string) => n.trim().split(/\s+/)[0];
  const replaceInList = (t: Technician) => setList(l => l?.map(x => x.id === t.id ? t : x) ?? l);
  const pickPhoto = (target: Technician | "novo") => { pickFor.current = target; fileRef.current?.click(); };
  const onPhotoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    const target = pickFor.current;
    if (!file || !target) return;
    const problem = photoFileProblem(file);
    if (problem) { toast.error(problem); return; }
    if (target === "novo") { setNewPhoto(file); return; }
    setPhotoBusy(target.id);
    try {
      replaceInList(await uploadTechnicianPhoto(target, file));
      toast.success(`Foto de ${firstName(target.full_name)} atualizada.`);
      onChanged();
    } catch (err) { toast.error("Não foi possível enviar a foto", { description: errorMessage(err) }); }
    finally { setPhotoBusy(null); }
  };
  const clearPhoto = async (t: Technician) => {
    setPhotoBusy(t.id);
    try {
      replaceInList(await removeTechnicianPhoto(t));
      toast.success(`Foto de ${firstName(t.full_name)} removida.`);
      onChanged();
    } catch (err) { toast.error("Não foi possível remover a foto", { description: errorMessage(err) }); }
    finally { setPhotoBusy(null); }
  };

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await saveTechnician({ full_name: name.trim(), email: email.trim() || null, area: area.trim() || null });
      let photoError: string | null = null;
      if (newPhoto) {
        try { await uploadTechnicianPhoto(created, newPhoto); }
        catch (err) { photoError = errorMessage(err); }
      }
      if (photoError) toast.warning(`${name.trim()} cadastrado(a), mas a foto não foi enviada.`, { description: `${photoError} Clique no avatar na lista para tentar de novo.` });
      else toast.success(`${name.trim()} cadastrado(a).`);
      setName(""); setEmail(""); setArea(""); setNewPhoto(null); await load(); onChanged();
    } catch (err) { toast.error("Não foi possível cadastrar", { description: errorMessage(err) }); }
    finally { setSaving(false); }
  };
  const toggleActive = async (t: Technician) => {
    try { await saveTechnician({ ...t, active: !t.active }); await load(); onChanged(); }
    catch (err) { toast.error("Não foi possível atualizar", { description: errorMessage(err) }); }
  };
  const saveEdit = async () => {
    if (!editing || !editing.full_name.trim()) return;
    setSaving(true);
    try {
      await saveTechnician({ id: editing.id, full_name: editing.full_name.trim(), email: editing.email.trim().toLowerCase() || null, area: editing.area.trim() || null });
      toast.success(`${editing.full_name.trim()} atualizado(a).`);
      setEditing(null); await load(); onChanged();
    } catch (err) { toast.error("Não foi possível salvar", { description: errorMessage(err) }); }
    finally { setSaving(false); }
  };
  const askRemove = (t: Technician) => {
    setToRemove({ tech: t, visits: null });
    countTechnicianVisits(t.id)
      .then(n => setToRemove(cur => cur?.tech.id === t.id ? { tech: t, visits: n } : cur))
      .catch(err => { setToRemove(null); toast.error("Não foi possível verificar as visitas", { description: errorMessage(err) }); });
  };
  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await removeTechnician(toRemove.tech.id, toRemove.tech.photo_url);
      toast.success(`${toRemove.tech.full_name} removido(a) da agenda.`);
      setToRemove(null); await load(); onChanged();
    } catch (err) { toast.error("Não foi possível remover", { description: errorMessage(err) }); }
    finally { setRemoving(false); }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Técnicos de implantação</DialogTitle>
          <DialogDescription>Cadastro usado na aprovação e no calendário. Visível só para Super Admin nesta fase.</DialogDescription>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhotoPicked} />
        <div className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_auto]">
          <div className="relative h-10 w-10 shrink-0">
            <button type="button" onClick={() => pickPhoto("novo")} title={newPhoto ? "Trocar a foto" : "Foto (opcional)"} aria-label={newPhoto ? "Trocar a foto do novo técnico" : "Escolher foto do novo técnico (opcional)"}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {newPhotoUrl ? <img src={newPhotoUrl} alt="Foto escolhida" className="h-full w-full object-cover object-[50%_25%]" /> : <Camera className="h-4 w-4" />}
            </button>
            {newPhoto && (
              <button type="button" onClick={() => setNewPhoto(null)} aria-label="Tirar a foto escolhida" title="Tirar a foto"
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card hover:bg-destructive hover:text-destructive-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          <Input placeholder="Nome *" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
          <Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input placeholder="Área (ex.: Bilhetagem)" value={area} onChange={e => setArea(e.target.value)} />
          <Button onClick={add} disabled={!name.trim() || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
        </div>
        {list === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum técnico cadastrado ainda.</p>
        ) : (
          <ul className="divide-y rounded-lg border border-border/60">
            {list.map(t => editing?.id === t.id ? (
              <li key={t.id} className="grid gap-2 bg-muted/30 px-3 py-2.5 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                <Input aria-label="Nome" placeholder="Nome *" value={editing.full_name} onChange={e => setEditing({ ...editing, full_name: e.target.value })} />
                <Input aria-label="E-mail" placeholder="E-mail" type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }} />
                <Input aria-label="Área" placeholder="Área" value={editing.area} onChange={e => setEditing({ ...editing, area: e.target.value })} />
                <div className="flex gap-1">
                  <Button size="icon" onClick={saveEdit} disabled={!editing.full_name.trim() || saving} aria-label="Salvar" title="Salvar">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar edição" title="Cancelar"><X className="h-4 w-4" /></Button>
                </div>
                <p className="text-[11px] text-muted-foreground sm:col-span-4">O e-mail liga o técnico à conta do portal: use o mesmo e-mail com que ele entra.</p>
              </li>
            ) : (
              <li key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${t.active ? "" : "opacity-50"}`}>
                <TechPhotoButton tech={t} busy={photoBusy === t.id} onPick={() => pickPhoto(t)} onRemove={() => clearPhoto(t)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{[t.area, t.email].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{t.active ? "Ativo" : "Inativo"}</span>
                <Switch checked={t.active} onCheckedChange={() => toggleActive(t)} aria-label={`Ativar ou desativar ${t.full_name}`} />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => setEditing({ id: t.id, full_name: t.full_name, email: t.email ?? "", area: t.area ?? "" })} aria-label={`Editar ${t.full_name}`} title="Editar técnico">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => askRemove(t)} aria-label={`Remover ${t.full_name}`} title="Remover técnico">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!!list?.length && <p className="-mt-2 text-[11px] text-muted-foreground">Clique no avatar para enviar, trocar ou remover a foto. A imagem é recortada em quadrado.</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!toRemove} onOpenChange={o => { if (!o && !removing) setToRemove(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remover {toRemove?.tech.full_name}?</DialogTitle>
          <DialogDescription>O técnico deixa de aparecer no cadastro, na solicitação, na aprovação e no calendário.</DialogDescription>
        </DialogHeader>
        {toRemove?.visits === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verificando visitas…</p>
        ) : toRemove && toRemove.visits! > 0 ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            Ele está em <b>{toRemove.visits} {toRemove.visits === 1 ? "visita" : "visitas"}</b>. O nome continua no histórico dessas visitas — só sai das listas.
          </p>
        ) : (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">Ele não tem visitas registradas: o cadastro é excluído.</p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setToRemove(null)} disabled={removing}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmRemove} disabled={removing || toRemove?.visits === null}>
            {removing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
