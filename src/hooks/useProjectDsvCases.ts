import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/implantationScheduling";
import { fetchProjectDsvCases, type DsvCase } from "@/lib/dsvCases";

/** Casos DSV de um projeto (null = carregando). */
export function useProjectDsvCases(projectId: string | null | undefined, enabled = true) {
  const [cases, setCases] = useState<DsvCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!projectId) return;
    setError(null);
    fetchProjectDsvCases(projectId).then(setCases).catch(e => { setError(errorMessage(e)); setCases([]); });
  }, [projectId]);
  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  return { cases, error, reload };
}

/** Quem pode registrar e resolver casos: administrador ou o GP do projeto (o banco confere de novo). */
export function useCanEditProject(managerId: string | null | undefined) {
  const { user, isAdmin } = useAuth();
  const [myManagerId, setMyManagerId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_manager_id").then(({ data }) => setMyManagerId((data as string | null) ?? null));
  }, [user]);
  return isAdmin || (!!myManagerId && myManagerId === managerId);
}
