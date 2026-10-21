import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, Bus, CalendarClock, Check, ChevronRight, Cpu, FileText, Flag, Gauge, Layers, Mail, MapPin, MessageSquareText,
  Navigation, Puzzle, RefreshCw, Route, UsersRound, Video, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import { projectSegmentLabel } from "@/lib/projectSegments";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import { effectiveFollowUps } from "@/lib/followUpNotes";
import { daysBetween, fmtDate } from "@/lib/deadlineAlerts";
import type { Holiday } from "@/lib/holidays";
import { formatLocation } from "@/lib/location";
import { MONTH_SHORT, VISIT_KIND, dayDiff, fmtHM, plusDays, startOfDay, visitKindOf, visitOrdinal } from "@/lib/agendaTecnica";
import {
  ATTENDANCE_LABEL, colorFor, destinationOf, formatPeriod, initials, remotePeriodText,
  type AgendaVisit, type ProjectBrief, type Technician,
} from "@/lib/implantationScheduling";
import { TechAvatar } from "./AgendaShared";
import { HolidayWarning } from "./HolidaysDialog";

const p2 = (n: number) => String(n).padStart(2, "0");
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const localYmd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const n0 = (v: number | null | undefined) => v ?? 0;
const vehicles = (n: number) => `${n} veículo${n === 1 ? "" : "s"}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** "há 7 meses", "em 12 dias", "hoje". */
const relDays = (d: number) => d === 0 ? "hoje" : d > 0
  ? `em ${d < 31 ? plural(d, "dia", "dias") : plural(Math.round(d / 30), "mês", "meses")}`
  : `há ${-d < 31 ? plural(-d, "dia", "dias") : plural(Math.round(-d / 30), "mês", "meses")}`;
// tons das soluções (cor semântica com variante escura; a marca fica no --primary)
const TINTS = [
  "bg-violet-500/15 text-violet-700 dark:text-violet-300", "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300", "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];
const ACTIVE_STATUSES = ["comercial", "planejamento", "implantacao"];

function Section({ icon: Icon, title, aside, children, className = "" }: { icon: LucideIcon; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm ${className}`}>
      <div className="flex items-center gap-2.5 px-5 pb-1 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {aside && <span className="ml-auto text-xs text-muted-foreground">{aside}</span>}
      </div>
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Bolinha com as iniciais na cor da pessoa (mesma regra dos avatares dos técnicos). */
const Initials = ({ name, size = "h-10 w-10 text-xs" }: { name: string; size?: string }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${size}`} style={{ background: colorFor(name) }}>{initials(name)}</span>
);

/** Anel de progresso (frota já implantada). */
function Ring({ value }: { value: number }) {
  const r = 20, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden>
      <circle cx="24" cy="24" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
      <circle cx="24" cy="24" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-emerald-500 transition-[stroke-dashoffset] duration-700"
        strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
    </svg>
  );
}

/** Situação da visita do técnico em relação a hoje. */
function visitMoment(v: AgendaVisit, now: Date) {
  const s = new Date(v.start), e = new Date(v.end);
  const first = startOfDay(s), last = startOfDay(e > s ? new Date(+e - 1) : s), today = startOfDay(now);
  const total = dayDiff(first, last) + 1;
  if (v.status === "cancelada") return { kind: "past" as const, label: "Visita cancelada", first, last, total, dayIdx: -1 };
  if (+first <= +today && +today <= +last) {
    const dayIdx = dayDiff(first, today);
    return { kind: "now" as const, label: `Em atendimento · dia ${dayIdx + 1} de ${total}`, first, last, total, dayIdx };
  }
  if (+first > +today) {
    const d = dayDiff(today, first);
    return { kind: "next" as const, label: `Próxima visita · ${d === 1 ? "amanhã" : `em ${d} dias`}`, first, last, total, dayIdx: -1 };
  }
  return { kind: "past" as const, label: v.attendance ? ATTENDANCE_LABEL[v.attendance] : "Visita realizada · aguardando registro", first, last, total, dayIdx: total };
}

/**
 * Ficha do projeto para o técnico: a visita dele em destaque (quando, onde, com quem,
 * recado do GP) e tudo o que o projeto tem cadastrado (números, escopo, pessoas,
 * marcos, frota, acompanhamento do GP e visitas).
 */
export function ProjectBriefPanel({ visit, tech, brief, loading, error, onRetry, onOpenVisit, now, custom }: {
  visit: AgendaVisit;
  tech: Technician;
  brief: ProjectBrief | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenVisit: () => void;
  now: Date;
  custom: Holiday[];
}) {
  const [allNotes, setAllNotes] = useState(false);
  const start = new Date(visit.start), end = new Date(visit.end);
  const m = visitMoment(visit, now);
  const turn = remotePeriodText(visit.visit_format, start, end);
  const dest = destinationOf(visit);
  const kind = VISIT_KIND[visitKindOf(visit.visit_purpose)];
  const p = brief?.project;
  const phase = p?.sub_phase ? subPhasesByStatus[p.status as keyof typeof subPhasesByStatus]?.find(s => s.id === p.sub_phase)?.label : null;
  const statusText = p ? `${statusLabels[p.status as keyof typeof statusLabels] ?? p.status}${phase ? ` · ${phase}` : ""}` : null;
  const team = [tech, ...visit.colleagues.map(c => ({ ...c, email: null, area: null, active: true }))];
  const days = Array.from({ length: Math.min(m.total, 14) }, (_, i) => plusDays(m.first, i));
  const sameMonth = m.first.getMonth() === m.last.getMonth();
  const holidayPlace = visit.visit_format === "presencial" && visit.address_city?.trim()
    ? { city: visit.address_city, state: visit.address_state } : { city: visit.project.city, state: visit.project.state };

  // números do projeto
  const contracted = n0(p?.fleet_size);
  const complementary = p?.complementary_sale ? n0(p.complementary_fleet) : 0;
  const totalFleet = contracted + complementary;
  const implemented = n0(p?.implemented_fleet);
  const equipTotal = (brief?.equipments ?? []).reduce((a, e) => a + e.quantity, 0);
  const today = localYmd(now);
  const due = p?.implementation_due ?? null;
  const dueDays = due ? daysBetween(today, due) : null;
  const overdue = dueDays != null && dueDays < 0 && !!p && ACTIVE_STATUSES.includes(p.status);
  const notes = brief && p ? effectiveFollowUps({ notes: brief.notes, observations: p.observations, updated_at: p.updated_at }) : [];
  const shownNotes = allNotes ? notes : notes.slice(0, 3);
  const gpName = visit.project.manager_name ?? brief?.manager?.full_name ?? null;

  const milestones = p ? [
    { label: "Contrato", date: p.contract_date },
    { label: "D-Zero", date: p.d_zero_date, missing: "Sinal não confirmado" },
    { label: "Handover", date: p.handover_date },
    { label: "Projeto executivo", date: p.executive_project_date },
    { label: "Finalização prevista", date: due, goal: true },
  ].sort((a, b) => (a.goal ? 1 : 0) - (b.goal ? 1 : 0) || (a.date ?? "9999").localeCompare(b.date ?? "9999")) : [];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* ─── A visita, em destaque ─── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-lg">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:28px_28px]" />
        <Bus aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-56 w-56 rotate-[-8deg] opacity-[0.08]" strokeWidth={1.25} />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${m.kind === "now" ? "animate-pulse bg-sidebar-primary" : m.kind === "next" ? "bg-primary-foreground" : "bg-primary-foreground/50"}`} />
              {m.label}
            </span>
            <span className="rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium">{kind.label}</span>
          </div>
          <h2 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-tight sm:text-4xl">{visit.project.company_name}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-primary-foreground/80">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{formatLocation(visit.project.city, visit.project.state, visit.project.country_code)}</span>
            {statusText && <span>{statusText}</span>}
            {visit.project.project_code && <span className="max-w-full truncate font-mono text-xs text-primary-foreground/65" title={visit.project.project_code}>{visit.project.project_code}</span>}
          </p>

          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* quando + o quê */}
            <div className="flex items-center gap-4 rounded-2xl bg-primary-foreground/10 p-4">
              <div className="flex w-[86px] shrink-0 flex-col items-center rounded-xl bg-primary-foreground py-2 text-primary shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider">{MONTH_SHORT[m.first.getMonth()]}{sameMonth ? "" : `–${MONTH_SHORT[m.last.getMonth()]}`}</span>
                <span className="text-2xl font-extrabold leading-tight tabular-nums">{m.total > 1 ? `${p2(m.first.getDate())}–${p2(m.last.getDate())}` : p2(m.first.getDate())}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug">{visit.visit_purpose}</p>
                <p className="mt-0.5 text-sm text-primary-foreground/80">
                  {m.total > 1 ? `${WD[m.first.getDay()]} a ${WD[m.last.getDay()]} · ` : `${WD[m.first.getDay()]} · `}{turn ?? `início às ${fmtHM(start)}`}
                </p>
              </div>
            </div>
            {/* dias da visita */}
            <div className="rounded-2xl bg-primary-foreground/10 p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{m.kind === "now" ? `Dia ${m.dayIdx + 1} de ${m.total}` : m.kind === "next" ? `${plural(m.total, "dia", "dias")} de visita` : "Visita encerrada"}</span>
                <span className="text-primary-foreground/75">{m.kind === "now" ? (m.total - m.dayIdx - 1 > 0 ? `${plural(m.total - m.dayIdx - 1, "dia restante", "dias restantes")}` : "último dia") : m.kind === "next" ? `começa ${WD[m.first.getDay()]} ${p2(m.first.getDate())}/${p2(m.first.getMonth() + 1)}` : ""}</span>
              </div>
              <ol className="mt-2.5 flex gap-1.5 overflow-x-auto">
                {days.map((d, i) => {
                  const done = m.kind === "past" || (m.kind === "now" && i < m.dayIdx);
                  const cur = m.kind === "now" && i === m.dayIdx;
                  return (
                    <li key={i} aria-current={cur ? "date" : undefined}
                      className={`flex min-w-[42px] flex-1 flex-col items-center rounded-xl py-1.5 text-[11px] leading-tight ${cur ? "bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-md ring-2 ring-primary-foreground/70" : done ? "bg-primary-foreground/25" : "bg-primary-foreground/[0.08] text-primary-foreground/80"}`}>
                      <span className="uppercase">{WD[d.getDay()]}</span>
                      <span className="flex h-5 items-center text-sm font-semibold tabular-nums">{done ? <Check className="h-4 w-4" /> : p2(d.getDate())}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* destino + ações */}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-primary-foreground/10 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground text-primary">{dest.remote ? <Video className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}</span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{dest.title}</p>
                <p className="truncate text-xs text-primary-foreground/75">{dest.subtitle}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {dest.href && (
                <Button asChild className="h-auto min-h-12 flex-1 bg-primary-foreground px-5 text-primary shadow-sm hover:bg-primary-foreground/90 sm:flex-none">
                  <a href={dest.href} target="_blank" rel="noopener noreferrer">{dest.remote ? <Video className="mr-2 h-4 w-4" /> : <Navigation className="mr-2 h-4 w-4" />}{dest.remote ? "Entrar na reunião" : "Abrir rota"}</a>
                </Button>
              )}
              <Button variant="ghost" onClick={onOpenVisit}
                className="h-auto min-h-12 flex-1 border border-primary-foreground/30 px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:flex-none">
                <FileText className="mr-2 h-4 w-4" />Detalhes
              </Button>
            </div>
          </div>

          {/* equipe */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-primary-foreground/75">Equipe na visita</span>
            {team.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 py-0.5 pl-0.5 pr-3 text-xs font-medium">
                <TechAvatar tech={t} size="h-6 w-6 text-[9px] ring-0" />{t.id === tech.id ? `${t.full_name.split(" ")[0]} (você)` : t.full_name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* recado do GP */}
      {visit.notes?.trim() && (
        <div className="flex gap-3.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 sm:p-5">
          {gpName ? <Initials name={gpName} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"><MessageSquareText className="h-5 w-5" /></span>}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">Recado {gpName ? `de ${gpName.split(" ")[0]}` : "do GP"} para esta visita</p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{visit.notes.trim()}</p>
          </div>
        </div>
      )}
      {visit.status === "cancelada" && visit.cancel_reason && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground"><b className="text-foreground">Motivo do cancelamento:</b> {visit.cancel_reason}</p>
      )}
      <div className="empty:hidden"><HolidayWarning start={start} end={end} custom={custom} place={holidayPlace} /></div>

      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">Não foi possível carregar as informações do projeto. {error}</span>
          <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
        </div>
      ) : loading || !brief || !p ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}</div>
          <div className="grid gap-5 xl:grid-cols-3"><Skeleton className="h-56 rounded-2xl xl:col-span-2" /><Skeleton className="h-56 rounded-2xl" /></div>
        </>
      ) : (
        <>
          {/* ─── números do projeto ─── */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={Bus} tone="bg-sky-500/15 text-sky-700 dark:text-sky-300" label="Frota" value={vehicles(totalFleet)}
              caption={complementary ? `${contracted} contratada + ${complementary} complementar` : `Urbano ${n0(p.fleet_urbano)} · Seccionado ${n0(p.fleet_seccionado)}`} />
            <Stat icon={Cpu} tone="bg-violet-500/15 text-violet-700 dark:text-violet-300" label="Equipamentos" value={equipTotal ? `${equipTotal} un.` : "—"}
              caption={brief.equipments.map(e => e.name).join(", ") || "Não informado"} />
            <Stat ring={totalFleet ? implemented / totalFleet : 0} label="Já implantada" value={`${implemented} de ${totalFleet}`}
              caption={totalFleet ? `${Math.round((implemented / totalFleet) * 100)}% da frota` : "Frota não informada"} />
            <Stat icon={Flag} tone={overdue ? "bg-red-500/15 text-red-600 dark:text-red-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}
              label="Finalização prevista" value={due ? fmtDate(due) : "—"} alert={overdue}
              caption={dueDays == null ? "Prazo não informado" : overdue ? `vencida há ${plural(-dueDays, "dia", "dias")}` : relDays(dueDays)} />
          </div>

          {/* ─── escopo + pessoas ─── */}
          <div className="grid items-start gap-5 xl:grid-cols-3">
            <Section icon={Layers} title="Escopo contratado" className="xl:col-span-2"
              aside={brief.solutions.length ? plural(brief.solutions.length, "solução", "soluções") : undefined}>
              {brief.solutions.length + brief.equipments.length + brief.integrations.length + brief.products.length === 0 ? (
                <Empty>O escopo ainda não foi cadastrado no projeto.</Empty>
              ) : (
                <div className="flex flex-col gap-4">
                  {brief.solutions.length > 0 && (
                    <ul className="grid gap-2.5 sm:grid-cols-2">
                      {brief.solutions.map((s, i) => (
                        <li key={s.name} className={`flex min-w-0 gap-3 rounded-xl border border-border/60 p-3 ${s.features.length ? "sm:col-span-2" : ""}`}>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TINTS[i % TINTS.length]}`}><Puzzle className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-9">{s.name}</p>
                            {s.features.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pb-0.5">
                                {s.features.map(f => <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-xs">{f}</span>)}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {brief.equipments.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Equipamentos</p>
                      <div className="flex flex-wrap gap-2">
                        {brief.equipments.map(e => (
                          <span key={e.name} className="inline-flex items-stretch overflow-hidden rounded-lg border border-primary/30 text-sm">
                            <span className="bg-primary px-2.5 py-1 font-bold tabular-nums text-primary-foreground">{e.quantity}×</span>
                            <span className="px-3 py-1 font-medium">{e.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(brief.integrations.length > 0 || brief.products.length > 0) && (
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {brief.integrations.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Integrações</p>
                          <div className="flex flex-wrap gap-1.5">{brief.integrations.map(x => <span key={x} className="rounded-md border border-border/70 px-2 py-0.5 text-xs font-medium">{x}</span>)}</div>
                        </div>
                      )}
                      {brief.products.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Produtos</p>
                          <div className="flex flex-wrap gap-1.5">{brief.products.map(x => <span key={x} className="rounded-md border border-border/70 px-2 py-0.5 text-xs font-medium">{x}</span>)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Section>

            <Section icon={UsersRound} title="Pessoas do projeto">
              <ul className="flex flex-col gap-3">
                {[
                  { role: teamRoleLabels.manager ?? "Gerente de Projetos", person: brief.manager },
                  { role: teamRoleLabels.executive ?? "Executivo de Vendas", person: brief.executive },
                ].map(({ role, person }) => (
                  <li key={role} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                    {person ? <Initials name={person.full_name} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">—</span>}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-muted-foreground">{role}</p>
                      <p className="truncate text-sm font-semibold">{person?.full_name ?? "Não definido"}</p>
                      {person?.email && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
                    </div>
                    {person?.email && (
                      <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0" title={`Enviar e-mail para ${person.full_name}`}>
                        <a href={`mailto:${person.email}?subject=${encodeURIComponent(`${visit.project.company_name} · ${visit.visit_purpose}`)}`} aria-label={`Enviar e-mail para ${person.full_name}`}><Mail className="h-4 w-4" /></a>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          {/* ─── marcos do projeto ─── */}
          <Section icon={CalendarClock} title="Marcos do projeto" aside={p.project_type ? `${p.project_type}${p.project_segment ? ` · ${projectSegmentLabel(p.project_segment)}` : ""}` : undefined}>
            <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {milestones.map((ms, i) => {
                const d = ms.date ? daysBetween(today, ms.date) : null;
                const late = !!ms.goal && overdue;
                const done = !ms.goal && d != null && d <= 0;
                return (
                  <li key={ms.label} className={`relative flex gap-3 lg:flex-col lg:gap-2 ${i < milestones.length - 1 ? "lg:after:absolute lg:after:left-9 lg:after:right-0 lg:after:top-[15px] lg:after:h-0.5 lg:after:bg-border" : ""}`}>
                    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${late ? "bg-red-500 text-white" : done ? "bg-primary text-primary-foreground" : ms.date ? "border-2 border-primary/50 bg-card text-primary" : "border-2 border-dashed border-border bg-card text-muted-foreground"}`}>
                      {late ? <AlertTriangle className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : ms.goal ? <Flag className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{ms.label}</p>
                      <p className={`text-[15px] font-semibold tabular-nums ${late ? "text-red-600 dark:text-red-400" : ""}`}>{ms.date ? fmtDate(ms.date) : "—"}</p>
                      <p className={`text-xs ${late ? "font-medium text-red-600 dark:text-red-400" : !ms.date && ms.missing ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                        {late ? `vencida há ${plural(-(d ?? 0), "dia", "dias")}` : d != null ? relDays(d) : ms.missing ?? "Não informado"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>

          {/* ─── frota + acompanhamento ─── */}
          <div className="grid items-start gap-5 xl:grid-cols-3">
            <Section icon={Gauge} title="Frota e instalação">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">Composição</span><span className="text-xs text-muted-foreground">{vehicles(totalFleet)}</span></div>
                  <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted">
                    {[[n0(p.fleet_urbano), "bg-sky-500"], [n0(p.fleet_seccionado), "bg-violet-500"], [complementary, "bg-amber-500"]].map(([n, c]) => (
                      Number(n) > 0 && <span key={String(c)} className={String(c)} style={{ width: `${(Number(n) / Math.max(1, totalFleet)) * 100}%` }} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Urbano {n0(p.fleet_urbano)}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Seccionado {n0(p.fleet_seccionado)}</span>
                    {p.complementary_sale && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Complementar {complementary}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-muted/50 p-3"><p className="text-[11px] text-muted-foreground">Instalação Transmobile</p><p className="text-xl font-bold tabular-nums">{n0(p.installation_transmobile)}</p></div>
                  <div className="rounded-xl bg-muted/50 p-3"><p className="text-[11px] text-muted-foreground">Instalação cliente</p><p className="text-xl font-bold tabular-nums">{n0(p.installation_client)}</p></div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"><Wrench className="h-3.5 w-3.5 text-primary" />
                    {p.embedded_install_training === true ? "Com treinamento de instalação" : p.embedded_install_training === false ? "Sem treinamento de instalação" : "Treinamento de instalação não informado"}
                  </span>
                  {p.is_pilot && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-800 dark:text-amber-200">Projeto piloto{p.pilot_info ? ` · ${p.pilot_info}` : ""}</span>}
                </div>
              </div>
            </Section>

            <Section icon={MessageSquareText} title="Acompanhamento do GP" className="xl:col-span-2" aside={notes.length ? plural(notes.length, "anotação", "anotações") : undefined}>
              {notes.length === 0 ? <Empty>O GP ainda não registrou anotações neste projeto.</Empty> : (
                <>
                  <ol className="relative ml-1.5 flex flex-col gap-4 border-l-2 border-border/70 pl-5">
                    {shownNotes.map((n, i) => (
                      <li key={i} className="relative">
                        <span className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-card ${i === 0 ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40"}`} />
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">{n.dateLabel ?? "Data não registrada"}</span>
                          {n.author && <span>{n.author}</span>}
                          {i === 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">mais recente</span>}
                        </p>
                        <p className={`mt-1 whitespace-pre-line ${i === 0 ? "text-[15px]" : "text-sm text-foreground/85"}`}>{n.text}</p>
                      </li>
                    ))}
                  </ol>
                  {notes.length > 3 && (
                    <Button variant="ghost" size="sm" className="ml-4 mt-3 h-8 px-2 text-xs text-primary" onClick={() => setAllNotes(v => !v)}>
                      {allNotes ? "Mostrar menos" : `Ver todas as ${notes.length} anotações`}
                    </Button>
                  )}
                </>
              )}
            </Section>
          </div>

          {/* ─── visitas do projeto ─── */}
          <Section icon={Route} title="Visitas do projeto" aside={plural(brief.visits.length, "visita", "visitas")}>
            {brief.visits.length === 0 ? <Empty>Nenhuma visita agendada neste projeto.</Empty> : (
              <ol className="flex gap-2 overflow-x-auto pb-1">
                {brief.visits.map((x, i) => {
                  const s = new Date(x.start), e = new Date(x.end);
                  const st = x.status === "pendente" ? { l: "Aguardando aprovação", c: "bg-amber-500/15 text-amber-800 dark:text-amber-300", done: false }
                    : x.attendance ? { l: ATTENDANCE_LABEL[x.attendance], c: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", done: true }
                      : e < now ? { l: "Aguardando registro", c: "bg-amber-500/10 text-amber-800 dark:text-amber-300", done: false }
                        : s <= now ? { l: "Em andamento", c: "bg-primary/15 text-primary", done: false }
                          : { l: "Agendada", c: "bg-primary/10 text-primary", done: false };
                  const mine = x.id === visit.id;
                  const ord = visitOrdinal(x.visit_purpose);
                  return (
                    <li key={x.id} className="flex shrink-0 items-center gap-2">
                      {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />}
                      <div className={`flex w-[236px] flex-col gap-2 rounded-xl border p-3.5 ${mine ? "border-primary bg-primary/[0.06] ring-1 ring-primary" : "border-border/60"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`flex h-8 min-w-[2rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${st.done ? "bg-emerald-500 text-white" : mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"}`}>
                            {st.done ? <Check className="h-4 w-4" /> : ord ?? i + 1}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.c}`}>{mine && !st.done && x.status !== "pendente" ? "Esta visita" : st.l}</span>
                        </div>
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{x.visit_purpose}</p>
                        <p className="text-xs font-medium tabular-nums text-muted-foreground">{formatPeriod(s, e)}{x.visit_format === "remoto" ? " · remoto" : ""}</p>
                        <p className="truncate text-xs text-muted-foreground">{x.technicians.length ? x.technicians.join(", ") : "Técnico a definir"}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/** Número-chave do projeto (ícone ou anel de progresso, valor e legenda). */
function Stat({ icon: Icon, tone, ring, label, value, caption, alert = false }: {
  icon?: LucideIcon; tone?: string; ring?: number; label: string; value: string; caption: string; alert?: boolean;
}) {
  return (
    // celular: ícone em cima, para o número caber inteiro
    <div className={`flex min-w-0 flex-col items-start gap-2.5 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:gap-3.5 ${alert ? "border-red-500/40 bg-red-500/[0.06]" : "border-border/60 bg-card"}`}>
      {ring != null ? <Ring value={ring} /> : Icon && <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-6 w-6" /></span>}
      <div className="w-full min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold leading-tight tabular-nums sm:text-2xl ${alert ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
        <p className={`truncate text-xs ${alert ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`} title={caption}>{caption}</p>
      </div>
    </div>
  );
}
