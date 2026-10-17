import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, Check, Eye, EyeOff, Lock, MapPin, RefreshCw, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ATTENDANCE_LABEL, errorMessage, fetchProjectRequests, formatPeriod, periodOf, techniciansOf, type ImplantationRequest,
} from "@/lib/implantationScheduling";
import { VISIT_STATE, placeLabel, placeOf, visitState, type VisitState } from "@/lib/agendaTecnica";
import { EmptyBlock, TechAvatar } from "./AgendaShared";
import { KindChip } from "./VisitHoverCard";
import { RequestDetailSheet } from "./AgendaDialogs";

type Kind = VisitState | "cancelada" | "reprovada";
const STYLE: Record<Kind, { label: string; pill: string; dot: string }> = {
  concluida: { label: "Realizada", pill: VISIT_STATE.concluida.pill, dot: "bg-emerald-500" },
  aguardando_registro: { label: "Realizada · aguardando registro", pill: VISIT_STATE.aguardando_registro.pill, dot: "bg-sky-500" },
  em_andamento: { label: "Em andamento", pill: VISIT_STATE.em_andamento.pill, dot: "bg-primary" },
  agendada: { label: "Agendada", pill: VISIT_STATE.agendada.pill, dot: "border-2 border-primary bg-card" },
  pendente: { label: "Prevista · aguardando aprovação", pill: VISIT_STATE.pendente.pill, dot: "border-2 border-dashed border-amber-500 bg-card" },
  cancelada: { label: "Cancelada", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
  reprovada: { label: "Reprovada", pill: "bg-red-500/15 text-red-700 dark:text-red-300", dot: "bg-red-400/70" },
};
const kindOf = (r: ImplantationRequest, now: Date): Kind =>
  r.status === "cancelada" ? "cancelada" : r.status === "reprovada" ? "reprovada" : visitState(r, now);

type Tone = "neutral" | "amber" | "red" | "emerald";
const MARK_TONE: Record<Tone, string> = { neutral: "bg-foreground/50", amber: "bg-amber-500", red: "bg-red-500", emerald: "bg-emerald-500" };
const MARK_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground", amber: "text-amber-700 dark:text-amber-300", red: "text-red-700 dark:text-red-300", emerald: "text-emerald-700 dark:text-emerald-300",
};

type Item =
  | { key: string; date: Date; type: "visita"; r: ImplantationRequest; k: Kind }
  | { key: string; date: Date; type: "marco"; label: string; detail: string; tone: Tone }
  | { key: string; date: Date; type: "hoje" };

interface ProjectDates { contract_date: string; implementation_deadline_days: number | null; status: string }

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const fmt = (d: Date) => format(d, "dd/MM/yyyy");
const DAY = 86_400_000;

/** Linha do tempo das visitas técnicas de um projeto (agenda de implantação), com os marcos de prazo. */
export function ProjectVisitsTimeline({ projectId }: { projectId: string }) {
  const { can, loading: permsLoading } = usePermissions();
  const canSee = can("agenda_calendario", "view") || can("agenda_solicitacao", "view") || can("area_implantador", "view");
  const [requests, setRequests] = useState<ImplantationRequest[] | null>(null);
  const [project, setProject] = useState<ProjectDates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRequests(null);
    try {
      const [reqs, { data: p }] = await Promise.all([
        fetchProjectRequests(projectId),
        supabase.from("projects").select("contract_date, implementation_deadline_days, status").eq("id", projectId).maybeSingle(),
      ]);
      setRequests(reqs);
      setProject((p as ProjectDates | null) ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [projectId]);
  useEffect(() => { if (!permsLoading && canSee) void load(); }, [permsLoading, canSee, load]);

  const now = useMemo(() => new Date(), [requests]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const c = { feitas: 0, proximas: 0, previstas: 0, fechadas: 0 };
    for (const r of requests ?? []) {
      const k = kindOf(r, now);
      if (k === "concluida" || k === "aguardando_registro") c.feitas++;
      else if (k === "agendada" || k === "em_andamento") c.proximas++;
      else if (k === "pendente") c.previstas++;
      else c.fechadas++;
    }
    return c;
  }, [requests, now]);

  const items = useMemo<Item[]>(() => {
    if (!requests) return [];
    const list: Item[] = requests
      .map(r => ({ r, k: kindOf(r, now) }))
      .filter(({ k }) => showClosed || (k !== "cancelada" && k !== "reprovada"))
      .map(({ r, k }) => ({ key: r.id, date: periodOf(r).start, type: "visita" as const, r, k }));
    if (project?.contract_date) {
      list.push({ key: "contrato", date: day(project.contract_date), type: "marco", label: "Contrato", detail: "Início da contagem dos prazos", tone: "neutral" });
      if (project.implementation_deadline_days) {
        const due = new Date(+day(project.contract_date) + project.implementation_deadline_days * DAY);
        const left = Math.round((+due - +day(format(now, "yyyy-MM-dd"))) / DAY);
        const done = project.status === "encerrado";
        const tone: Tone = done ? "emerald" : left < 0 ? "red" : left <= 30 ? "amber" : "neutral";
        const detail = done ? "Projeto implementado"
          : left < 0 ? `Venceu há ${-left} dia${left === -1 ? "" : "s"}`
            : left === 0 ? "Vence hoje" : `Faltam ${left} dia${left === 1 ? "" : "s"}`;
        list.push({ key: "prazo", date: due, type: "marco", label: "Finalização prevista", detail: `${detail} · prazo de ${project.implementation_deadline_days} dias`, tone });
      }
    }
    list.push({ key: "hoje", date: now, type: "hoje" });
    return list.sort((a, b) => +a.date - +b.date);
  }, [requests, project, showClosed, now]);

  const header = (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <CalendarClock className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold">Visitas técnicas</h3>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">linha do tempo da agenda de implantação</span>
      {requests && requests.length > 0 && (
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">{counts.feitas} realizada{counts.feitas === 1 ? "" : "s"}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{counts.proximas} próxima{counts.proximas === 1 ? "" : "s"}</span>
          {counts.previstas > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-800 dark:text-amber-200">{counts.previstas} aguardando aprovação</span>}
          {counts.fechadas > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setShowClosed(v => !v)}>
              {showClosed ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
              {showClosed ? "Ocultar" : "Mostrar"} canceladas ({counts.fechadas})
            </Button>
          )}
        </div>
      )}
    </div>
  );

  let body: ReactNode;
  if (permsLoading || (canSee && requests === null && !error)) {
    body = <div className="space-y-3 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;
  } else if (!canSee) {
    body = <EmptyBlock icon={Lock} title="Sem acesso à agenda de implantação" text="As visitas técnicas aparecem para quem tem acesso à Solicitação de agenda ou ao Calendário de implantação." />;
  } else if (error) {
    body = (
      <div className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <span className="flex-1">Não foi possível carregar as visitas. {error}</span>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button>
      </div>
    );
  } else if (!requests?.length) {
    body = (
      <EmptyBlock icon={CalendarClock} title="Nenhuma visita técnica para este projeto"
        text="Quando o GP solicitar uma visita em Implantação › Solicitação de agenda, ela aparece aqui com a situação e os técnicos."
        action={can("agenda_solicitacao", "view") ? <Button asChild variant="outline" size="sm"><Link to="/implantacao/solicitacoes">Ir para Solicitação de agenda</Link></Button> : undefined} />
    );
  } else {
    body = (
      <ol className="p-4">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span aria-hidden className="absolute bottom-0 left-[11px] top-6 w-px bg-border" />}
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center bg-card">
                {it.type === "visita" ? (
                  it.k === "concluida"
                    ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>
                    : <span className={`h-3.5 w-3.5 rounded-full ${STYLE[it.k].dot}`} />
                ) : it.type === "marco" ? (
                  <span className={`h-3 w-3 rotate-45 rounded-[2px] ${MARK_TONE[it.tone]}`} />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                {it.type === "hoje" ? (
                  <p className="pt-1 text-xs font-semibold text-primary">Hoje · {fmt(it.date)}</p>
                ) : it.type === "marco" ? (
                  <div className="pt-0.5">
                    <p className="text-xs font-semibold">{it.label} · {fmt(it.date)}</p>
                    <p className={`text-[11px] ${MARK_TEXT[it.tone]}`}>{it.detail}</p>
                  </div>
                ) : (
                  <VisitItem r={it.r} k={it.k} onOpen={() => setDetail(it.r)} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card shadow-sm">
      {header}
      {body}
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode="cal" />
    </section>
  );
}

function VisitItem({ r, k, onOpen }: { r: ImplantationRequest; k: Kind; onOpen: () => void }) {
  const { start, end } = periodOf(r);
  const techs = techniciansOf(r);
  const closed = k === "cancelada" || k === "reprovada";
  const label = k === "concluida" && r.attendance ? ATTENDANCE_LABEL[r.attendance] : STYLE[k].label;
  const remote = r.visit_format === "remoto";
  const where = remote ? "Remoto · videochamada" : r.location?.trim() || placeLabel(placeOf(r));
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className={`cursor-pointer rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${closed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">{formatPeriod(start, end)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STYLE[k].pill}`}>{label}</span>
        <KindChip purpose={r.visit_purpose} className="ml-auto" />
      </div>
      <p className={`mt-1 text-sm font-medium ${closed ? "line-through" : ""}`}>{r.visit_purpose}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {techs.length ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex -space-x-1.5">{techs.map(t => <TechAvatar key={t.id} tech={t} size="h-5 w-5 text-[8px]" />)}</span>
            <span className="truncate">{techs.map(t => t.full_name).join(", ")}</span>
          </span>
        ) : (
          <span>{k === "pendente" ? "Técnicos definidos na aprovação" : "Sem técnicos"}</span>
        )}
        <span className="flex min-w-0 items-center gap-1">
          {remote ? <Video className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
          <span className="truncate">{where}</span>
        </span>
      </div>
      {r.attendance_note && <p className="mt-1 text-[11px] italic text-muted-foreground">“{r.attendance_note}”</p>}
      {k === "cancelada" && r.cancel_reason && <p className="mt-1 text-[11px] text-muted-foreground">Motivo: {r.cancel_reason}</p>}
      {k === "reprovada" && r.rejection_reason && <p className="mt-1 text-[11px] text-muted-foreground">Motivo: {r.rejection_reason}</p>}
    </div>
  );
}
