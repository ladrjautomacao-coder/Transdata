import { useEffect, useState } from "react";
import { loadCityIndex, type CityIndex } from "@/lib/agendaTecnica";

/** Coordenadas dos municípios (carregadas sob demanda). Enquanto carrega, ou se falhar, fica null: a tela segue sem os km. */
export function useCityIndex(enabled = true) {
  const [index, setIndex] = useState<CityIndex | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadCityIndex().then(i => { if (alive) setIndex(i); }).catch(() => undefined);
    return () => { alive = false; };
  }, [enabled]);
  return index;
}
