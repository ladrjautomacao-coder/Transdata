import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { DEFAULT_STATUS_LABELS, applyStatusLabelOverrides } from "@/lib/statusLabels";
import { applyTeamRoleLabelOverrides } from "@/lib/teamRoleLabels";
import type { CustomFieldDef } from "@/pages/NewProject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface ProjectType {
  id: string;
  name: string;
  short_code: string;
  active: boolean;
}

const STATUS_KEYS = Object.keys(DEFAULT_STATUS_LABELS) as (keyof typeof DEFAULT_STATUS_LABELS)[];

const FIELD_TYPE_LABEL: Record<CustomFieldDef["type"], string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Lista de opções",
  boolean: "Sim / Não",
};

const newField = (): CustomFieldDef => ({
  id: crypto.randomUUID(),
  label: "",
  type: "text",
  required: false,
});

export default function ProjectTypes() {
  const { toast } = useToast();
  const branding = useTenantBranding();
  const isTransdata = branding.slug === "transdata";
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [stageLabels, setStageLabels] = useState<Record<string, string>>({ ...DEFAULT_STATUS_LABELS });
  const [savingStages, setSavingStages] = useState(false);

  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [savingCustomFields, setSavingCustomFields] = useState(false);

  const [teamLabels, setTeamLabels] = useState<{ executive: string; manager: string }>({ executive: "", manager: "" });
  const [savingTeamLabels, setSavingTeamLabels] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("project_types").select("id, name, short_code, active").order("name");
    setTypes((data as any) || []);
    setLoading(false);
  };

  const loadStageLabels = async () => {
    const { data } = await (supabase as any).from("tenant_branding").select("status_labels, custom_fields, team_role_labels").maybeSingle();
    setStageLabels({ ...DEFAULT_STATUS_LABELS, ...((data as any)?.status_labels || {}) });
    setCustomFields(((data as any)?.custom_fields as CustomFieldDef[]) || []);
    const savedTeam = (data as any)?.team_role_labels as { executive?: string; manager?: string } | null;
    setTeamLabels({ executive: savedTeam?.executive || "", manager: savedTeam?.manager || "" });
  };

  useEffect(() => {
    load();
    if (!isTransdata) loadStageLabels();
  }, [isTransdata]);

  const saveCustomFields = async () => {
    if (customFields.some(f => !f.label.trim())) {
      toast({ title: "Todo campo precisa de um nome", variant: "destructive" });
      return;
    }
    setSavingCustomFields(true);
    const { error } = await (supabase as any).from("tenant_branding").update({ custom_fields: customFields });
    if (error) toast({ title: "Erro ao salvar campos", description: error.message, variant: "destructive" });
    else toast({ title: "Campos personalizados atualizados!" });
    setSavingCustomFields(false);
  };

  const updateCustomField = (id: string, patch: Partial<CustomFieldDef>) => {
    setCustomFields(fields => fields.map(f => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(fields => fields.filter(f => f.id !== id));
  };

  const moveCustomField = (index: number, dir: -1 | 1) => {
    setCustomFields(fields => {
      const next = [...fields];
      const target = index + dir;
      if (target < 0 || target >= next.length) return fields;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveTeamLabels = async () => {
    setSavingTeamLabels(true);
    const payload = { executive: teamLabels.executive.trim() || undefined, manager: teamLabels.manager.trim() || undefined };
    const { error } = await (supabase as any).from("tenant_branding").update({ team_role_labels: payload });
    if (error) {
      toast({ title: "Erro ao salvar nomes da equipe", description: error.message, variant: "destructive" });
    } else {
      applyTeamRoleLabelOverrides(payload);
      toast({ title: "Nomes da equipe atualizados!" });
    }
    setSavingTeamLabels(false);
  };

  const saveStageLabels = async () => {
    setSavingStages(true);
    const { error } = await (supabase as any).from("tenant_branding").update({ status_labels: stageLabels });
    if (error) {
      toast({ title: "Erro ao salvar etapas", description: error.message, variant: "destructive" });
    } else {
      applyStatusLabelOverrides(stageLabels);
      toast({ title: "Etapas do Kanban atualizadas!" });
    }
    setSavingStages(false);
  };

  const resetForm = () => { setName(""); setShortCode(""); };

  const handleAdd = async () => {
    if (!name.trim() || !shortCode.trim()) {
      toast({ title: "Informe o nome e a sigla", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const code = shortCode.trim().toUpperCase();
    const { error } = await supabase.from("project_types").insert({
      name: name.trim(),
      code,
      short_code: code,
    });
    if (error) {
      toast({ title: "Erro ao criar tipo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tipo de projeto criado!" });
      resetForm();
      setOpen(false);
      load();
    }
    setSubmitting(false);
  };

  const toggleActive = async (t: ProjectType) => {
    await supabase.from("project_types").update({ active: !t.active }).eq("id", t.id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Personalização</h1>
          <p className="text-sm text-muted-foreground">Tipos de projeto, etapas do Kanban e campos extras — do jeito do seu negócio.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Novo Tipo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Tipo de Projeto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Ex: Implantação" />
              </div>
              <div className="space-y-2">
                <Label>Sigla *</Label>
                <Input
                  value={shortCode}
                  onChange={e => setShortCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  placeholder="Ex: IMP"
                />
                <p className="text-xs text-muted-foreground">Aparece dentro do código automático do projeto.</p>
              </div>
              <Button onClick={handleAdd} disabled={submitting} className="w-full">
                {submitting ? "Criando..." : "Criar tipo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tipos de Projeto</CardTitle>
          <CardDescription>Usados no cadastro de projeto e no código gerado automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : types.length === 0 ? (
            <div className="py-12">
              <EmptyState
                type="projects"
                title="Nenhum tipo de projeto cadastrado"
                description="Crie o primeiro tipo pra liberar o cadastro de projetos."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sigla</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.short_code}</TableCell>
                    <TableCell><Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(t)}>
                        {t.active ? "Desativar" : "Reativar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isTransdata && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Etapas do Kanban</CardTitle>
            <CardDescription>Renomeie as etapas pra linguagem do seu negócio. A ordem e a lógica continuam as mesmas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {STATUS_KEYS.map(key => (
                <div key={key} className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">{DEFAULT_STATUS_LABELS[key]}</Label>
                  <Input
                    value={stageLabels[key] ?? ""}
                    onChange={e => setStageLabels(s => ({ ...s, [key]: e.target.value }))}
                    maxLength={40}
                  />
                </div>
              ))}
            </div>
            <Button onClick={saveStageLabels} disabled={savingStages}>
              {savingStages ? "Salvando..." : "Salvar etapas"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isTransdata && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Nomes da Equipe</CardTitle>
            <CardDescription>
              Renomeie os dois papéis responsáveis pelo projeto. Aparece no cadastro, detalhe,
              dashboard, listas, filtros e nos relatórios exportados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Papel 1 (comercial/vendas)</Label>
                <Input
                  value={teamLabels.executive}
                  onChange={e => setTeamLabels(t => ({ ...t, executive: e.target.value }))}
                  maxLength={40}
                  placeholder="Ex: Executivo de Vendas"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Papel 2 (responsável pelo projeto)</Label>
                <Input
                  value={teamLabels.manager}
                  onChange={e => setTeamLabels(t => ({ ...t, manager: e.target.value }))}
                  maxLength={40}
                  placeholder="Ex: Gerente de Projetos"
                />
              </div>
            </div>
            <Button onClick={saveTeamLabels} disabled={savingTeamLabels}>
              {savingTeamLabels ? "Salvando..." : "Salvar nomes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isTransdata && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Campos do seu cadastro de projeto</CardTitle>
            <CardDescription>
              Substituem Sistema/Frota, Soluções, Equipamentos, Piloto e Venda Complementar — monte do jeito
              do seu negócio. Empresa, Cidade, Estado, datas, prazos, responsável, status e anexos continuam fixos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {customFields.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum campo personalizado ainda.</p>
            )}
            {customFields.map((f, i) => (
              <div key={f.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label className="text-xs text-muted-foreground">Nome do campo</Label>
                    <Input
                      value={f.label}
                      onChange={e => updateCustomField(f.id, { label: e.target.value })}
                      maxLength={60}
                      placeholder="Ex: Número do contrato"
                    />
                  </div>
                  <div className="w-[160px] space-y-2">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={f.type} onValueChange={v => updateCustomField(f.id, { type: v as CustomFieldDef["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch checked={f.required} onCheckedChange={v => updateCustomField(f.id, { required: v })} />
                    <Label className="text-xs text-muted-foreground">Obrigatório</Label>
                  </div>
                  <div className="flex items-center gap-1 pb-1">
                    <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveCustomField(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={i === customFields.length - 1} onClick={() => moveCustomField(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeCustomField(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {f.type === "select" && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Opções (uma por linha)</Label>
                    <textarea
                      className="w-full rounded-md border bg-background p-2 text-sm"
                      rows={3}
                      value={(f.options || []).join("\n")}
                      onChange={e => updateCustomField(f.id, { options: e.target.value.split("\n").map(o => o.trim()).filter(Boolean) })}
                      placeholder={"Opção 1\nOpção 2"}
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setCustomFields(f => [...f, newField()])}>
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar campo
              </Button>
              <Button onClick={saveCustomFields} disabled={savingCustomFields}>
                {savingCustomFields ? "Salvando..." : "Salvar campos"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
