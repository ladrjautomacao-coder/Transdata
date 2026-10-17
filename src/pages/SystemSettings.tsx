import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSettings, validateSettingValue } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save, Settings as SettingsIcon } from "lucide-react";
import { AlertEmailSettingsCard } from "@/components/settings/AlertEmailSettingsCard";

interface Row {
  key: string;
  value: any;
  category: string;
  label: string;
  description: string | null;
  value_type: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  sla: "SLA do Kanban",
  alerts: "Alertas",
  storage: "Anexos / URLs",
  validation: "Validações de Formulário",
  catalog: "Catálogos",
};

export default function SystemSettings() {
  const { toast } = useToast();
  const { reload } = useSettings();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("app_settings")
      .select("*")
      .order("category")
      .order("key");
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setRows((data || []) as Row[]);
    const d: Record<string, any> = {};
    (data || []).forEach((r: Row) => { d[r.key] = r.value; });
    setDraft(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    const check = validateSettingValue(key, draft[key]);
    if (check.ok !== true) {
      toast({ title: "Valor inválido", description: check.error, variant: "destructive" });
      return;
    }
    const validValue = check.value;
    setSaving(key);
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({ value: validValue })
      .eq("key", key);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Configuração salva" });
      await reload();
    }
    setSaving(null);
  };

  const byCategory = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  const categories = Object.keys(byCategory);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
          <p className="text-sm text-muted-foreground">Ajuste SLAs, alertas, validações e catálogos sem precisar mexer no código.</p>
        </div>
      </div>

      <AlertEmailSettingsCard />

      <Tabs defaultValue={categories[0]}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {categories.map(c => (
            <TabsTrigger key={c} value={c}>{CATEGORY_LABEL[c] || c}</TabsTrigger>
          ))}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat} className="space-y-4">
            {byCategory[cat].map(r => (
              <Card key={r.key}>
                <CardHeader>
                  <CardTitle className="text-base">{r.label}</CardTitle>
                  {r.description && (
                    <CardDescription className="whitespace-pre-line leading-relaxed">
                      {r.description}
                    </CardDescription>
                  )}
                  <div className="text-xs text-muted-foreground/80 pt-1 font-mono">
                    chave: {r.key}
                  </div>
                </CardHeader>
                <CardContent>
                  {r.value_type === "number" ? (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 max-w-xs">
                        <Label className="text-xs text-muted-foreground">Valor</Label>
                        <Input
                          type="number"
                          min={0}
                          value={draft[r.key] ?? 0}
                          onChange={e => setDraft(d => ({ ...d, [r.key]: Number(e.target.value) }))}
                        />
                      </div>
                      <Button
                        onClick={() => save(r.key)}
                        disabled={saving === r.key || draft[r.key] === r.value}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {saving === r.key ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  ) : (
                    <JsonListEditor
                      value={(draft[r.key] as Array<{ value: string; label: string }>) || []}
                      onChange={v => setDraft(d => ({ ...d, [r.key]: v }))}
                      onSave={() => save(r.key)}
                      saving={saving === r.key}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function JsonListEditor({
  value, onChange, onSave, saving,
}: {
  value: Array<{ value: string; label: string }>;
  onChange: (v: Array<{ value: string; label: string }>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const add = () => {
    const v = newValue.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const l = newLabel.trim();
    if (!v || !l) return;
    if (value.some(it => it.value === v)) return;
    onChange([...value, { value: v, label: l }]);
    setNewValue("");
    setNewLabel("");
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Input value={it.value} readOnly className="bg-background font-mono text-xs" />
              <Input
                value={it.label}
                onChange={e => {
                  const copy = [...value];
                  copy[idx] = { ...it, label: e.target.value };
                  onChange(copy);
                }}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(idx)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 pt-2 border-t">
        <div className="flex-1">
          <Label className="text-xs">Identificador (slug)</Label>
          <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="ex: nota_fiscal" />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Rótulo exibido</Label>
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex: Nota Fiscal" />
        </div>
        <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Salvando..." : "Salvar lista"}
        </Button>
      </div>
    </div>
  );
}
