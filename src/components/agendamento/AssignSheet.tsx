import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock3, Info, Loader2, Palmtree, Plus, UserRoundCog, Video, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomHolidays } from "@/hooks/useCustomHolidays";
import { useCityIndex } from "@/hooks/useCityIndex";
import { holidaysByDay } from "@/lib/holidays";
import {
  VISIT_FORMAT_LABEL, approveRequest, errorMessage, fmtVacation, normalizeMeetingUrl, periodOf, remotePeriodText, saveTechnician, toLocalInput, visitFormatText,
  type ImplantationRequest, type Technician,
} from "@/lib/implantationScheduling";
import {
  MONTH_LONG, candidatesFor, checksFor, fmtDM, fmtDayRange, fmtHM, fmtKm, fmtWdDM, placeLabel, placeOf, startOfDay,
  visitDays, visitKindOf, workdaysIn, VISIT_KIND, type Candidate,
} from "@/lib/agendaTecnica";
import { MeetingLink, StatusPill, TechAvatar } from "./AgendaShared";

const firstName = (t: Technician) => t.full_name.trim().split(/\s+/)[0] || t.full_name;
const joinPt = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

/**
 * Painel "Aprovar e atribuir": dados da solicitação, quem pode ir (com disponibilidade,
 * carga do mês e recomendação), verificações e as ações de recusar ou aprovar.
 */
export function AssignSheet({ request, open, onOpenChange, technicians, allRequests, initialSelected, onDone, onReject, onManageTechnicians, onTechnicianAdded }: {
  request: ImplantationRequest | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  technicians: Technician[];
  allRequests: ImplantationRequest[];
  /** Técnicos já marcados ao abrir (ex.: sugestão clicada na agenda). Sem isso, marca o recomendado. */
  initialSelected?: string[];
  onDone: () => void;
  onReject: (r: ImplantationRequest) => void;
  /** Presente = pode cadastrar/editar técnicos. */
  onManageTechnicians?: () => void;
  onTechnicianAdded?: (t: Technician) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [editPeriod, setEditPeriod] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [linkTouched, setLinkTouched] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("");
  const [savingTech, setSavingTech] = useState(false);
  const autoPicked = useRef(false);
  const { custom } = useCustomHolidays(open);
  const index = useCityIndex(open);

  useEffect(() => {
    if (!open || !request) return;
    setStart(toLocalInput(new Date(request.requested_start)));
    setEnd(toLocalInput(new Date(request.requested_end)));
    setEditPeriod(false);
    // solicitações antigas já trazem o link do GP; as novas chegam sem e o Aprovador informa
    setMeetingUrl(request.meeting_url ?? ""); setLinkTouched(false);
    setSelected(initialSelected ?? []);
    autoPicked.current = !!initialSelected?.length;
    setAdding(false); setNewName(""); setNewArea("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);

  const s = useMemo(() => new Date(start), [start]);
  const e = useMemo(() => new Date(end), [end]);
  const validDates = !isNaN(+s) && !isNaN(+e) && e > s;
  const holidays = useMemo(() => {
    const y = isNaN(+s) ? new Date().getFullYear() : s.getFullYear();
    return holidaysByDay([y - 1, y, y + 1], custom);
  }, [s, custom]);

  const candidates = useMemo<Candidate[]>(() => (request && validDates
    ? candidatesFor({ request, start: s, end: e, techs: technicians, requests: allRequests, holidays, index })
    : []), [request, validDates, s, e, technicians, allRequests, holidays, index]);

  // ao abrir, já deixa marcado o técnico recomendado (uma vez)
  useEffect(() => {
    if (!open || autoPicked.current || !candidates.length) return;
    autoPicked.current = true;
    const rec = candidates.find(c => c.recommended);
    if (rec) setSelected([rec.tech.id]);
  }, [open, candidates]);

  if (!request) return null;
  const pending = request.status === "pendente";
  const chosen = candidates.filter(c => selected.includes(c.tech.id));
  // visita remota: o link da reunião é obrigatório para aprovar
  const remote = request.visit_format === "remoto";
  const url = remote ? normalizeMeetingUrl(meetingUrl) : null;
  const turn = validDates ? remotePeriodText(request.visit_format, s, e) : null;
  const linkError = !remote || url ? null
    : meetingUrl.trim() ? "Link inválido. Cole o endereço completo da reunião (ex.: https://meet.google.com/...)." : "Informe o link da reunião para aprovar.";
  const checks = validDates ? [
    ...checksFor({ request, start: s, end: e, chosen, custom, index }),
    ...(remote ? [url ? { level: "ok" as const, text: "Link da reunião informado" } : { level: "error" as const, text: "Falta o link da reunião (obrigatório na visita remota)" }] : []),
  ] : [];
  const blocked = !pending || !validDates || chosen.length === 0 || chosen.some(c => !c.free) || (remote && !url);
  const firstDay = startOfDay(validDates ? s : new Date(request.requested_start));
  const lastDay = validDates ? startOfDay(new Date(+e - 1)) : firstDay;
  const days = Math.max(1, Math.round((+lastDay - +firstDay) / 864e5) + 1);
  const wd = workdaysIn(firstDay, lastDay, holidays).length;
  const kind = VISIT_KIND[visitKindOf(request.visit_purpose)];
  const names = chosen.map(c => firstName(c.tech));
  const client = request.project?.company_name ?? "Projeto removido";
  const toggle = (c: Candidate) => {
    // ocupado não pode ser escolhido, mas pode ser desmarcado (ex.: depois de ajustar o período)
    if (!c.free && !selected.includes(c.tech.id)) return;
    setSelected(v => v.includes(c.tech.id) ? v.filter(x => x !== c.tech.id) : [...v, c.tech.id]);
  };

  const addTechnician = async () => {
    if (!newName.trim()) return;
    setSavingTech(true);
    try {
      const t = await saveTechnician({ full_name: newName.trim(), email: null, area: newArea.trim() || null });
      onTechnicianAdded?.(t);
      setSelected(v => [...v, t.id]);
      setNewName(""); setNewArea(""); setAdding(false);
      toast.success(`${t.full_name} cadastrado(a) e selecionado(a).`);
    } catch (err) {
      toast.error("Não foi possível cadastrar o técnico", { description: errorMessage(err) });
    } finally { setSavingTech(false); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await approveRequest(request.id, s, e, selected, url);
      toast.success(`Aprovada e atribuída a ${joinPt(names)}`, { description: `${client} já está na agenda técnica.` });
      onOpenChange(false); onDone();
    } catch (err) {
      toast.error("Não foi possível aprovar", { description: errorMessage(err) });
      onDone();
    } finally { setSaving(false); }
  };

  const periodText = `${days > 1 ? `${fmtWdDM(firstDay)} a ${fmtWdDM(lastDay)}` : fmtWdDM(firstDay)} (${wd ? `${wd} dia${wd > 1 ? "s" : ""} út${wd > 1 ? "eis" : "il"}` : "sem dia útil"})`;
  const range = fmtDayRange(firstDay, lastDay);
  const noEmail = chosen.filter(c => !c.tech.email);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="space-y-1.5 border-b px-6 pb-5 pt-6 text-left">
          {pending
            ? <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200"><Clock3 className="h-3.5 w-3.5" />Aguardando aprovação</span>
            : <StatusPill status={request.status} />}
          <SheetTitle className="text-2xl leading-tight">{client}</SheetTitle>
          <SheetDescription>
            {request.visit_purpose}, {days > 1 ? `de ${fmtWdDM(firstDay)} a ${fmtWdDM(lastDay)}` : `em ${fmtWdDM(firstDay)}`}, a partir das {validDates ? fmtHM(s) : "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {!pending && (
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3.5 py-3 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />Esta solicitação já foi avaliada.</p>
          )}
          {pending && remote && (
            <section className={`rounded-xl border-2 p-4 transition-colors ${url ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-sky-500/50 bg-sky-500/10"}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${url ? "bg-emerald-600" : "bg-sky-600"}`}>
                  {url ? <CheckCircle2 className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <label htmlFor="assign-meeting" className="block text-[15px] font-semibold">Link da reunião *</label>
                  <p className="text-[13px] text-muted-foreground">
                    Visita remota{turn ? ` · ${turn}` : ""}. Obrigatório para aprovar: os técnicos entram por ele na Área do Implantador.
                  </p>
                </div>
              </div>
              <Input id="assign-meeting" className="mt-3 bg-background" type="url" inputMode="url" maxLength={2000} value={meetingUrl}
                onChange={ev => setMeetingUrl(ev.target.value)} onBlur={() => setLinkTouched(true)}
                placeholder="https://meet.google.com/..." aria-invalid={linkTouched && !!linkError} />
              {linkTouched && linkError
                ? <p className="mt-1.5 text-[12px] font-medium text-destructive">{linkError}</p>
                : <p className="mt-1.5 text-[12px] text-muted-foreground">Teams, Meet, Zoom ou outro.</p>}
            </section>
          )}
          <section>
            <h3 className="mb-2.5 text-[15px] font-semibold">Solicitação</h3>
            <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-2.5 text-sm">
              <dt className="text-muted-foreground">Período</dt>
              <dd>
                {periodText}
                {pending && <button type="button" onClick={() => setEditPeriod(v => !v)} className="ml-2 text-xs font-semibold text-primary underline-offset-2 hover:underline">{editPeriod ? "Fechar" : "Ajustar"}</button>}
              </dd>
              {editPeriod && (
                <dd className="col-span-2 grid gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 sm:grid-cols-2">
                  <div><Label className="text-xs">Início aprovado</Label><Input className="mt-1.5 h-9" type="datetime-local" value={start} onChange={ev => setStart(ev.target.value)} /></div>
                  <div><Label className="text-xs">Fim aprovado</Label><Input className="mt-1.5 h-9" type="datetime-local" value={end} onChange={ev => setEnd(ev.target.value)} /></div>
                  <p className="text-[11px] text-muted-foreground sm:col-span-2">Pedido: {fmtDM(new Date(request.requested_start))} {fmtHM(new Date(request.requested_start))} a {fmtDM(new Date(request.requested_end))} {fmtHM(new Date(request.requested_end))}. A mudança fica no histórico.</p>
                  {!validDates && <p className="text-[11px] font-medium text-destructive sm:col-span-2">O fim deve ser depois do início.</p>}
                </dd>
              )}
              <dt className="text-muted-foreground">Horário</dt>
              <dd>{validDates ? `${fmtHM(s)}${days === 1 ? ` às ${fmtHM(e)}` : `, término ${fmtDM(lastDay)} às ${fmtHM(e)}`}` : "—"}</dd>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${kind.chip}`}>{kind.label}</span>{kind.label !== request.visit_purpose && <span className="ml-2 text-muted-foreground">{request.visit_purpose}</span>}</dd>
              {request.visit_format && <><dt className="text-muted-foreground">Formato</dt><dd>{validDates ? visitFormatText(request.visit_format, s, e) : VISIT_FORMAT_LABEL[request.visit_format]}</dd></>}
              {request.visit_format === "remoto" ? (
                <><dt className="text-muted-foreground">Reunião</dt><dd className="min-w-0">{pending ? <span className="text-muted-foreground">Link informado por você, no destaque acima</span> : <MeetingLink url={request.meeting_url} />}</dd></>
              ) : (
                <>
                  <dt className="text-muted-foreground">{request.visit_format ? "Endereço" : "Local"}</dt>
                  <dd>{request.location?.trim() || <span className="font-medium text-amber-700 dark:text-amber-300">Não informado <span className="font-normal text-muted-foreground">· projeto em {placeLabel(placeOf(request))}</span></span>}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Solicitante</dt>
              <dd>{request.requester_name ?? "—"}</dd>
              <dt className="text-muted-foreground">GP do projeto</dt>
              <dd>{request.project?.manager?.full_name ?? "—"}</dd>
              {request.project?.project_code && <><dt className="text-muted-foreground">Projeto</dt><dd className="font-mono text-xs leading-5">{request.project.project_code}</dd></>}
              {request.notes && <><dt className="text-muted-foreground">Observações</dt><dd className="whitespace-pre-line text-muted-foreground">{request.notes}</dd></>}
            </dl>
          </section>

          {pending && (
            <section>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-[15px] font-semibold">Quem pode ir</h3>
                {onManageTechnicians && (
                  <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs text-muted-foreground" onClick={onManageTechnicians} title="Editar ou desativar técnicos" aria-label="Editar ou desativar técnicos">
                    <UserRoundCog className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="mb-3 text-[13px] text-muted-foreground">Disponibilidade em {range}. A recomendação considera quem está livre, as férias e a carga do mês.</p>
              {technicians.length === 0 && (
                <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                  Nenhum técnico cadastrado{onManageTechnicians ? ". Cadastre o primeiro abaixo: ele já entra selecionado." : ". Peça a quem gerencia os técnicos da agenda para cadastrá-los."}
                </p>
              )}
              <div className="space-y-2.5">
                {candidates.map(c => {
                  const on = selected.includes(c.tech.id);
                  const conflict = c.conflicts[0];
                  return (
                    <button key={c.tech.id} type="button" role="checkbox" aria-checked={on} aria-disabled={!c.free} onClick={() => toggle(c)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${on ? "border-primary bg-primary/[0.06] ring-1 ring-primary" : c.free ? "border-border hover:bg-muted/50" : "cursor-not-allowed border-border/60 bg-muted/50"}`}>
                      <span aria-hidden className={`mt-2.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-primary" : c.free ? "border-muted-foreground/50" : "border-muted-foreground/25"}`}>
                        {on && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <TechAvatar tech={c.tech} size="h-9 w-9 text-[11px]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold">{c.tech.full_name}</span>
                          {c.free
                            ? <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{days > 1 ? `Livre nos ${days} dias` : "Livre no dia"}</span>
                            : c.vacation
                              ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300"><Palmtree className="h-3.5 w-3.5" />De férias</span>
                              : <span className="text-xs font-semibold text-red-600 dark:text-red-400">Ocupado</span>}
                          {c.recommended && <span className="rounded-full bg-primary/10 px-2 py-px text-[11px] font-semibold text-primary">Recomendado</span>}
                        </span>
                        {c.free ? (
                          <>
                            <span className="mt-0.5 block text-[13px] text-muted-foreground">{c.monthBusy} de {c.monthWorkdays} dias úteis em campo em {MONTH_LONG[firstDay.getMonth()]}</span>
                            <span className="block text-[13px] text-muted-foreground">
                              {c.last ? `Última visita em ${placeLabel(placeOf(c.last))}, até ${fmtDM(visitDays(c.last).last)}` : "Nenhuma visita anterior"}
                              {c.kmFromLast ? ` · ${fmtKm(c.kmFromLast)} até o local` : ""}
                            </span>
                            {c.sameDay.map(r => {
                              const p = periodOf(r);
                              return (
                                <span key={r.id} className="mt-1 flex items-start gap-1.5 text-[13px] text-sky-800 dark:text-sky-200">
                                  <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>Nos mesmos dias: {r.project?.company_name ?? "Projeto removido"}, {(remotePeriodText(r.visit_format, p.start, p.end) ?? `${fmtHM(p.start)} às ${fmtHM(p.end)}`).toLowerCase()}</span>
                                </span>
                              );
                            })}
                          </>
                        ) : c.vacation ? (
                          <span className="mt-0.5 block text-[13px] text-muted-foreground">
                            Férias de {fmtVacation(c.vacation)}{c.vacation.note ? ` · ${c.vacation.note}` : ""}
                          </span>
                        ) : conflict && (
                          <>
                            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{conflict.project?.company_name}, em {placeLabel(placeOf(conflict))}</span>
                            <span className="block text-[13px] text-muted-foreground">Em visita até {fmtDM(visitDays(conflict).last)}</span>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {onManageTechnicians && (adding || technicians.length === 0 ? (
                <div className="mt-2.5 rounded-xl border border-dashed border-primary/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
                    <Input autoFocus value={newName} onChange={ev => setNewName(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") addTechnician(); }} placeholder="Nome do técnico *" className="h-9" />
                    <Input value={newArea} onChange={ev => setNewArea(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") addTechnician(); }} placeholder="Área (ex.: Bilhetagem)" className="h-9" />
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    {technicians.length > 0 && <Button variant="ghost" size="sm" className="h-8" onClick={() => setAdding(false)}>Cancelar</Button>}
                    <Button size="sm" className="h-8" onClick={addTechnician} disabled={!newName.trim() || savingTech}>
                      {savingTech ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}Cadastrar e selecionar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="mt-1.5 h-8 px-2 text-xs text-primary" onClick={() => setAdding(true)}><Plus className="mr-1 h-3.5 w-3.5" />Novo técnico</Button>
              ))}
            </section>
          )}

          {pending && validDates && (
            <section>
              <h3 className="mb-2.5 text-[15px] font-semibold">Verificações{names.length ? ` para ${joinPt(names)}` : ""}</h3>
              {chosen.length === 0 && <p className="mb-2 text-[13px] text-muted-foreground">Escolha pelo menos 1 técnico para aprovar.</p>}
              <ul className="space-y-2">
                {checks.map((c, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${c.level === "ok" ? "" : c.level === "warn" ? "text-amber-800 dark:text-amber-200" : "text-destructive"}`}>
                    {c.level === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      : c.level === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
              {chosen.length > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-sky-500/10 px-3.5 py-3 text-xs text-sky-800 dark:text-sky-200">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  {noEmail.length === 0
                    ? `${joinPt(names)} ${names.length > 1 ? "verão" : "verá"} a visita na Área do Implantador assim que você aprovar.`
                    : `${joinPt(noEmail.map(c => firstName(c.tech)))} ainda não ${noEmail.length > 1 ? "têm" : "tem"} e-mail no cadastro de técnicos: com o e-mail, a visita aparece na Área do Implantador dele no celular.`}
                </p>
              )}
            </section>
          )}
        </div>

        {pending && (
          <div className="flex items-center gap-2 border-t px-6 py-4">
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onReject(request)}>Recusar</Button>
            <Button className="ml-auto" onClick={submit} disabled={blocked || saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {chosen.length ? `Aprovar e atribuir a ${joinPt(names)}` : "Aprovar e atribuir"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
