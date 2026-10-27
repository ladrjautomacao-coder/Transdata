import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------
export interface AttachmentCategory { value: string; label: string }
export interface TeamRole { value: string; label: string }

export interface AppSettings {
  // SLA Kanban (em dias)
  slaGreenMaxDays: number;
  slaYellowMaxDays: number;
  slaOrangeMaxDays: number;
  // Alertas
  dzeroWindowDays: number;
  stuckDays: number;
  pollingSeconds: number;
  // Storage
  previewUrlTtl: number;
  downloadUrlTtl: number;
  // Validações
  companyNameMax: number;
  cityMax: number;
  pilotInfoMax: number;
  kanbanNoteMax: number;
  // Catálogos
  attachmentCategories: AttachmentCategory[];
  teamRoles: TeamRole[];
}

// ---------------------------------------------------------------------------
// Defaults — fonte da verdade caso a chave esteja faltando ou inválida
// ---------------------------------------------------------------------------
export const DEFAULT_SETTINGS: AppSettings = {
  slaGreenMaxDays: 7,
  slaYellowMaxDays: 15,
  slaOrangeMaxDays: 30,
  dzeroWindowDays: 7,
  stuckDays: 30,
  pollingSeconds: 60,
  previewUrlTtl: 60,
  downloadUrlTtl: 300,
  companyNameMax: 200,
  cityMax: 100,
  pilotInfoMax: 2000,
  kanbanNoteMax: 500,
  attachmentCategories: [
    { value: "contrato", label: "Contrato" },
    { value: "proposta", label: "Proposta Comercial" },
    { value: "ata", label: "Ata de Reunião" },
    { value: "outros", label: "Demais Documentos" },
  ],
  teamRoles: [
    { value: "executivo_vendas", label: "Executivo de Vendas" },
    { value: "gerente_projetos", label: "Gerente de Projetos" },
    { value: "coordenador_implantacao", label: "Coordenador de Implantação" },
    { value: "implantador", label: "Implantador" },
    { value: "gerente_operacoes", label: "Gerente de Operações" },
    { value: "gerente_relacionamento", label: "Gerente de Relacionamento" },
    { value: "analista", label: "Analista" },
    { value: "assistente", label: "Assistente" },
  ],
};

// ---------------------------------------------------------------------------
// Schemas Zod — uma validação por categoria
// ---------------------------------------------------------------------------
const positiveInt = z
  .union([z.number(), z.string()])
  .transform(v => (typeof v === "string" ? Number(v) : v))
  .pipe(z.number().int().positive());

const nonNegativeInt = z
  .union([z.number(), z.string()])
  .transform(v => (typeof v === "string" ? Number(v) : v))
  .pipe(z.number().int().nonnegative());

const slug = z
  .string()
  .trim()
  .min(1, "Identificador vazio")
  .max(64, "Identificador muito longo")
  .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _");

const label = z.string().trim().min(1, "Rótulo vazio").max(120, "Rótulo muito longo");

const catalogItemSchema = z.object({ value: slug, label });

const catalogListSchema = z
  .array(catalogItemSchema)
  .min(1, "A lista precisa ter pelo menos 1 item")
  .max(50, "Limite de 50 itens")
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (const it of arr) {
      if (seen.has(it.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Identificador duplicado: ${it.value}`,
        });
      }
      seen.add(it.value);
    }
  });

// Mapa chave -> { campo no AppSettings, schema, mensagem de erro }
interface KeySpec {
  field: keyof AppSettings;
  schema: z.ZodTypeAny;
}

const KEY_SPEC: Record<string, KeySpec> = {
  "sla.kanban.green_max_days":        { field: "slaGreenMaxDays",  schema: positiveInt.pipe(z.number().max(365)) },
  "sla.kanban.yellow_max_days":       { field: "slaYellowMaxDays", schema: positiveInt.pipe(z.number().max(365)) },
  "sla.kanban.orange_max_days":       { field: "slaOrangeMaxDays", schema: positiveInt.pipe(z.number().max(365)) },
  "alerts.dzero_window_days":         { field: "dzeroWindowDays",  schema: nonNegativeInt.pipe(z.number().max(365)) },
  "alerts.stuck_days":                { field: "stuckDays",        schema: positiveInt.pipe(z.number().max(3650)) },
  "alerts.polling_seconds":           { field: "pollingSeconds",   schema: positiveInt.pipe(z.number().min(5).max(3600)) },
  "storage.preview_url_ttl_seconds":  { field: "previewUrlTtl",    schema: positiveInt.pipe(z.number().min(10).max(86400)) },
  "storage.download_url_ttl_seconds": { field: "downloadUrlTtl",   schema: positiveInt.pipe(z.number().min(10).max(86400)) },
  "validation.company_name_max":      { field: "companyNameMax",   schema: positiveInt.pipe(z.number().min(10).max(1000)) },
  "validation.city_max":              { field: "cityMax",          schema: positiveInt.pipe(z.number().min(2).max(200)) },
  "validation.pilot_info_max":        { field: "pilotInfoMax",     schema: positiveInt.pipe(z.number().min(10).max(20000)) },
  "validation.kanban_note_max":       { field: "kanbanNoteMax",    schema: positiveInt.pipe(z.number().min(10).max(5000)) },
  "attachment.categories":            { field: "attachmentCategories", schema: catalogListSchema },
  "team.roles":                       { field: "teamRoles",        schema: catalogListSchema },
};

// Cross-field check para SLAs (green < yellow < orange)
function enforceSlaOrder(settings: AppSettings): AppSettings {
  let { slaGreenMaxDays: g, slaYellowMaxDays: y, slaOrangeMaxDays: o } = settings;
  if (y <= g) y = g + 1;
  if (o <= y) o = y + 1;
  return { ...settings, slaGreenMaxDays: g, slaYellowMaxDays: y, slaOrangeMaxDays: o };
}

/**
 * Valida um valor para uma chave conhecida.
 * Retorna o valor validado (já transformado) ou um erro descritivo.
 * Use antes de salvar no banco para impedir lixo.
 */
export type SettingValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function validateSettingValue(key: string, rawValue: unknown): SettingValidationResult {
  const spec = KEY_SPEC[key];
  if (!spec) return { ok: false, error: `Chave desconhecida: ${key}` };
  const result = spec.schema.safeParse(rawValue);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first?.message || "Valor inválido" };
  }
  return { ok: true, value: result.data };
}

export function getSettingSchema(key: string): z.ZodTypeAny | null {
  return KEY_SPEC[key]?.schema ?? null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  reload: () => Promise<void>;
  validate: typeof validateSettingValue;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  reload: async () => {},
  validate: validateSettingValue,
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("app_settings").select("key, value");
    const merged: AppSettings = { ...DEFAULT_SETTINGS };

    if (data) {
      for (const row of data as Array<{ key: string; value: unknown }>) {
        const spec = KEY_SPEC[row.key];
        if (!spec) continue;
        const parsed = spec.schema.safeParse(row.value);
        if (parsed.success) {
          (merged as any)[spec.field] = parsed.data;
        } else {
          // Valor corrompido no banco: mantém default e avisa em dev
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn(
              `[settings] valor inválido para "${row.key}", usando default. Erro:`,
              parsed.error.issues[0]?.message,
            );
          }
        }
      }
    }

    setSettings(enforceSlaOrder(merged));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingsContext.Provider value={{ settings, loading, reload: load, validate: validateSettingValue }}>
      {children}
    </SettingsContext.Provider>
  );
}
