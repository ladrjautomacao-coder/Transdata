import { useState, type ReactElement, type ReactNode } from "react";
import { AlertTriangle, CalendarCheck, Check, Clock3, XCircle } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { techniciansOf, type ImplantationRequest } from "@/lib/implantationScheduling";
import {
  VISIT_KIND, VISIT_STATE, coversDay, placeLabel, placeOf, visitKindOf, visitState, visitSummary,
  type AgendaAlert,
} from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";

/** Pílula de situação da visita (Pendente, Aprovada, Concluída…). */
export function VisitStatePill({ request, now = new Date() }: { request: ImplantationRequest; now?: Date }) {
  const st = visitState(request, now);
  const s = VISIT_STATE[st];
  const Icon = st === "pendente" ? Clock3 : st === "concluida" ? CalendarCheck : Check;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.pill}`}>
      <Icon className="h-3 w-3" />{s.label}
    </span>
  );
}

export function KindChip({ purpose, className = "" }: { purpose: string; className?: string }) {
  const k = VISIT_KIND[visitKindOf(purpose)];
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${k.chip} ${className}`}>{k.label}</span>;
}

/**
 * Detalhe da visita ao passar o mouse (computador). No celular não há hover:
 * o toque abre direto o painel completo.
 */
export function VisitHover({ request: r, alerts = [], onOpen, onAssign, children }: {
  request: ImplantationRequest;
  alerts?: AgendaAlert[];
  onOpen: (r: ImplantationRequest) => void;
  /** Presente = quem vê pode avaliar a solicitação pendente. */
  onAssign?: (r: ImplantationRequest) => void;
  children: ReactElement;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  if (isMobile) return children;
  const now = new Date();
  const techs = techniciansOf(r);
  const pending = r.status === "pendente";
  const rows: [string, ReactNode][] = [
    ["Técnico", techs.length
      ? <span className="flex flex-wrap items-center gap-1.5">{techs.map(t => <span key={t.id} className="inline-flex items-center gap-1.5"><TechAvatar tech={t} size="h-5 w-5 text-[8px]" />{t.full_name}</span>)}</span>
      : <span className="text-amber-700 dark:text-amber-300">A definir na aprovação</span>],
    ["Local", r.location?.trim() || placeLabel(placeOf(r))],
    ["Objetivo", r.visit_purpose],
    ["Projeto", r.project?.project_code ?? "—"],
    ["GP", r.project?.manager?.full_name ?? r.requester_name ?? "—"],
  ];
  return (
    <HoverCard openDelay={250} closeDelay={80} open={open} onOpenChange={setOpen}>
      {/* Só abre com o mouse: no clique (ou quando o foco volta ao fechar o painel) o resumo não fica por trás. */}
      <HoverCardTrigger asChild onFocus={e => e.preventDefault()} onClick={() => setOpen(false)}>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" collisionPadding={12} className="w-[340px] p-0">
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-1.5">
            <KindChip purpose={r.visit_purpose} />
            <VisitStatePill request={r} now={now} />
            {coversDay(r, now) && <span className="ml-auto text-[11px] font-semibold text-primary">Hoje</span>}
          </div>
          <div>
            <p className="text-base font-semibold leading-snug">{r.project?.company_name ?? "Projeto removido"}</p>
            <p className="text-xs text-muted-foreground">{visitSummary(r)}</p>
          </div>
          <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {alerts.map(a => (
            <div key={a.id} className={`rounded-lg border px-3 py-2.5 text-xs ${a.kind === "conflito" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"}`}>
              <p className="flex items-center gap-1.5 font-semibold">{a.kind === "conflito" ? <XCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{a.kind === "sem_folga" ? "Viagem sem folga" : a.title}</p>
              <p className="mt-0.5 leading-relaxed">{a.text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <span className="text-[11px] text-muted-foreground">Clique na visita para ver tudo</span>
          {pending && onAssign
            ? <Button size="sm" className="ml-auto h-8" onClick={() => { setOpen(false); onAssign(r); }}>Avaliar</Button>
            : <Button size="sm" className="ml-auto h-8" onClick={() => { setOpen(false); onOpen(r); }}>Abrir visita</Button>}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
