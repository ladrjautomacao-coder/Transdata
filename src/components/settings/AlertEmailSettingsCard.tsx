import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileClock, Hourglass, Loader2, Mail, Plus, RefreshCw, Save, Send, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAlertEmailSettings, fetchRecentDeliveries, isValidEmail, saveAlertEmailSettings, sendTestAlertEmail,
  type AlertDelivery, type AlertEmailSettings,
} from "@/lib/deadlineAlerts";

const errorMessage = (e: unknown) => (e as { message?: string })?.message ?? String(e);
const KIND_LABEL: Record<AlertDelivery["kind"], string> = { implantacao: "Implantação", contrato: "Contrato", resumo: "Resumo semanal", teste: "Teste" };
const STATUS_STYLE: Record<AlertDelivery["status"], { label: string; cls: string; dot: string }> = {
  enviado: { label: "Enviado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  erro: { label: "Erro", cls: "bg-red-500/15 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  enviando: { label: "Enviando", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
};
const TESTS: { kind: "resumo" | "implantacao" | "contrato"; label: string; icon: typeof Mail }[] = [
  { kind: "resumo", label: "Resumo semanal", icon: Mail },
  { kind: "implantacao", label: "Alerta de prazo de implantação", icon: Hourglass },
  { kind: "contrato", label: "Alerta de prazo de contrato", icon: FileClock },
];

function SwitchRow({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** E-mails dos alertas de prazo (implantação e contrato), por empresa. */
export function AlertEmailSettingsCard() {
  const { profile, user } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const [state, setState] = useState<AlertEmailSettings | null>(null);
  const [saved, setSaved] = useState<AlertEmailSettings | null>(null);
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [s, d] = await Promise.all([fetchAlertEmailSettings(tenantId), fetchRecentDeliveries(tenantId)]);
      const value = s ?? { tenant_id: tenantId, enabled: false, recipients: [], include_manager: false, weekly_digest: true };
      setState(value);
      setSaved(value);
      setDeliveries(d);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  if (!tenantId) return null;
  if (loading) return <Skeleton className="mb-6 h-[260px] rounded-xl" />;
  if (loadError || !state) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <span className="flex-1">Não foi possível carregar os e-mails de alerta. {loadError}</span>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button>
      </div>
    );
  }

  const dirty = JSON.stringify(state) !== JSON.stringify(saved);
  const set = (patch: Partial<AlertEmailSettings>) => setState(s => (s ? { ...s, ...patch } : s));

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) { setEmailError("E-mail inválido."); return; }
    if (state.recipients.includes(email)) { setEmailError("Este e-mail já está na lista."); return; }
    if (state.recipients.length >= 20) { setEmailError("Limite de 20 destinatários."); return; }
    set({ recipients: [...state.recipients, email] });
    setNewEmail("");
    setEmailError(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAlertEmailSettings(state, user?.id ?? null);
      setSaved(state);
      toast.success("E-mails de alerta salvos.");
    } catch (e) {
      toast.error("Não foi possível salvar", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const test = async (kind: "resumo" | "implantacao" | "contrato") => {
    if (dirty) { toast.warning("Salve as alterações antes de enviar o teste."); return; }
    setTesting(kind);
    try {
      const r = await sendTestAlertEmail(kind);
      toast.success("E-mail de teste enviado.", { description: `Para ${r.to.join(", ")}.` });
    } catch (e) {
      toast.error("Não foi possível enviar o teste", { description: errorMessage(e) });
    } finally {
      setTesting(null);
      fetchRecentDeliveries(tenantId).then(setDeliveries).catch(() => undefined);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Mail className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">E-mails de alerta de prazo</h2>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${saved?.enabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${saved?.enabled ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
          {saved?.enabled ? "Envio ativo" : "Envio pausado"}
        </span>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Todo dia às 8h o portal envia um e-mail para cada projeto que chegou a um marco: <b className="text-foreground">implantação</b> 30 dias
            antes da finalização prevista e <b className="text-foreground">contrato</b> 12, 6 e 3 meses antes do fim. Às segundas chega também o resumo semanal.
            Cada aviso é enviado uma vez só.
          </p>

          <div>
            <Label className="text-xs" htmlFor="alert-email-new">Destinatários</Label>
            {state.recipients.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {state.recipients.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
                    {r}
                    <button type="button" onClick={() => set({ recipients: state.recipients.filter(x => x !== r) })}
                      className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15" aria-label={`Remover ${r}`} title="Remover">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Nenhum destinatário: os e-mails não serão enviados.</p>
            )}
            <div className="mt-2 flex max-w-md gap-2">
              <Input id="alert-email-new" type="email" placeholder="nome@itstransdata.com" value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailError(null); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} />
              <Button type="button" variant="outline" onClick={addEmail} disabled={!newEmail.trim()}><Plus className="mr-1.5 h-4 w-4" />Adicionar</Button>
            </div>
            {emailError && <p className="mt-1 text-[11px] font-medium text-destructive">{emailError}</p>}
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <SwitchRow id="alert-enabled" checked={state.enabled} onChange={v => set({ enabled: v })}
              label="Envio ativo" hint="Pausado, nenhum e-mail sai. O sino do portal continua mostrando os prazos." />
            <SwitchRow id="alert-digest" checked={state.weekly_digest} onChange={v => set({ weekly_digest: v })}
              label="Resumo semanal às segundas" hint="Implantações dos próximos 30 dias e contratos dos próximos 12 meses num e-mail só." />
            <SwitchRow id="alert-manager" checked={state.include_manager} onChange={v => set({ include_manager: v })}
              label="Enviar também ao GP do projeto" hint="Usa o e-mail do Gerente de Projetos cadastrado em Equipe. O resumo semanal vai só para a lista acima." />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Salvar
            </Button>
            {dirty && <span className="text-[11px] text-muted-foreground">Alterações não salvas</span>}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs font-semibold">Enviar um teste</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Vai para os destinatários salvos, com “[Teste]” no assunto. Usa os prazos reais de hoje ou um projeto de exemplo.</p>
            <div className="mt-2 grid gap-1.5">
              {TESTS.map(t => (
                <Button key={t.kind} variant="outline" size="sm" className="h-8 justify-start text-xs" disabled={!!testing || !saved?.recipients.length}
                  onClick={() => void test(t.kind)}>
                  {testing === t.kind ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <t.icon className="mr-1.5 h-3.5 w-3.5" />}{t.label}
                  <Send className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/60">
            <p className="border-b px-3 py-2 text-xs font-semibold">Últimos envios</p>
            {deliveries.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">Nenhum e-mail enviado ainda.</p>
            ) : (
              <ul className="divide-y">
                {deliveries.map(d => {
                  const st = STATUS_STYLE[d.status];
                  return (
                    <li key={d.id} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{KIND_LABEL[d.kind]} · {format(new Date(d.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      {d.subject && <p className="mt-0.5 truncate text-xs" title={d.subject}>{d.subject}</p>}
                      {d.status === "erro" && d.error && <p className="mt-0.5 text-[11px] text-destructive">{d.error}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
