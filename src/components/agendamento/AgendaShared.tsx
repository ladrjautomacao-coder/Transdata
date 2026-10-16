import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bus, CalendarClock, ChevronRight, Info, MapPin, MessageSquareWarning, Navigation, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatLocation } from "@/lib/location";
import {
  REQUEST_STATUS, colorFor, formatPeriod, initials, mapsUrlFor, periodOf, techniciansOf,
  type DestinationParts, type ImplantationRequest, type RequestStatus, type Technician,
} from "@/lib/implantationScheduling";

export function StatusPill({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Kpi({ icon: Icon, label, value, caption, tone, info, onClick, stacked = false }: {
  icon: LucideIcon; label: string; value: number | string; caption: string; tone: string; info: string; onClick?: () => void;
  /** Ícone sempre em cima (para colunas estreitas, ex.: painel lateral). */
  stacked?: boolean;
}) {
  const row = !stacked;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`flex h-full w-full flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-3 pr-7 text-left shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default ${row ? "sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:pr-9" : ""}`}
      >
        {/* Celular: ícone em cima para os textos caberem inteiros */}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row ? "sm:h-11 sm:w-11" : ""} ${tone}`}><Icon className={`h-4 w-4 ${row ? "sm:h-5 sm:w-5" : ""}`} /></span>
        <span className="min-w-0">
          <span className={`block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${row ? "sm:truncate" : ""}`}>{label}</span>
          <span className="block text-2xl font-bold leading-tight">{value}</span>
          <span className={`block text-[11px] text-muted-foreground ${row ? "sm:truncate" : ""}`}>{caption}</span>
        </span>
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`O que significa ${label}`} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-64 text-sm">
          <p className="mb-1 font-semibold">{label}</p>
          <p className="text-muted-foreground">{info}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TechAvatar({ tech, size = "h-7 w-7 text-[10px]" }: { tech: Technician; size?: string }) {
  // foto que não carregou (arquivo apagado, sem rede) volta para as iniciais
  const [failed, setFailed] = useState<string | null>(null);
  const photo = tech.photo_url && tech.photo_url !== failed ? tech.photo_url : null;
  return (
    <span
      title={tech.full_name}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ring-2 ring-card ${size}`}
      style={{ background: colorFor(tech.id) }}
    >
      {photo
        ? <img src={photo} alt={tech.full_name} loading="lazy" draggable={false} className="h-full w-full object-cover" onError={() => setFailed(photo)} />
        : initials(tech.full_name)}
    </span>
  );
}

const meetingHref = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/**
 * Para onde o técnico vai: endereço do treinamento (rua em destaque, bairro e cidade
 * abaixo) ou reunião remota. `action` mostra o botão Rota / Entrar ao lado.
 */
export function VisitDestination({ visit, action = false, extra }: { visit: DestinationParts; action?: boolean; extra?: ReactNode }) {
  const remote = visit.visit_format === "remoto";
  const projectCity = visit.project ? formatLocation(visit.project.city, visit.project.state, visit.project.country_code) : "";
  let title: string, subtitle: string;
  if (remote) {
    const link = meetingHref(visit.meeting_url);
    title = "Remoto · videochamada";
    subtitle = link ? hostOf(link) : "Link não informado";
  } else if (visit.visit_format === "presencial" && visit.address_street?.trim()) {
    title = visit.address_street.trim();
    const cityUf = visit.address_city?.trim() ? [visit.address_city.trim(), visit.address_state?.trim()].filter(Boolean).join("/") : projectCity;
    subtitle = [visit.address_district?.trim(), cityUf].filter(Boolean).join(" · ");
  } else {
    // solicitação antiga: só o "Local" livre (às vezes só a cidade)
    const loc = visit.location?.trim() ?? "";
    const onlyCity = !loc || loc.toLowerCase() === projectCity.toLowerCase();
    title = onlyCity ? projectCity || "Local não informado" : loc;
    subtitle = onlyCity ? "Endereço não informado na solicitação" : projectCity;
  }
  const Icon = remote ? Video : MapPin;
  const href = remote ? meetingHref(visit.meeting_url) : mapsUrlFor(visit);
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${remote ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {(subtitle || extra) && <p className="text-xs text-muted-foreground">{subtitle}{extra}</p>}
      </div>
      {action && href && (
        <Button asChild size="sm" variant={remote ? "default" : "outline"} className="h-8 shrink-0 text-xs">
          <a href={href} target="_blank" rel="noopener noreferrer">
            {remote ? <Video className="mr-1.5 h-3.5 w-3.5" /> : <Navigation className="mr-1.5 h-3.5 w-3.5" />}{remote ? "Entrar" : "Rota"}
          </a>
        </Button>
      )}
    </div>
  );
}

/** Link da reunião de uma visita remota (só abre http/https). */
export function MeetingLink({ url }: { url: string | null | undefined }) {
  if (!url) return <span className="text-muted-foreground">Link não informado</span>;
  if (!/^https?:\/\//i.test(url)) return <span className="break-all">{url}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-start gap-1 break-all font-medium text-primary hover:underline">
      <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" />{url}
    </a>
  );
}

export function ProjectBox({ project, extra }: {
  project: { company_name: string; project_code: string | null; city: string; state: string | null; country_code: string | null };
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bus className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {project.company_name}
          {project.project_code && <span className="font-mono text-xs font-normal text-muted-foreground"> · {project.project_code}</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{formatLocation(project.city, project.state, project.country_code)}{extra}</p>
      </div>
    </div>
  );
}

export function EmptyBlock({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Linha de solicitação (lista do GP e fila do Aprovador). */
export function RequestRow({ request: r, showRequester, actions, onOpen }: {
  request: ImplantationRequest; showRequester?: boolean; actions?: ReactNode; onOpen: () => void;
}) {
  const { start, end } = periodOf(r);
  const techs = techniciansOf(r);
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className={`group flex cursor-pointer items-center gap-3 border-l-[3px] px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50 ${REQUEST_STATUS[r.status].border}`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {r.project?.company_name ?? "Projeto removido"}
          {r.project?.project_code && <span className="font-mono text-[10px] font-normal text-muted-foreground">{r.project.project_code}</span>}
          {r.visit_purpose_is_custom && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">personalizada</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          <CalendarClock className="mr-1 inline h-3 w-3" />
          {formatPeriod(start, end)} · <span className="font-medium text-foreground/80">{r.visit_purpose}</span>
          {showRequester && r.requester_name ? ` · Solicitante: ${r.requester_name}` : ""}
        </p>
        {r.status === "reprovada" && !showRequester && r.rejection_reason && (
          <p className="mt-1 truncate text-[11px] text-red-600 dark:text-red-400">
            <MessageSquareWarning className="mr-1 inline h-3 w-3" />{r.rejection_reason}
          </p>
        )}
      </div>
      {techs.length > 0 && <div className="hidden -space-x-1.5 sm:flex">{techs.map(t => <TechAvatar key={t.id} tech={t} />)}</div>}
      <StatusPill status={r.status} />
      {r.attendance && <span className="hidden rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 sm:inline">{r.attendance === "presencial" ? "Presencial" : "Remoto"}</span>}
      {actions && <div className="flex shrink-0 gap-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{actions}</div>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </li>
  );
}
