import { useCallback, useEffect, useState } from "react";
import { fetchCustomHolidays, type Holiday } from "@/lib/holidays";

/** Feriados cadastrados (empresa/estadual/municipal). Falha na leitura não derruba a tela: fica só com os nacionais. */
export function useCustomHolidays(enabled = true) {
  const [custom, setCustom] = useState<Holiday[]>([]);
  const reload = useCallback(async () => {
    try { setCustom(await fetchCustomHolidays()); } catch { setCustom([]); }
  }, []);
  useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
  return { custom, reload };
}
