import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Clock, CalendarClock, UserX, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { differenceInDays, format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";

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

type Category = "returned" | "dzero" | "stuck" | "no_manager";

const CATEGORY_META: Record<Category, { label: string; icon: typeof Bell; color: string }> = {
  returned: { label: "Retornaram de Implementado", icon: RotateCcw, color: "text-red-600" },
  dzero: { label: "D-zero vencendo (≤7 dias)", icon: CalendarClock, color: "text-orange-600" },
  stuck: { label: "Parados há mais de 30 dias", icon: Clock, color: "text-yellow-600" },
  no_manager: { label: "Sem gestor designado", icon: UserX, color: "text-blue-600" },
};
export function AlertsBell() {
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [managerId, setManagerId] = useState<string | null>(null);
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<AlertProject[]>([]);
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
      const { data } = await supabase
        .from("projects")
        .select("id, company_name, city, state, status, d_zero_date, updated_at, manager_id, reached_implemented")
        .neq("status", "encerrado");
      if (mounted && data) setProjects(data as AlertProject[]);
    };
    load();
    const i = setInterval(load, Math.max(5, settings.pollingSeconds) * 1000);
    return () => { mounted = false; clearInterval(i); };
  }, [settings.pollingSeconds]);

  const isFullScope = isAdmin || isSuperAdmin || !managerId;

  const grouped = useMemo(() => {
    const today = new Date();
    const scoped = isFullScope ? projects : projects.filter(p => p.manager_id === managerId);
    const result: Record<Category, AlertProject[]> = { returned: [], dzero: [], stuck: [], no_manager: [] };
    for (const p of scoped) {
      if (p.reached_implemented) result.returned.push(p);
      if (p.d_zero_date) {
        const dz = new Date(p.d_zero_date + "T00:00:00");
        const diff = differenceInDays(dz, today);
        if (diff >= 0 && diff <= settings.dzeroWindowDays) result.dzero.push(p);
      }
      if (p.updated_at && differenceInDays(today, new Date(p.updated_at)) > settings.stuckDays && p.status !== "suspenso") {
        result.stuck.push(p);
      }
      if (isFullScope && !p.manager_id) result.no_manager.push(p);
    }
    return result;
  }, [projects, settings.dzeroWindowDays, settings.stuckDays, isFullScope, managerId]);

  const activeKeys = useMemo(() => {
    const keys: string[] = [];
    (Object.keys(grouped) as Category[]).forEach(cat => {
      grouped[cat].forEach(p => keys.push(`${cat}:${p.id}`));
    });
    return keys;
  }, [grouped]);

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
                    {items.slice(0, 8).map(p => (
                      <button
                        key={p.id + cat}
                        onClick={() => go(p.id)}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="text-sm font-medium truncate">{p.company_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.city}/{p.state}
                          {cat === "dzero" && p.d_zero_date && ` · D-zero ${format(new Date(p.d_zero_date + "T00:00:00"), "dd/MM")}`}
                          {cat === "stuck" && ` · parado há ${differenceInDays(new Date(), new Date(p.updated_at))}d`}
                        </div>
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
