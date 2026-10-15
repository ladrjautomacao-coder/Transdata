import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, CalendarDays, CalendarOff, CalendarX, ChevronLeft, ChevronRight, ChevronRight as Chevron, Clock, Inbox, List, MapPin, RefreshCw,
  Search, SearchX, ShieldCheck, UsersRound, WifiOff, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  colorFor, errorMessage, fetchRequests, fetchTechnicians, formatPeriod, initials, periodOf, techniciansOf,
  type ImplantationRequest, type Technician,
} from "@/lib/implantationScheduling";
import { EmptyBlock, TechAvatar } from "@/components/agendamento/AgendaShared";
import { formatLocation } from "@/lib/location";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";
import { RequestDetailSheet } from "@/components/agendamento/AgendaDialogs";
import { HolidayTooltip, HolidaysDialog } from "@/components/agendamento/HolidaysDialog";
import { useCustomHolidays } from "@/hooks/useCustomHolidays";
import { HOLIDAY_SCOPE_LABEL, dateKey, holidaysByDay, type Holiday } from "@/lib/holidays";

type View = "tecnico" | "mes" | "lista";
const DAY = 864e5;
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const p2 = (n: number) => String(n).padStart(2, "0");
const fD = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
const fDT = (d: Date) => `${fD(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
const VIEW_KEY = "transdata:implantacao-calendario-view";
/** Fundo listrado dos dias de feriado. */
const HOLIDAY_BG = { backgroundImage: "repeating-linear-gradient(135deg, rgb(225 29 72 / 0.10) 0 6px, rgb(225 29 72 / 0.03) 6px 12px)" };
const holidayTitle = (hs: Holiday[]) => hs.map(h => `${HOLIDAY_SCOPE_LABEL[h.scope]} · ${h.name}${h.optional ? " (ponto facultativo)" : ""}${h.scope === "municipal" ? ` (${h.city}/${h.state})` : h.scope === "estadual" ? ` (${h.state})` : ""}`).join("\n");
/** Destaque da visita aberta via "Ver no calendário". */
const HIGHLIGHT = "z-10 ring-4 ring-amber-400 ring-offset-2 ring-offset-background animate-pulse";

export default function CalendarioImplantacao() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canApprove = can("agenda_solicitacao", "approve");
  const [requests, setRequests] = useState<ImplantationRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as View) || "tecnico"; } catch { return "tecnico"; }
  });
  // ?data=AAAA-MM-DD&destaque=<id>: abre já na data da visita, com ela destacada
  const [params, setParams] = useSearchParams();
  const linkDate = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get("data") ?? "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  })();
  const [anchor, setAnchor] = useState(() => {
    const t = linkDate ?? new Date();
    return view === "mes" ? new Date(t.getFullYear(), t.getMonth(), 1) : mondayOf(t);
  });
  const [highlightId, setHighlightId] = useState<string | null>(() => params.get("destaque"));
  const [techFilter, setTechFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);
  // Feriados: nacionais calculados + cadastrados (Técnicos da agenda → Editar cadastra)
  const canManageHolidays = can("agenda_tecnicos", "edit");
  const { custom: customHolidays, reload: reloadHolidays } = useCustomHolidays();
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const holidayMap = useMemo(() => {
    const y = anchor.getFullYear();
    return holidaysByDay([y - 1, y, y + 1], customHolidays);
  }, [anchor, customHolidays]);
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const isMobile = useIsMobile();

  // Rola até a visita destacada, tira o destaque depois de alguns segundos e limpa a URL
  useEffect(() => {
    if (loading || !highlightId) return;
    const el = document.querySelector(`[data-req="${highlightId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const t = setTimeout(() => setHighlightId(null), 6000);
    setParams({}, { replace: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, highlightId, view]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [reqs, techs] = await Promise.all([fetchRequests(), fetchTechnicians()]);
      setRequests(reqs); setTechnicians(techs);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignora */ }
    const today = new Date();
    setAnchor(v === "mes" ? new Date(today.getFullYear(), today.getMonth(), 1) : mondayOf(today));
  };
  const nav = (n: number) => setAnchor(a => view === "mes" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : addDays(a, 14 * n));
  const goToday = () => { const t = new Date(); setAnchor(view === "mes" ? new Date(t.getFullYear(), t.getMonth(), 1) : mondayOf(t)); };

  const approved = useMemo(() => requests.filter(r => r.status === "aprovada"), [requests]);
  const pendingCount = requests.filter(r => r.status === "pendente").length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approved.filter(r =>
      (!q || `${r.project?.company_name ?? ""} ${r.project?.project_code ?? ""} ${r.project?.manager?.full_name ?? ""} ${r.requester_name ?? ""}`.toLowerCase().includes(q)) &&
      (!techFilter || techniciansOf(r).some(t => t.id === techFilter)));
  }, [approved, search, techFilter]);

  // técnicos exibidos: ativos + quem estiver alocado (mesmo se inativado depois)
  const rowTechs = useMemo(() => {
    const map = new Map<string, Technician>(technicians.map(t => [t.id, t]));
    approved.forEach(r => techniciansOf(r).forEach(t => { if (!map.has(t.id)) map.set(t.id, t); }));
    return [...map.values()].filter(t => !techFilter || t.id === techFilter).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [technicians, approved, techFilter]);

  const spanLabel = view === "mes" ? `${MONTHS[anchor.getMonth()]} de ${anchor.getFullYear()}` : `${fD(anchor)} – ${fD(addDays(anchor, 13))}`;

  const header = (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Implantação
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
        <p className="text-sm text-muted-foreground">Agendamentos aprovados — onde cada técnico estará, e de quando até quando.</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1 shadow-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav(-1)} aria-label="Período anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={goToday}>Hoje</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav(1)} aria-label="Próximo período"><ChevronRight className="h-4 w-4" /></Button>
          <span className="px-2 text-sm font-semibold">{spanLabel}</span>
        </div>
        <div className="flex rounded-xl border border-border/60 bg-card p-1 shadow-sm">
          {([["tecnico", "Por técnico", UsersRound], ["mes", "Mês", CalendarDays], ["lista", "Lista", List]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${view === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{l}
            </button>
          ))}
        </div>
        <Button variant="outline" className="h-10" onClick={() => setHolidaysOpen(true)}><CalendarOff className="mr-1.5 h-4 w-4" />Feriados</Button>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => { setLoading(true); load(); }} aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  if (loading) return <div className="flex flex-col gap-5">{header}<Skeleton className="h-10 w-full max-w-xl rounded-lg" /><Skeleton className="h-[420px] rounded-xl" /></div>;
  if (error) return (
    <div className="flex flex-col gap-5">{header}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5">
        <EmptyBlock icon={WifiOff} title="Não foi possível carregar o calendário" text={error}
          action={<Button onClick={() => { setLoading(true); load(); }}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button>} />
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={techFilter || "all"} onValueChange={v => setTechFilter(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os técnicos</SelectItem>
          {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cliente, código ou GP..." className="h-9 w-56 pl-8 text-xs" />
      </div>
      {(techFilter || search) && <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => { setTechFilter(""); setSearch(""); }}><X className="mr-1 h-3.5 w-3.5" />Limpar</Button>}
      <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>Somente <b className="text-foreground">aprovados</b>.{pendingCount > 0 && <> {pendingCount} pendente(s) não aparecem{canApprove && <> — <button type="button" className="font-semibold text-primary hover:underline" onClick={() => navigate("/implantacao/aprovacao")}>avaliar</button></>}</>}</span>
      </span>
    </div>
  );

  let body;
  if (approved.length === 0) {
    body = (
      <div className="rounded-xl border border-border/60 bg-card">
        <EmptyBlock icon={CalendarX} title="Nenhum agendamento aprovado" text="Quando o Aprovador aprovar uma solicitação, ela aparece aqui na linha do tempo do técnico."
          action={pendingCount > 0 && canApprove ? <Button onClick={() => navigate("/implantacao/aprovacao")}><Inbox className="mr-1.5 h-4 w-4" />Ver solicitações pendentes</Button> : undefined} />
      </div>
    );
  } else if (view === "tecnico") {
    body = <Timeline start={anchor} techs={rowTechs} list={filtered} onOpen={setDetail} highlightId={highlightId} holidays={holidayMap} />;
  } else if (view === "mes") {
    // Dia do painel: o clicado (se for deste mês), senão hoje (se for deste mês), senão o dia 1
    const now = new Date();
    const selectedDay = pickedDay && sameMonth(pickedDay, anchor) ? pickedDay : sameMonth(now, anchor) ? startOfDay(now) : anchor;
    body = (
      <div className="flex flex-col gap-4">
        <MonthGrid month={anchor} list={filtered} onOpen={setDetail} highlightId={highlightId} selected={selectedDay} holidays={holidayMap}
          onSelect={d => { setPickedDay(d); if (!isMobile && filtered.some(r => coversDay(r, d))) setDayOpen(true); }} />
        {isMobile && <DayVisits list={filtered} selected={selectedDay} holidays={holidayMap} onOpen={setDetail} />}
        <Dialog open={dayOpen && !isMobile} onOpenChange={setDayOpen}>
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md [&>button]:top-3.5">
            <DialogTitle className="sr-only">Visitas de {dayTitle(selectedDay)}</DialogTitle>
            <DayVisits inDialog list={filtered} selected={selectedDay} holidays={holidayMap} onOpen={r => { setDayOpen(false); setDetail(r); }} />
          </DialogContent>
        </Dialog>
      </div>
    );
  } else {
    body = <ListView list={filtered} onOpen={setDetail} highlightId={highlightId} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {toolbar}
      {body}
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode="cal"
        onResultChanged={canApprove ? () => { setDetail(null); load(); } : undefined} />
      <HolidaysDialog open={holidaysOpen} onOpenChange={setHolidaysOpen} custom={customHolidays} canEdit={canManageHolidays} onChanged={reloadHolidays} />
    </div>
  );
}

/* ─── Linha do tempo por técnico (14 dias) ─── */
function Timeline({ start, techs, list, onOpen, highlightId, holidays }: { start: Date; techs: Technician[]; list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void; highlightId: string | null; holidays: Map<string, Holiday[]> }) {
  // No celular a coluna de técnicos encolhe para caberem ~3 dias na tela
  const isMobile = useIsMobile();
  const N = 14, COL = 76, NAME = isMobile ? 128 : 220;
  const s0 = mondayOf(start), sEnd = addDays(s0, N);
  const days = Array.from({ length: N }, (_, i) => addDays(s0, i));
  const today = startOfDay(new Date()).getTime();
  // Faixa sobre os dias: "Semana atual", "Próxima semana", "Semana passada" ou "Semana de"
  const thisWeek = +mondayOf(new Date());
  const weekLabel = (w0: Date) => {
    const diff = Math.round((+w0 - thisWeek) / (7 * DAY));
    return diff === 0 ? "Semana atual" : diff === 1 ? "Próxima semana" : diff === -1 ? "Semana passada" : "Semana de";
  };
  const weeks = [s0, addDays(s0, 7)];
  if (techs.length === 0) return <div className="rounded-xl border border-border/60 bg-card"><EmptyBlock icon={UsersRound} title="Nenhum técnico" text="Cadastre técnicos em Solicitação de agenda › Aprovador › Técnicos." /></div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <div style={{ minWidth: NAME + N * COL }}>
        <div className="flex border-b bg-muted/30">
          <div className="shrink-0" style={{ width: NAME }} />
          {weeks.map((w0, i) => {
            const current = +w0 === thisWeek;
            return (
              <div key={+w0} style={{ width: 7 * COL }}
                className={`flex shrink-0 items-center gap-2 px-3 py-2 ${i ? "border-l-2 border-border" : "border-l"} ${current ? "bg-primary/10 text-primary shadow-[inset_0_3px_0_hsl(var(--primary))]" : "text-foreground/80 shadow-[inset_0_3px_0_hsl(var(--border))]"}`}>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{weekLabel(w0)}</span>
                <span className="text-xs opacity-80">{fD(w0)} a {fD(addDays(w0, 6))}</span>
                {current && <span className="ml-auto hidden rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground sm:inline">hoje · {WD[new Date().getDay()].toLowerCase()} {new Date().getDate()}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
          <div className="shrink-0 px-2.5 py-2.5 sm:px-4" style={{ width: NAME }}>Técnico</div>
          {days.map((d, i) => {
            const isT = d.getTime() === today, we = d.getDay() === 0 || d.getDay() === 6;
            const hol = holidays.get(dateKey(d));
            const cell = (
              <div key={+d}
                className={`shrink-0 ${i === 7 ? "border-l-2" : "border-l"} py-1.5 text-center ${hol ? "cursor-help border-b-2 border-b-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300" : we ? "opacity-60" : ""} ${isT ? "text-primary" : ""}`} style={{ width: COL }}>
                {WD[d.getDay()]}
                <div className={`text-base font-bold ${isT ? "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground" : hol ? "" : "text-foreground"}`}>{d.getDate()}</div>
                {hol && <span className="mx-auto mt-0.5 block w-fit rounded-full bg-rose-600 px-1.5 text-[8.5px] font-bold uppercase tracking-wide text-white">feriado</span>}
              </div>
            );
            return hol ? <HolidayTooltip key={+d} holidays={hol}>{cell}</HolidayTooltip> : cell;
          })}
        </div>
        {techs.map(t => {
          const mine = list.filter(r => techniciansOf(r).some(x => x.id === t.id) && periodOf(r).start < sEnd && s0 < periodOf(r).end);
          const busy = mine.reduce((acc, r) => {
            const a = Math.max(+startOfDay(periodOf(r).start), +s0), b = Math.min(+startOfDay(periodOf(r).end), +addDays(s0, N - 1));
            return acc + Math.round((b - a) / DAY) + 1;
          }, 0);
          return (
            <div key={t.id} className="relative flex border-b last:border-0" style={{ height: 78 }}>
              <div className="flex shrink-0 items-center gap-2 px-2.5 sm:gap-3 sm:px-4" style={{ width: NAME }} title={t.full_name}>
                <TechAvatar tech={t} size="h-9 w-9 text-[11px]" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold leading-tight sm:truncate sm:text-sm">{t.full_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">{t.area && !isMobile ? `${t.area} · ` : ""}{busy} dia{busy !== 1 ? "s" : ""}{isMobile ? "" : ` alocado${busy !== 1 ? "s" : ""}`}</p>
                  <div className="mt-1 h-1 w-16 overflow-hidden sm:w-28 rounded-full bg-muted"><div className={`h-full rounded-full ${busy > 7 ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (busy / 10) * 100)}%` }} /></div>
                </div>
              </div>
              {days.map((d, i) => (
                <div key={+d} style={holidays.has(dateKey(d)) ? { ...HOLIDAY_BG, width: COL } : { width: COL }} title={holidays.has(dateKey(d)) ? holidayTitle(holidays.get(dateKey(d))!) : undefined} className={`shrink-0 ${i === 7 ? "border-l-2" : "border-l"} ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/40" : ""} ${d.getTime() === today ? "bg-primary/[0.06]" : ""}`} />
              ))}
              {mine.map(r => {
                const { start: rs, end: re } = periodOf(r);
                const a = Math.max(0, Math.round((+startOfDay(rs) - +s0) / DAY));
                const b = Math.min(N - 1, Math.round((+startOfDay(re) - +s0) / DAY));
                const c = colorFor(r.project_id);
                return (
                  <button key={r.id} type="button" data-req={r.id} onClick={() => onOpen(r)} title={`${r.project?.company_name} · ${formatPeriod(rs, re)}`}
                    className={`absolute top-2.5 flex h-[58px] flex-col justify-center overflow-hidden rounded-xl px-3 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${r.id === highlightId ? HIGHLIGHT : ""}`}
                    style={{ left: NAME + a * COL + 4, width: (b - a + 1) * COL - 8, background: `linear-gradient(135deg, ${c}, ${c}cc)` }}>
                    <p className="truncate text-xs font-semibold">{r.project?.company_name}</p>
                    <p className="truncate text-[10px] opacity-90">{fDT(rs)} → {fDT(re)}</p>
                    <p className="truncate text-[10px] opacity-75">{r.visit_purpose}</p>
                  </button>
                );
              })}
              {mine.length === 0 && <p className="pointer-events-none absolute inset-y-0 flex items-center text-[11px] italic text-muted-foreground" style={{ left: NAME + 14 }}>{isMobile ? "Livre" : "Disponível no período"}</p>}
            </div>
          );
        })}
      </div>
      <div className="sticky left-0 flex items-center gap-1.5 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="h-2.5 w-[18px] rounded-sm border-b-2 border-rose-500" style={HOLIDAY_BG} />Feriado — passe o mouse no dia para saber qual é
      </div>
    </div>
  );
}

/* ─── Mês ─── */
const MAX_LANES = 3;
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
/** Último dia ocupado (fim exatamente à meia-noite não ocupa o dia seguinte). */
const lastDayOf = (r: ImplantationRequest) => startOfDay(new Date(+periodOf(r).end - 1));
const coversDay = (r: ImplantationRequest, d: Date) => periodOf(r).start < addDays(d, 1) && d < periodOf(r).end;
const dayTitle = (d: Date) => `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;

/** Grade do mês (também usada na Área do Implantador, só com as visitas do técnico). */
export function MonthGrid({ month, list, onOpen, highlightId, selected, onSelect, holidays }: {
  month: Date; list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void; highlightId: string | null;
  selected: Date; onSelect: (d: Date) => void; holidays: Map<string, Holiday[]>;
}) {
  const isMobile = useIsMobile();
  const m0 = new Date(month.getFullYear(), month.getMonth(), 1);
  const first = mondayOf(m0);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i)));
  const today = startOfDay(new Date()).getTime();
  const sel = startOfDay(selected).getTime();

  const dayCell = (d: Date, i: number, extra: number, compact: boolean) => {
    const inM = d.getMonth() === m0.getMonth();
    const isToday = d.getTime() === today, isSel = d.getTime() === sel;
    const count = list.filter(r => coversDay(r, d)).length;
    const hol = holidays.get(dateKey(d));
    return (
      <div
        key={+d}
        style={hol ? { ...HOLIDAY_BG, boxShadow: "inset 3px 0 0 rgb(225 29 72)" } : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${dayTitle(d)}${hol ? ` · feriado: ${hol.map(h => h.name).join(", ")}` : ""}${count ? ` · ${count} visita${count > 1 ? "s" : ""}` : ""}`}
        aria-pressed={isSel}
        onClick={() => onSelect(d)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(d); } }}
        className={`relative cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${i ? "border-l border-border/60" : ""} ${isSel ? "bg-primary/[0.07] ring-2 ring-inset ring-primary/55" : i >= 5 ? "bg-muted/30 hover:bg-muted/50" : "hover:bg-muted/40"}`}
      >
        <div className={`flex items-center ${compact ? "justify-center pt-1.5" : "justify-between px-2.5 pt-2"}`}>
          <span className={`text-xs ${isToday ? "flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 font-bold text-primary-foreground" : hol ? "font-bold text-rose-600 dark:text-rose-300" : inM ? "font-semibold text-foreground" : "text-muted-foreground/60"}`}>{d.getDate()}</span>
          {!compact && hol && (
            <HolidayTooltip holidays={hol}>
              <span className="ml-1.5 mr-auto flex min-w-0 cursor-help items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                <span className="shrink-0 rounded-full bg-rose-600 px-1.5 text-[9px] uppercase tracking-wide text-white">feriado</span>
                <span className="truncate underline decoration-dotted underline-offset-2">{hol[0].name}{hol.length > 1 ? ` +${hol.length - 1}` : ""}</span>
              </span>
            </HolidayTooltip>
          )}
          {!compact && (isToday
            ? <span className="text-[10px] font-semibold text-primary">Hoje</span>
            : count > 1 && <span className="text-[10px] text-muted-foreground">{count} visitas</span>)}
        </div>
        {compact && count > 0 && (
          <div className="mt-1 flex justify-center gap-0.5">
            {list.filter(r => coversDay(r, d)).slice(0, 3).map(r => <span key={r.id} className="h-1.5 w-1.5 rounded-full" style={{ background: colorFor(r.project_id) }} />)}
          </div>
        )}
        {!compact && extra > 0 && <span className="absolute bottom-1.5 left-2.5 text-[10px] font-medium text-muted-foreground">+{extra} mais</span>}
      </div>
    );
  };

  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="grid grid-cols-7 bg-muted/50">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((x, i) => (
          <div key={x} className={`py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${isMobile ? "text-center" : "px-3"} ${i >= 5 ? "opacity-70" : ""}`}>{isMobile ? x[0] : x}</div>
        ))}
      </div>
      {weeks.map(wk => {
        const w0 = wk[0], wEnd = addDays(w0, 7);
        if (isMobile) {
          return <div key={+w0} className="grid h-14 grid-cols-7 border-t border-border/60">{wk.map((d, i) => dayCell(d, i, 0, true))}</div>;
        }
        // Faixas contínuas: cada visita ocupa uma "pista" na semana, sem se sobrepor a outra
        const inWeek = list
          .filter(r => periodOf(r).start < wEnd && periodOf(r).end > w0)
          .sort((a, b) => +periodOf(a).start - +periodOf(b).start || +periodOf(b).end - +periodOf(a).end);
        const laneEnds: number[] = [];
        const placed: { r: ImplantationRequest; a: number; b: number; lane: number }[] = [];
        const hiddenPerDay = Array(7).fill(0);
        inWeek.forEach(r => {
          const a = Math.max(0, Math.round((+startOfDay(periodOf(r).start) - +w0) / DAY));
          const b = Math.min(6, Math.round((+lastDayOf(r) - +w0) / DAY));
          let lane = 0;
          while (laneEnds[lane] !== undefined && laneEnds[lane] >= a) lane++;
          if (lane >= MAX_LANES) { for (let k = a; k <= b; k++) hiddenPerDay[k]++; return; }
          laneEnds[lane] = b;
          placed.push({ r, a, b, lane });
        });
        const height = Math.max(112, 40 + laneEnds.length * 26 + 22);
        return (
          <div key={+w0} className="relative grid grid-cols-7 border-t border-border/60" style={{ height }}>
            {wk.map((d, i) => dayCell(d, i, hiddenPerDay[i], false))}
            {placed.map(({ r, a, b, lane }) => {
              const { start } = periodOf(r);
              const contL = start < w0, contR = periodOf(r).end > wEnd && lastDayOf(r) >= wEnd;
              const c = colorFor(r.project_id);
              const techs = techniciansOf(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  data-req={r.id}
                  onClick={() => onOpen(r)}
                  title={`${r.project?.company_name} · ${r.visit_purpose} · ${formatPeriod(start, periodOf(r).end)}${techs.length ? ` · ${techs.map(t => t.full_name).join(", ")}` : ""}`}
                  className={`absolute z-10 flex h-[22px] items-center gap-1.5 overflow-hidden pr-1.5 text-left text-[11px] text-foreground transition hover:brightness-110 hover:shadow-md ${contL ? "rounded-l-none pl-1.5" : "rounded-l-md border-l-[3px] pl-2"} ${contR ? "rounded-r-none" : "rounded-r-md"} ${r.id === highlightId ? HIGHLIGHT : ""}`}
                  style={{
                    top: 34 + lane * 26,
                    left: `calc(${(a / 7) * 100}% + ${contL ? 0 : 6}px)`,
                    width: `calc(${((b - a + 1) / 7) * 100}% - ${(contL ? 0 : 6) + (contR ? 0 : 6)}px)`,
                    background: `${c}2e`,
                    borderLeftColor: c,
                  }}
                >
                  {contL && <span className="font-bold" style={{ color: c }}>‹</span>}
                  {!contL && <span className="shrink-0 font-semibold" style={{ color: c }}>{p2(start.getHours())}h</span>}
                  <span className="truncate font-semibold">{r.project?.company_name}</span>
                  {b > a && <span className="min-w-0 flex-1 truncate text-muted-foreground">· {r.visit_purpose}</span>}
                  {b === a && <span className="flex-1" />}
                  <span className="flex shrink-0 -space-x-1">{techs.map(t => <TechAvatar key={t.id} tech={t} size="h-4 w-4 text-[7px]" />)}</span>
                  {contR && <span className="font-bold" style={{ color: c }}>›</span>}
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-3.5 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-[18px] rounded-sm border-l-[3px] border-primary bg-primary/20" />Visita (cor por projeto)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-[18px] rounded-sm border-l-[3px] border-rose-500" style={HOLIDAY_BG} />Feriado</span>
        {!isMobile && <span>‹ › continua na semana anterior/seguinte</span>}
        <span className="sm:ml-auto">{isMobile ? "Toque num dia para ver a agenda dele" : "Clique numa visita para ver os detalhes · clique num dia para ver a agenda dele"}</span>
      </div>
    </div>
  );
}

/** Visitas de um dia do mês (janela no computador, lista abaixo do calendário no celular). */
function DayVisits({ list, selected, holidays, onOpen, inDialog = false }: {
  list: ImplantationRequest[]; selected: Date; holidays: Map<string, Holiday[]>; onOpen: (r: ImplantationRequest) => void; inDialog?: boolean;
}) {
  const ofDay = list.filter(r => coversDay(r, selected)).sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  const selectedHolidays = holidays.get(dateKey(selected));
  return (
      <section className={inDialog ? "" : "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"}>
        <div className={`flex items-center gap-2 border-b border-border/60 py-3 pl-4 ${inDialog ? "pr-12" : "pr-4"}`}>
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{dayTitle(selected)}</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">{ofDay.length ? `${ofDay.length} visita${ofDay.length > 1 ? "s" : ""}` : ""}</span>
        </div>
        {selectedHolidays && (
          <p className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2 text-[11px] font-medium text-rose-700 dark:text-rose-300" style={HOLIDAY_BG}>
            <CalendarOff className="h-3.5 w-3.5 shrink-0" />{holidayTitle(selectedHolidays).split("\n").join(" · ")}
          </p>
        )}
        {ofDay.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma visita neste dia.</p>
        ) : (
          <ul>
            {ofDay.map(r => {
              const { start, end } = periodOf(r);
              return (
                <li key={r.id} role="button" tabIndex={0} onClick={() => onOpen(r)} onKeyDown={e => { if (e.key === "Enter") onOpen(r); }}
                  className="flex cursor-pointer gap-3 border-t border-border/60 px-4 py-3 transition-colors first:border-t-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                  <span className="w-[3px] shrink-0 rounded-full" style={{ background: colorFor(r.project_id) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.project?.company_name ?? "Projeto removido"}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.visit_purpose}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatPeriod(start, end)}</span>
                      {r.project && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{formatLocation(r.project.city, r.project.state, r.project.country_code)}</span>}
                    </p>
                  </div>
                  <span className="flex shrink-0 -space-x-1.5 self-start">{techniciansOf(r).map(t => <TechAvatar key={t.id} tech={t} size="h-6 w-6 text-[9px]" />)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
  );
}

/* ─── Lista ─── */
function ListView({ list, onOpen, highlightId }: { list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void; highlightId: string | null }) {
  const rows = [...list].sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  if (!rows.length) return <div className="rounded-xl border border-border/60 bg-card"><EmptyBlock icon={SearchX} title="Nada com esses filtros" text="Ajuste o técnico ou a busca." /></div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">Período</th><th className="px-4 py-3">Cliente / projeto</th><th className="px-4 py-3">Objetivo</th><th className="px-4 py-3">Técnicos</th><th className="px-4 py-3">GP</th><th /></tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r => {
            const { start, end } = periodOf(r);
            return (
              <tr key={r.id} data-req={r.id} onClick={() => onOpen(r)} className={`cursor-pointer transition-colors hover:bg-muted/40 ${r.id === highlightId ? "bg-amber-400/20" : ""}`}>
                <td className="whitespace-nowrap px-4 py-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorFor(r.project_id) }} />{formatPeriod(start, end)}</td>
                <td className="px-4 py-3"><p className="font-medium">{r.project?.company_name}</p><p className="font-mono text-[10px] text-muted-foreground">{r.project?.project_code}{r.location ? ` · ${r.location}` : ""}</p></td>
                <td className="px-4 py-3 text-muted-foreground">{r.visit_purpose}</td>
                <td className="px-4 py-3"><div className="flex -space-x-1.5">{techniciansOf(r).map(t => <TechAvatar key={t.id} tech={t} />)}</div></td>
                <td className="px-4 py-3 text-muted-foreground">{r.project?.manager?.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground"><Chevron className="h-4 w-4" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
