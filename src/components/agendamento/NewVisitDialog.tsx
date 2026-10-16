import { useEffect, useMemo, useState } from "react";
import { FolderSearch, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatLocation } from "@/lib/location";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import { HIDDEN_BY_DEFAULT_STATUSES, errorMessage, type EligibleProject } from "@/lib/implantationScheduling";

const LIMIT = 60;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Nova visita" a partir da agenda: escolhe o projeto e segue para o formulário de solicitação. */
export function NewVisitDialog({ open, onOpenChange, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; onPick: (p: EligibleProject) => void;
}) {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<EligibleProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || !profile) return;
    setQ(""); setError(null);
    let alive = true;
    supabase.from("projects")
      .select("id, company_name, project_code, city, state, country_code, status, sub_phase, manager_id, manager:team_members!projects_manager_id_fkey(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .order("company_name")
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) { setError(errorMessage(err)); setProjects([]); return; }
        setProjects((data as unknown as EligibleProject[]) ?? []);
      });
    return () => { alive = false; };
  }, [open, profile]);

  const list = useMemo(() => {
    if (!projects) return [];
    const term = norm(q.trim());
    const base = term
      ? projects.filter(p => norm(`${p.company_name} ${p.project_code ?? ""} ${p.city} ${p.state ?? ""} ${p.manager?.full_name ?? ""}`).includes(term))
      : projects.filter(p => !HIDDEN_BY_DEFAULT_STATUSES.includes(p.status))
        .sort((a, b) => (a.sub_phase === "cronograma_visita" ? 0 : 1) - (b.sub_phase === "cronograma_visita" ? 0 : 1));
    return base.slice(0, LIMIT);
  }, [projects, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova visita</DialogTitle>
          <DialogDescription>Escolha o projeto. Em seguida, informe o objetivo e o período da visita.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente, código, cidade ou GP" className="h-10 pl-9" />
        </div>
        <div className="-mx-6 min-h-[200px] flex-1 overflow-y-auto border-t border-border/60">
          {projects === null ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando projetos…</p>
          ) : error ? (
            <p className="px-6 py-8 text-center text-sm text-destructive">{error}</p>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <FolderSearch className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{q ? `Nenhum projeto corresponde a “${q}”.` : "Nenhum projeto em andamento."}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {list.map(p => {
                const phase = p.sub_phase ? subPhasesByStatus[p.status as keyof typeof subPhasesByStatus]?.find(s => s.id === p.sub_phase)?.label : null;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-6 py-2.5 transition-colors hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.company_name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.project_code && <span className="font-mono">{p.project_code} · </span>}
                        {formatLocation(p.city, p.state, p.country_code)} · <span className={p.sub_phase === "cronograma_visita" ? "font-semibold text-primary" : ""}>{phase ?? statusLabels[p.status as keyof typeof statusLabels] ?? p.status}</span>
                        {p.manager?.full_name ? ` · GP: ${p.manager.full_name}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => { onOpenChange(false); onPick(p); }}>Escolher</Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {projects && !q && projects.length > list.length && (
          <p className="text-[11px] text-muted-foreground">Mostrando projetos em andamento. Use a busca para encontrar qualquer projeto da base, inclusive implementados (visita extra).</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
