import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, CalendarX, ChevronLeft, ChevronRight, ChevronRight as Chevron, Inbox, List, Lock, RefreshCw,
  Search, SearchX, ShieldCheck, UsersRound, WifiOff, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  colorFor, errorMessage, fetchRequests, fetchTechnicians, formatPeriod, initials, periodOf, techniciansOf,
  type ImplantationRequest, type Technician,
} from "@/lib/implantationScheduling";
import { EmptyBlock, TechAvatar } from "@/components/agendamento/AgendaShared";
import { RequestDetailSheet } from "@/components/agendamento/AgendaDialogs";

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

export default function CalendarioImplantacao() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ImplantationRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as View) || "tecnico"; } catch { return "tecnico"; }
  });
  const [anchor, setAnchor] = useState(() => {
    const t = new Date();
    return view === "mes" ? new Date(t.getFullYear(), t.getMonth(), 1) : mondayOf(t);
  });
  const [techFilter, setTechFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);

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
          Implantação <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700 dark:text-amber-300"><Lock className="h-3 w-3" />Em desenvolvimento · só Super Admin</span>
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
        <span>Somente <b className="text-foreground">aprovados</b>.{pendingCount > 0 && <> {pendingCount} pendente(s) não aparecem — <button type="button" className="font-semibold text-primary hover:underline" onClick={() => navigate("/implantacao/solicitacoes?visao=aprovador")}>avaliar</button></>}</span>
      </span>
    </div>
  );

  let body;
  if (approved.length === 0) {
    body = (
      <div className="rounded-xl border border-border/60 bg-card">
        <EmptyBlock icon={CalendarX} title="Nenhum agendamento aprovado" text="Quando o Aprovador aprovar uma solicitação, ela aparece aqui na linha do tempo do técnico."
          action={pendingCount > 0 ? <Button onClick={() => navigate("/implantacao/solicitacoes?visao=aprovador")}><Inbox className="mr-1.5 h-4 w-4" />Ver solicitações pendentes</Button> : undefined} />
      </div>
    );
  } else if (view === "tecnico") {
    body = <Timeline start={anchor} techs={rowTechs} list={filtered} onOpen={setDetail} />;
  } else if (view === "mes") {
    body = <MonthGrid month={anchor} list={filtered} onOpen={setDetail} />;
  } else {
    body = <ListView list={filtered} onOpen={setDetail} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {toolbar}
      {body}
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode="cal" />
    </div>
  );
}

/* ─── Linha do tempo por técnico (14 dias) ─── */
function Timeline({ start, techs, list, onOpen }: { start: Date; techs: Technician[]; list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void }) {
  const N = 14, COL = 76, NAME = 220;
  const s0 = mondayOf(start), sEnd = addDays(s0, N);
  const days = Array.from({ length: N }, (_, i) => addDays(s0, i));
  const today = startOfDay(new Date()).getTime();
  if (techs.length === 0) return <div className="rounded-xl border border-border/60 bg-card"><EmptyBlock icon={UsersRound} title="Nenhum técnico" text="Cadastre técnicos em Solicitação de agenda › Aprovador › Técnicos." /></div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <div style={{ minWidth: NAME + N * COL }}>
        <div className="flex border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
          <div className="shrink-0 px-4 py-2.5" style={{ width: NAME }}>Técnico</div>
          {days.map(d => {
            const isT = d.getTime() === today, we = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={+d} className={`shrink-0 border-l py-1.5 text-center ${we ? "opacity-60" : ""} ${isT ? "text-primary" : ""}`} style={{ width: COL }}>
                {WD[d.getDay()]}
                <div className={`text-base font-bold ${isT ? "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground"}`}>{d.getDate()}</div>
              </div>
            );
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
              <div className="flex shrink-0 items-center gap-3 px-4" style={{ width: NAME }}>
                <TechAvatar tech={t} size="h-9 w-9 text-[11px]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.area ? `${t.area} · ` : ""}{busy} dia{busy !== 1 ? "s" : ""} alocado{busy !== 1 ? "s" : ""}</p>
                  <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${busy > 7 ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (busy / 10) * 100)}%` }} /></div>
                </div>
              </div>
              {days.map(d => (
                <div key={+d} className={`shrink-0 border-l ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/40" : ""} ${d.getTime() === today ? "bg-primary/[0.06]" : ""}`} style={{ width: COL }} />
              ))}
              {mine.map(r => {
                const { start: rs, end: re } = periodOf(r);
                const a = Math.max(0, Math.round((+startOfDay(rs) - +s0) / DAY));
                const b = Math.min(N - 1, Math.round((+startOfDay(re) - +s0) / DAY));
                const c = colorFor(r.project_id);
                return (
                  <button key={r.id} type="button" onClick={() => onOpen(r)} title={`${r.project?.company_name} · ${formatPeriod(rs, re)}`}
                    className="absolute top-2.5 flex h-[58px] flex-col justify-center overflow-hidden rounded-xl px-3 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ left: NAME + a * COL + 4, width: (b - a + 1) * COL - 8, background: `linear-gradient(135deg, ${c}, ${c}cc)` }}>
                    <p className="truncate text-xs font-semibold">{r.project?.company_name}</p>
                    <p className="truncate text-[10px] opacity-90">{fDT(rs)} → {fDT(re)}</p>
                    <p className="truncate text-[10px] opacity-75">{r.visit_purpose}</p>
                  </button>
                );
              })}
              {mine.length === 0 && <p className="pointer-events-none absolute inset-y-0 flex items-center text-[11px] italic text-muted-foreground" style={{ left: NAME + 14 }}>Disponível no período</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Mês ─── */
function MonthGrid({ month, list, onOpen }: { month: Date; list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void }) {
  const m0 = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(mondayOf(m0), i));
  const today = startOfDay(new Date()).getTime();
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-[11px] font-semibold text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(x => <div key={x} className="py-2">{x}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(c => {
          const ev = list.filter(r => periodOf(r).start < addDays(c, 1) && c < periodOf(r).end);
          const inM = c.getMonth() === m0.getMonth();
          return (
            <div key={+c} className={`min-h-[108px] border-b border-r p-1.5 ${inM ? "" : "bg-muted/40 opacity-60"}`}>
              <div className="mb-1 flex justify-end">
                <span className={`text-xs ${c.getTime() === today ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>{c.getDate()}</span>
              </div>
              <div className="space-y-1">
                {ev.slice(0, 3).map(r => (
                  <button key={r.id} type="button" onClick={() => onOpen(r)} title={`${r.project?.company_name} · ${techniciansOf(r).map(t => t.full_name).join(", ")}`}
                    className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium text-white transition hover:brightness-110" style={{ background: colorFor(r.project_id) }}>
                    {r.project?.company_name} · {techniciansOf(r).map(t => initials(t.full_name)).join(", ")}
                  </button>
                ))}
                {ev.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{ev.length - 3} mais</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Lista ─── */
function ListView({ list, onOpen }: { list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void }) {
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
              <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer transition-colors hover:bg-muted/40">
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
