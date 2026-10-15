import { supabase } from "@/integrations/supabase/client";

// implantation_holidays ainda não está em types.ts (mesmo padrão de implantationScheduling.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Feriado exibido na agenda. Nacionais são calculados aqui; os demais vêm de implantation_holidays. */
export interface Holiday {
  date: string; // AAAA-MM-DD (data local)
  name: string;
  scope: "nacional" | "empresa" | "estadual" | "municipal";
  /** Ponto facultativo (Carnaval, Corpus Christi): destacado, mas com aviso mais leve. */
  optional?: boolean;
  state?: string | null;
  city?: string | null;
  id?: string;
}

export const HOLIDAY_SCOPE_LABEL: Record<Holiday["scope"], string> = {
  nacional: "Feriado nacional",
  empresa: "Feriado da empresa",
  estadual: "Feriado estadual",
  municipal: "Feriado municipal",
};

const p2 = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Feriados nacionais (Lei 662/1949 e posteriores) + pontos facultativos usuais. */
export function nationalHolidays(year: number): Holiday[] {
  const e = easter(year);
  const fixed: [number, number, string][] = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência do Brasil"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [11, 20, "Dia Nacional de Zumbi e da Consciência Negra"],
    [12, 25, "Natal"],
  ];
  return [
    ...fixed.map(([m, d, name]) => ({ date: `${year}-${p2(m)}-${p2(d)}`, name, scope: "nacional" as const })),
    { date: dateKey(plusDays(e, -48)), name: "Carnaval", scope: "nacional", optional: true },
    { date: dateKey(plusDays(e, -47)), name: "Carnaval", scope: "nacional", optional: true },
    { date: dateKey(plusDays(e, -2)), name: "Sexta-feira Santa", scope: "nacional" },
    { date: dateKey(plusDays(e, 60)), name: "Corpus Christi", scope: "nacional", optional: true },
  ];
}

export async function fetchCustomHolidays(): Promise<Holiday[]> {
  const { data, error } = await db
    .from("implantation_holidays")
    .select("id, holiday_date, name, scope, state, city")
    .order("holiday_date");
  if (error) throw error;
  return ((data ?? []) as { id: string; holiday_date: string; name: string; scope: Holiday["scope"]; state: string | null; city: string | null }[])
    .map(r => ({ id: r.id, date: r.holiday_date, name: r.name, scope: r.scope, state: r.state, city: r.city }));
}

export async function saveCustomHoliday(h: { holiday_date: string; name: string; scope: "empresa" | "estadual" | "municipal"; state: string | null; city: string | null }) {
  const { error } = await db.from("implantation_holidays").insert(h);
  if (error) throw error;
}

export async function deleteCustomHoliday(id: string) {
  const { error } = await db.from("implantation_holidays").delete().eq("id", id);
  if (error) throw error;
}

/** Nacionais dos anos pedidos + cadastrados, agrupados por dia (AAAA-MM-DD). */
export function holidaysByDay(years: number[], custom: Holiday[]) {
  const map = new Map<string, Holiday[]>();
  for (const h of [...years.flatMap(nationalHolidays), ...custom]) {
    const list = map.get(h.date) ?? [];
    list.push(h);
    map.set(h.date, list);
  }
  return map;
}

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Feriados que afetam uma visita: nacionais, da empresa, da UF e da cidade do projeto. */
export function holidaysForVisit(start: Date, end: Date, custom: Holiday[], place?: { city?: string | null; state?: string | null }) {
  const out: Holiday[] = [];
  const years = new Set<number>();
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d = plusDays(d, 1)) years.add(d.getFullYear());
  const byDay = holidaysByDay([...years], custom);
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d = plusDays(d, 1)) {
    for (const h of byDay.get(dateKey(d)) ?? []) {
      const applies = h.scope === "nacional" || h.scope === "empresa"
        || (h.scope === "estadual" && norm(h.state) === norm(place?.state))
        || (h.scope === "municipal" && norm(h.state) === norm(place?.state) && norm(h.city) === norm(place?.city));
      if (applies) out.push(h);
    }
  }
  return out;
}

export const formatHolidayDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
