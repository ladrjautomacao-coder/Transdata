import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Clock, CalendarClock, UserX, RotateCcw, Hourglass, FileClock, CornerDownRight, CheckCircle2 } from "lucide-react";
import { PENDENCY_REMINDER_DAYS, fetchPendencyAlerts, type PendencyAlertRow } from "@/lib/projectPendencies";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { differenceInDays, format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { fetchDeadlineAlerts, fmtDate, remainingShort, type DeadlineAlertRow } from "@/lib/deadlineAlerts";

interface AlertProject {
  id: string;
  company_name: string;
  city: string;
  state: string;
  status: string;
  d_zero_date: string | null;
  updated_at: string;
  manager_id: string | null;
  reached_implemented: boolean;
}

type Category = "returned" | "move_parent" | "dzero" | "impl30" | "contract" | "stuck" | "pendencia" | "no_manager";

const CATEGORY_META: Record<Category, { label: string; icon: typeof Bell; color: string }> = {
  returned: { label: "Retornaram de Implementado", icon: RotateCcw, color: "text-red-600" },
  move_parent: { label: "Card filho criado: mover para Implementado", icon: CheckCircle2, color: "text-emerald-600" },
  dzero: { label: "D-zero vencendo (≤7 dias)", icon: CalendarClock, color: "text-orange-600" },
  impl30: { label: "Prazo de implantação em até 30 dias", icon: Hourglass, color: "text-amber-600" },
  contract: { label: "Contrato termina em até 12 meses", icon: FileClock, color: "text-purple-600" },
  stuck: { label: "Parados há mais de 30 dias", icon: Clock, color: "text-yellow-600" },
  pendencia: { label: `Implantação pendente há mais de ${PENDENCY_REMINDER_DAYS} dias`, icon: CornerDownRight, color: "text-orange-600" },
  no_manager: { label: "Sem gestor designado", icon: UserX, color: "text-blue-600" },
};

/** Linha do sino: `key` muda quando o alerta muda (ex.: novo marco do contrato), para voltar a contar como não visto. */
interface BellItem { key: string; id: string; title: string; detail: string }

const placeOf = (p: { city: string | null; state: string | null }) => [p.city, p.state].filter(Boolean).join("/");

export function AlertsBell() {
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [managerId, setManagerId] = useState<string | null>(null);
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineAlertRow[]>([]);
  const [pendencies, setPendencies] = useState<PendencyAlertRow[]>([]);
  const storageKey = user ? `alerts:seen:${user.id}` : "alerts:seen:anon";
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSeen(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setSeen(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    let mounted = true;
    if (!user) { setManagerId(null); return; }
    supabase.rpc("get_my_manager_id").then(({ data }) => {
      if (mounted) setManagerId((data as string | null) ?? null);
    });
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data }, dl, pend] = await Promise.all([
        supabase
          .from("projects")
          .select("id, company_name, city, state, status, d_zero_date, updated_at, manager_id, reached_implemented")
          .neq("status", "encerrado"),
        fetchDeadlineAlerts().catch(() => null),
        fetchPendencyAlerts().catch(() => null),
      ]);
      if (!mounted) return;
      if (data) setProjects(data as AlertProject[]);
      if (dl) setDeadlines(dl);
      if (pend) setPendencies(pend);
    };
    load();
    const i = setInterval(load, Math.max(5, settings.pollingSeconds) * 1000);
    return () => { mounted = false; clearInterval(i); };
  }, [settings.pollingSeconds]);

  const isFullScope = isAdmin || isSuperAdmin || !managerId;

  const grouped = useMemo(() => {
    const today = new Date();
    const todayYmd = format(today, "yyyy-MM-dd");
    const inScope = (m: string | null) => isFullScope || m === managerId;
    const result: Record<Category, BellItem[]> = { returned: [], move_parent: [], dzero: [], impl30: [], contract: [], stuck: [], pendencia: [], no_manager: [] };
    for (const p of projects) {
      if (!inScope(p.manager_id)) continue;
      const item = (cat: Category, detail: string): BellItem => ({ key: `${cat}:${p.id}`, id: p.id, title: p.company_name, detail });
      if (p.reached_implemented) result.returned.push(item("returned", placeOf(p)));
      if (p.d_zero_date) {
        const dz = new Date(p.d_zero_date + "T00:00:00");
        const diff = differenceInDays(dz, today);
        if (diff >= 0 && diff <= settings.dzeroWindowDays) result.dzero.push(item("dzero", `${placeOf(p)} · D-zero ${format(dz, "dd/MM")}`));
      }
      if (p.updated_at && differenceInDays(today, new Date(p.updated_at)) > settings.stuckDays && p.status !== "suspenso") {
        result.stuck.push(item("stuck", `${placeOf(p)} · parado há ${differenceInDays(today, new Date(p.updated_at))}d`));
      }
      if (isFullScope && !p.manager_id) result.no_manager.push(item("no_manager", placeOf(p)));
    }
    for (const d of deadlines) {
      if (!inScope(d.manager_id)) continue;
      const impl = d.kind === "implantacao";
      const cat: Category = impl ? "impl30" : "contract";
      result[cat].push({
        key: `${cat}:${d.project_id}:${d.milestone}:${d.due_date}`,
        id: d.project_id,
        title: d.company_name,
        detail: `${placeOf(d)} · ${impl ? "prazo" : "fim do contrato"} ${fmtDate(d.due_date)} · ${remainingShort(todayYmd, d.due_date)}`,
      });
    }
    // cards filhos: o objetivo é o projeto pai ir para Implementado; aberto há muito tempo vira lembrete
    const moveListed = new Set<string>();
    for (const x of pendencies) {
      if (!inScope(x.manager_id)) continue;
      if (x.status === "implantacao" && !moveListed.has(x.project_id)) {
        moveListed.add(x.project_id);
        result.move_parent.push({ key: `move_parent:${x.project_id}`, id: x.project_id, title: x.company_name, detail: `${placeOf(x)} · card filho: ${x.title}` });
      }
      if (x.days_open > PENDENCY_REMINDER_DAYS) {
        result.pendencia.push({ key: `pendencia:${x.pendency_id}`, id: x.project_id, title: x.company_name, detail: `${x.title} · pendente há ${x.days_open} dias` });
      }
    }
    return result;
  }, [projects, deadlines, pendencies, settings.dzeroWindowDays, settings.stuckDays, isFullScope, managerId]);

  const activeKeys = useMemo(
    () => (Object.keys(grouped) as Category[]).flatMap(cat => grouped[cat].map(it => it.key)),
    [grouped]
  );

  const total = activeKeys.length;
  const unseenTotal = useMemo(
    () => activeKeys.filter(k => !seen.has(k)).length,
    [activeKeys, seen]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Mark current alerts as seen, and prune stale keys
      const active = new Set(activeKeys);
      const newSeen = new Set<string>(activeKeys);
      seen.forEach(k => { if (active.has(k)) newSeen.add(k); });
      setSeen(newSeen);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(newSeen)));
      } catch { /* ignore */ }
    }
  };

  const go = (id: string) => {
    setOpen(false);
    navigate(`/projetos/${id}`);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-white hover:bg-white/15 hover:text-white" aria-label="Alertas">
          <Bell className="h-4 w-4" />
          {unseenTotal > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-red-500 hover:bg-red-500 text-white border-0">
              {unseenTotal > 99 ? "99+" : unseenTotal}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Central de alertas</span>
          <span className="ml-auto text-xs text-muted-foreground">{total} item{total !== 1 ? "s" : ""}</span>
        </div>
        <ScrollArea className="max-h-[420px]">
          {total === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem alertas no momento. Tudo em ordem.
            </div>
          ) : (
            <div className="divide-y">
              {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
                const items = grouped[cat];
                if (items.length === 0) return null;
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                return (
                  <div key={cat} className="py-2">
                    <div className={`px-3 py-1 flex items-center gap-2 text-xs font-semibold ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                      <span className="ml-auto text-muted-foreground font-normal">{items.length}</span>
                    </div>
                    {items.slice(0, 8).map(it => (
                      <button
                        key={it.key}
                        onClick={() => go(it.id)}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="text-sm font-medium truncate">{it.title}</div>
                        <div className="text-xs text-muted-foreground">{it.detail}</div>
                      </button>
                    ))}
                    {items.length > 8 && (
                      <div className="px-3 py-1 text-[11px] text-muted-foreground">+ {items.length - 8} outros</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
