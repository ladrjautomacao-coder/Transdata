import { PROJECT_SEGMENTS } from "@/lib/projectSegments";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ArrowLeft, Save, Info, Upload, FileText, X, Link2, ExternalLink, Plus } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import { useSettings } from "@/contexts/SettingsContext";
import { LocationFields } from "@/components/LocationFields";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { teamRoleLabels } from "@/lib/teamRoleLabels";

type BrazilianState = Database["public"]["Enums"]["brazilian_state"];
type ProjectStatus = Database["public"]["Enums"]["project_status"];

const sanitizeCity = (v: string) => v.replace(/[^A-Za-zÀ-ÿ\s'-]/g, "");

export interface CustomFieldDef {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  required: boolean;
}

const statusLabels: Record<ProjectStatus, string> = {
  comercial: "Comercial",
  planejamento: "Planejamento",
  implantacao: "Implantação",
  encerrado: "Implementado",
  suspenso: "Outros",
};

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const branding = useTenantBranding();
  const isTransdata = branding.slug === "transdata";
  const [submitting, setSubmitting] = useState(false);

  // Campos personalizados (fora da Transdata) — configurados em Administração > Personalização.
  // Substituem Sistema/Frota, Soluções, Equipamentos, Piloto e Venda Complementar,
  // que são específicos do negócio da Transdata.
  const [customFieldsConfig, setCustomFieldsConfig] = useState<CustomFieldDef[]>([]);
  const [customData, setCustomData] = useState<Record<string, string>>({});
  useEffect(() => {
    if (isTransdata) return;
    (supabase as any).from("tenant_branding").select("custom_fields").maybeSingle().then(({ data }: any) => {
      setCustomFieldsConfig((data?.custom_fields as CustomFieldDef[]) || []);
    });
  }, [isTransdata]);

  // Dados gerais
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<BrazilianState | "">("");
  const [countryCode, setCountryCode] = useState("BR");
  const [contractDate, setContractDate] = useState<Date>();
  const [dZeroDate, setDZeroDate] = useState<Date>();
  const [handoverDate, setHandoverDate] = useState<Date>();
  const [executiveProjectDate, setExecutiveProjectDate] = useState<Date>();
  const [executiveId, setExecutiveId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planejamento");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Novos campos
  const [projectTypeId, setProjectTypeId] = useState("");
  const [projectSegment, setProjectSegment] = useState("");
  const [selectedSolutions, setSelectedSolutions] = useState<string[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [fleetSize, setFleetSize] = useState<string>("");
  const [implDeadlineDays, setImplDeadlineDays] = useState<string>("");
  const [contractualDeadlineDays, setContractualDeadlineDays] = useState<string>("");
  const [isPilot, setIsPilot] = useState(false);
  const [pilotInfo, setPilotInfo] = useState("");
  const [embeddedTraining, setEmbeddedTraining] = useState<string>("");
  const [installationTransmobile, setInstallationTransmobile] = useState<string>("0");
  const [installationClient, setInstallationClient] = useState<string>("0");
  const [complementarySale, setComplementarySale] = useState(false);
  const [complementaryFleet, setComplementaryFleet] = useState<string>("0");
  const [fleetUrbano, setFleetUrbano] = useState<string>("0");
  const [fleetSeccionado, setFleetSeccionado] = useState<string>("0");

  // Anexos por categoria
  const ATTACHMENT_CATEGORIES = [
    { key: "pasta", label: "Pasta do Projeto" },
  ] as const;

  const [attachmentLinks, setAttachmentLinks] = useState<Record<string, string[]>>({
    pasta: [],
  });
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({
    pasta: "",
  });

  // Lookups (hardcoded)
  const [executives, setExecutives] = useState<{ id: string; full_name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [solutions, setSolutions] = useState<{ id: string; name: string }[]>([]);
  const [integrations, setIntegrations] = useState<{ id: string; name: string }[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<{ id: string; name: string }[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [equipmentQty, setEquipmentQty] = useState<Record<string, string>>({});
  const [solutionFeatures, setSolutionFeatures] = useState<{ id: string; solution_id: string; name: string }[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("team_members").select("id, full_name").eq("role", "executivo_vendas").eq("active", true).then(({ data }) => setExecutives(data || []));
    supabase.from("team_members").select("id, full_name").eq("role", "gerente_projetos").eq("active", true).then(({ data }) => setManagers(data || []));
    supabase.from("products").select("id, name").eq("active", true).then(({ data }) => setProducts(data || []));
    supabase.from("project_types").select("id, name").eq("active", true).then(({ data }) => setProjectTypes(data || []));
    supabase.from("solutions").select("id, name").eq("active", true).then(({ data }) => setSolutions(data || []));
    supabase.from("integrations").select("id, name").eq("active", true).then(({ data }) => setIntegrations(data || []));
    (supabase.from("equipment_types" as any) as any).select("id, name").eq("active", true).order("sort_order").then(({ data }: any) => setEquipmentTypes(data || []));
    (supabase.from("solution_features" as any) as any).select("id, solution_id, name").eq("active", true).order("sort_order").then(({ data }: any) => setSolutionFeatures(data || []));
  }, []);

  // Datas calculadas
  const implEndDate = useMemo(() => {
    if (contractDate && implDeadlineDays && parseInt(implDeadlineDays) > 0) {
      return addDays(contractDate, parseInt(implDeadlineDays));
    }
    return null;
  }, [contractDate, implDeadlineDays]);

  const contractEndDate = useMemo(() => {
    if (contractDate && contractualDeadlineDays && parseInt(contractualDeadlineDays) > 0) {
      return addDays(contractDate, parseInt(contractualDeadlineDays));
    }
    return null;
  }, [contractDate, contractualDeadlineDays]);

  // Prévia do código do projeto
  const [codePreview, setCodePreview] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (isTransdata && (!city || !projectTypeId || (countryCode === "BR" && !state))) { setCodePreview(""); return; }
      try {
        const { data, error } = await (supabase as any).rpc("preview_project_code", {
          p_city: city, p_state: state || null, p_project_type_id: projectTypeId || null,
          p_segment: projectSegment || null, p_company_name: companyName || "", p_country: countryCode,
        });
        if (!cancelled && !error) setCodePreview(data || "");
      } catch { /* ignore */ }
    };
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [city, state, countryCode, projectTypeId, projectSegment, companyName, isTransdata]);

  // ===== Rascunho automático (localStorage) =====
  const draftKey = `transdata:new-project-draft:${user?.id || "anon"}`;
  const [draftFound, setDraftFound] = useState<{ savedAt: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const pendingDraftRef = useRef<any>(null);

  const draftData = useMemo(() => ({
    companyName, city, state, countryCode,
    contractDate: contractDate ? contractDate.toISOString() : null,
    dZeroDate: dZeroDate ? dZeroDate.toISOString() : null,
    handoverDate: handoverDate ? handoverDate.toISOString() : null,
    executiveProjectDate: executiveProjectDate ? executiveProjectDate.toISOString() : null,
    executiveId, managerId, status, selectedProducts, projectTypeId, projectSegment,
    selectedSolutions, selectedIntegrations, selectedFeatures, selectedEquipments, equipmentQty,
    fleetSize, implDeadlineDays, contractualDeadlineDays, isPilot, pilotInfo, embeddedTraining,
    installationTransmobile, installationClient, complementarySale, complementaryFleet,
    fleetUrbano, fleetSeccionado, attachmentLinks,
  }), [companyName, city, state, countryCode, contractDate, dZeroDate, handoverDate, executiveProjectDate,
    executiveId, managerId, status, selectedProducts, projectTypeId, projectSegment, selectedSolutions,
    selectedIntegrations, selectedFeatures, selectedEquipments, equipmentQty, fleetSize, implDeadlineDays,
    contractualDeadlineDays, isPilot, pilotInfo, embeddedTraining, installationTransmobile,
    installationClient, complementarySale, complementaryFleet, fleetUrbano, fleetSeccionado, attachmentLinks]);

  // Carregar rascunho existente ao abrir a tela
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) {
          pendingDraftRef.current = parsed.data;
          setDraftFound({ savedAt: parsed.savedAt });
        }
      }
    } catch { /* ignore */ }
    setDraftReady(true);
  }, [draftKey]);

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    pendingDraftRef.current = null;
    setDraftFound(null);
  };

  const restoreDraft = () => {
    const d = pendingDraftRef.current;
    if (!d) return;
    setCompanyName(d.companyName || "");
    setCity(d.city || "");
    setState(d.state || "");
    setCountryCode(d.countryCode || "BR");
    setContractDate(d.contractDate ? new Date(d.contractDate) : undefined);
    setDZeroDate(d.dZeroDate ? new Date(d.dZeroDate) : undefined);
    setHandoverDate(d.handoverDate ? new Date(d.handoverDate) : undefined);
    setExecutiveProjectDate(d.executiveProjectDate ? new Date(d.executiveProjectDate) : undefined);
    setExecutiveId(d.executiveId || "");
    setManagerId(d.managerId || "");
    setStatus(d.status || "planejamento");
    setSelectedProducts(d.selectedProducts || []);
    setProjectTypeId(d.projectTypeId || "");
    setProjectSegment(d.projectSegment || "");
    setSelectedSolutions(d.selectedSolutions || []);
    setSelectedIntegrations(d.selectedIntegrations || []);
    setSelectedFeatures(d.selectedFeatures || []);
    setSelectedEquipments(d.selectedEquipments || []);
    setEquipmentQty(d.equipmentQty || {});
    setFleetSize(d.fleetSize || "");
    setImplDeadlineDays(d.implDeadlineDays || "");
    setContractualDeadlineDays(d.contractualDeadlineDays || "");
    setIsPilot(!!d.isPilot);
    setPilotInfo(d.pilotInfo || "");
    setEmbeddedTraining(d.embeddedTraining || "");
    setInstallationTransmobile(d.installationTransmobile ?? "0");
    setInstallationClient(d.installationClient ?? "0");
    setComplementarySale(!!d.complementarySale);
    setComplementaryFleet(d.complementaryFleet ?? "0");
    setFleetUrbano(d.fleetUrbano ?? "0");
    setFleetSeccionado(d.fleetSeccionado ?? "0");
    setAttachmentLinks(d.attachmentLinks || { pasta: [] });
    setDraftFound(null);
    toast({ title: "Cadastro restaurado", description: "Os dados preenchidos anteriormente foram recuperados." });
  };

  // Salvar rascunho automaticamente (debounce)
  useEffect(() => {
    if (!draftReady || submitting) return;
    const isEmpty = !companyName && !city && !projectTypeId && !companyName && !managerId
      && !executiveId && !fleetSize && !projectSegment && selectedSolutions.length === 0
      && selectedEquipments.length === 0 && !contractDate;
    if (isEmpty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), data: draftData }));
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [draftData, draftReady, submitting, draftKey, companyName, city, projectTypeId, managerId, executiveId, fleetSize, projectSegment, selectedSolutions, selectedEquipments, contractDate]);

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    // Validações
    if (!companyName || !city || !contractDate || (countryCode === "BR" && !state)) {
      toast({ title: "Preencha os campos obrigatórios de Dados Gerais", variant: "destructive" });
      return;
    }
    if (isTransdata && !projectTypeId) {
      toast({ title: "Selecione o Tipo do Projeto", variant: "destructive" });
      return;
    }
    if (isTransdata && selectedSolutions.length === 0) {
      toast({ title: "Selecione pelo menos uma Solução", variant: "destructive" });
      return;
    }
    const fleet = fleetSize ? parseInt(fleetSize) : NaN;
    if (isTransdata && (!fleetSize || isNaN(fleet) || fleet < 1)) {
      toast({ title: "Informe a Frota Contratada (mínimo 1)", variant: "destructive" });
      return;
    }
    const urbano = parseInt(fleetUrbano) || 0;
    const seccionado = parseInt(fleetSeccionado) || 0;
    if (urbano < 0 || seccionado < 0) {
      toast({ title: "Sistema: valores não podem ser negativos", variant: "destructive" });
      return;
    }
    if (isTransdata && urbano + seccionado !== fleet) {
      toast({ title: "A soma de Urbano e Seccionado deve ser igual à Frota Contratada", variant: "destructive" });
      return;
    }
    const implDays = parseInt(implDeadlineDays);
    if (!implDeadlineDays || isNaN(implDays) || implDays < 1) {
      toast({ title: "Informe o Prazo de Implantação", variant: "destructive" });
      return;
    }
    const contrDays = parseInt(contractualDeadlineDays);
    if (!contractualDeadlineDays || isNaN(contrDays) || contrDays < 1) {
      toast({ title: "Informe o Prazo Contratual", variant: "destructive" });
      return;
    }
    if (isTransdata && isPilot && !pilotInfo.trim()) {
      toast({ title: "Informe as informações adicionais do Piloto", variant: "destructive" });
      return;
    }
    if (!isTransdata) {
      const missing = customFieldsConfig.find(f => f.required && !customData[f.id]?.trim());
      if (missing) {
        toast({ title: `Preencha o campo "${missing.label}"`, variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: project, error } = await supabase.from("projects").insert({
        company_name: companyName,
        city,
        state: countryCode === "BR" ? (state as BrazilianState) : null,
        country_code: countryCode,
        contract_date: format(contractDate, "yyyy-MM-dd"),
        d_zero_date: dZeroDate ? format(dZeroDate, "yyyy-MM-dd") : null,
        handover_date: handoverDate ? format(handoverDate, "yyyy-MM-dd") : null,
        executive_project_date: executiveProjectDate ? format(executiveProjectDate, "yyyy-MM-dd") : null,
        executive_id: executiveId || null,
        manager_id: managerId || null,
        status,
        created_by: user?.id || null,
        project_type_id: projectTypeId,
        project_segment: projectSegment || null,
        implementation_deadline_days: implDays,
        contractual_deadline_days: contrDays,
        filled_by: user?.id || null,
        ...(isTransdata ? {
          fleet_size: isNaN(fleet) ? null : fleet,
          fleet_urbano: urbano,
          fleet_seccionado: seccionado,
          is_pilot: isPilot,
          pilot_info: isPilot ? pilotInfo : null,
          embedded_install_training: embeddedTraining === "" ? null : embeddedTraining === "sim",
          installation_transmobile: parseInt(installationTransmobile) || 0,
          installation_client: parseInt(installationClient) || 0,
          complementary_sale: complementarySale,
          complementary_fleet: complementarySale ? (parseInt(complementaryFleet) || 0) : 0,
        } : {
          custom_data: customData,
        }),
      } as any).select("id").single();
      if (error) throw error;

      // Produtos
      if (selectedProducts.length > 0) {
        await supabase.from("project_products").insert(selectedProducts.map(pid => ({ project_id: project.id, product_id: pid })));
      }

      // Soluções
      if (selectedSolutions.length > 0) {
        await supabase.from("project_solutions").insert(selectedSolutions.map(sid => ({ project_id: project.id, solution_id: sid })));
      }

      // Sub-características de Soluções (ex.: AtlasMob)
      const featureRows = selectedFeatures
        .filter(fid => {
          const f = solutionFeatures.find(x => x.id === fid);
          return f && selectedSolutions.includes(f.solution_id);
        })
        .map(fid => ({ project_id: project.id, solution_feature_id: fid }));
      if (featureRows.length > 0) {
        await (supabase.from("project_solution_features" as any) as any).insert(featureRows);
      }

      // Integrações
      if (selectedIntegrations.length > 0) {
        await supabase.from("project_integrations").insert(selectedIntegrations.map(iid => ({ project_id: project.id, integration_id: iid })));
      }

      // Equipamentos
      const equipmentRows = selectedEquipments
        .map(eid => ({ project_id: project.id, equipment_type_id: eid, quantity: parseInt(equipmentQty[eid] || "0") || 0 }))
        .filter(r => r.quantity > 0);
      if (equipmentRows.length > 0) {
        await (supabase.from("project_equipments" as any) as any).insert(equipmentRows);
      }

      // Histórico: registrado automaticamente por trigger no banco

      // Links de anexos
      for (const cat of ATTACHMENT_CATEGORIES) {
        const links = attachmentLinks[cat.key] ?? [];
        for (const url of links) {
          await supabase.from("project_attachments").insert({
            project_id: project.id,
            file_name: `[${cat.label}] ${url}`,
            file_path: url,
            file_size: null,
            content_type: "link",
            uploaded_by: user?.id || null,
          });
        }
      }

      clearDraft();
      toast({ title: "Projeto criado com sucesso!" });

      navigate("/projetos/lista");
    } catch (err: any) {
      toast({ title: "Erro ao criar projeto", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const DatePicker = ({ label, date, onSelect, required }: { label: string; date?: Date; onSelect: (d?: Date) => void; required?: boolean }) => (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "dd/MM/yyyy") : "Selecione..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" captionLayout="dropdown-buttons" fromYear={2015} toYear={2035} />
          </PopoverContent>
        </Popover>
        {date && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onSelect(undefined)} title="Limpar data">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const HelperText = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
      <Info className="h-3 w-3" /> {children}
    </p>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate("/projetos")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <h1 className="text-2xl font-bold mb-6">Cadastrar Novo Projeto</h1>
      {draftFound && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-sm">
              Encontramos um cadastro não finalizado de{" "}
              {format(new Date(draftFound.savedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" size="sm" onClick={restoreDraft}>Restaurar</Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearDraft}>Descartar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* === SEÇÃO: PROJETO === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Projeto</CardTitle>
            <CardDescription>Dados gerais do projeto e contrato</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Nome da Empresa <span className="text-destructive">*</span></Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex.: TransMobile Ltda." required maxLength={settings.companyNameMax} />
            </div>
            <LocationFields
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              city={city}
              onCityChange={setCity}
              state={state}
              onStateChange={v => setState(v as BrazilianState)}
              cityMax={settings.cityMax}
            />
            <div className="space-y-2">
              <Label>Tipo do Projeto {isTransdata && <span className="text-destructive">*</span>}</Label>
              <Select value={projectTypeId || undefined} onValueChange={setProjectTypeId}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                <SelectContent>
                  {projectTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seguimento do Projeto</Label>
              <Select value={projectSegment || undefined} onValueChange={setProjectSegment}>
                <SelectTrigger><SelectValue placeholder="Selecione o seguimento..." /></SelectTrigger>
                <SelectContent>
                  {PROJECT_SEGMENTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Código do Projeto</Label>
              <Input value={codePreview || ""} readOnly placeholder="Será gerado automaticamente ao salvar" className="font-mono bg-muted/40" />
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Como o código é formado</p>
                    <p className="text-muted-foreground">
                      Cidade (3) + UF (2) + Tipo (2) + Seguimento (3) + Sequencial (4) - Nome da Empresa
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <span className="text-muted-foreground">Exemplo:</span>
                  <code className="rounded bg-background px-2 py-1 font-mono text-sm border">CRISCVENEW0001-CRICIUMA</code>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Os 4 dígitos sequenciais são atribuídos automaticamente no momento do cadastro.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Frota Contratada {isTransdata && <span className="text-destructive">*</span>}</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={fleetSize}
                onChange={e => setFleetSize(e.target.value)}
                placeholder="Ex.: 50"
              />
              <HelperText>{isTransdata ? "Quantidade de veículos do contrato" : "Opcional — preencha se fizer sentido para o seu negócio"}</HelperText>
            </div>
            <DatePicker label="Data de Contratação" date={contractDate} onSelect={setContractDate} required />
            <DatePicker label="Data D-zero" date={dZeroDate} onSelect={setDZeroDate} />
            <DatePicker label="Data Handover" date={handoverDate} onSelect={setHandoverDate} />
            {isTransdata && (
              <DatePicker label="Projeto Executivo" date={executiveProjectDate} onSelect={setExecutiveProjectDate} />
            )}
          </CardContent>
        </Card>

        {isTransdata && (
        <>
        {/* === SEÇÃO: SISTEMA === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sistema</CardTitle>
            <CardDescription>Dimensione a frota por tipo de sistema. A soma deve ser igual à Frota Contratada.</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const u = parseInt(fleetUrbano) || 0;
              const s = parseInt(fleetSeccionado) || 0;
              const f = parseInt(fleetSize) || 0;
              const sum = u + s;
              const ok = f > 0 && sum === f;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-md border p-3 space-y-2">
                      <Label>Urbano</Label>
                      <Input type="number" min={0} step={1} value={fleetUrbano} onChange={e => setFleetUrbano(e.target.value)} placeholder="0" />
                    </div>
                    <div className="rounded-md border p-3 space-y-2">
                      <Label>Seccionado</Label>
                      <Input type="number" min={0} step={1} value={fleetSeccionado} onChange={e => setFleetSeccionado(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className={cn("text-sm font-medium", ok ? "text-emerald-600" : "text-destructive")}>
                    Soma: {sum} / Frota Contratada: {f}
                    {!ok && f > 0 && " — ajuste para que os valores coincidam"}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* === SEÇÃO: SOLUÇÕES / ESCOPO === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Soluções / Escopo</CardTitle>
            <CardDescription>Soluções contratadas e produtos do projeto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Soluções <span className="text-destructive">*</span></Label>
              {solutions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma solução cadastrada.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {solutions.map(s => (
                      <div key={s.id} className="flex items-center gap-3 border rounded-md p-2">
                        <Checkbox
                          checked={selectedSolutions.includes(s.id)}
                          onCheckedChange={checked => {
                            setSelectedSolutions(prev => checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                            if (!checked) {
                              const featureIds = solutionFeatures.filter(f => f.solution_id === s.id).map(f => f.id);
                              setSelectedFeatures(prev => prev.filter(fid => !featureIds.includes(fid)));
                            }
                          }}
                        />
                        <span className="text-sm flex-1">{s.name}</span>
                      </div>
                    ))}
                  </div>
                  {solutions.filter(s => selectedSolutions.includes(s.id) && solutionFeatures.some(f => f.solution_id === s.id)).map(s => {
                    const feats = solutionFeatures.filter(f => f.solution_id === s.id);
                    return (
                      <div key={s.id} className="border rounded-md p-3 bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block">Características de {s.name}</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {feats.map(f => (
                            <div key={f.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedFeatures.includes(f.id)}
                                onCheckedChange={checked => {
                                  setSelectedFeatures(prev => checked ? [...prev, f.id] : prev.filter(x => x !== f.id));
                                }}
                              />
                              <span className="text-sm">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </>
        )}


        {isTransdata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipamentos</CardTitle>
            <CardDescription>Marque os equipamentos contratados e informe a quantidade</CardDescription>
          </CardHeader>
          <CardContent>
            {equipmentTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {equipmentTypes.map(eq => {
                  const checked = selectedEquipments.includes(eq.id);
                  return (
                    <div key={eq.id} className="flex items-center gap-3 border rounded-md p-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={c => {
                          if (c) {
                            setSelectedEquipments(prev => [...prev, eq.id]);
                            setEquipmentQty(prev => ({ ...prev, [eq.id]: prev[eq.id] || "1" }));
                          } else {
                            setSelectedEquipments(prev => prev.filter(x => x !== eq.id));
                          }
                        }}
                      />
                      <span className="text-sm flex-1">{eq.name}</span>
                      {checked && (
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={equipmentQty[eq.id] || ""}
                          onChange={e => setEquipmentQty(prev => ({ ...prev, [eq.id]: e.target.value }))}
                          placeholder="Qtd"
                          className="w-24 h-8"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}


        {/* === SEÇÃO: PRAZOS === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prazos</CardTitle>
            <CardDescription>Prazos de implantação e contrato</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prazo de Implantação (dias) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={implDeadlineDays}
                onChange={e => setImplDeadlineDays(e.target.value)}
                placeholder="Ex.: 90"
              />
              {implEndDate && (
                <HelperText>
                  Data prevista de finalização: {format(implEndDate, "dd/MM/yyyy")}
                </HelperText>
              )}
              {!contractDate && implDeadlineDays && (
                <HelperText>Preencha a Data de Contratação para calcular a data prevista</HelperText>
              )}
            </div>
            <div className="space-y-2">
              <Label>Prazo Contratual (dias) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={contractualDeadlineDays}
                onChange={e => setContractualDeadlineDays(e.target.value)}
                placeholder="Ex.: 365"
              />
              {contractEndDate && (
                <HelperText>
                  Data de finalização do contrato: {format(contractEndDate, "dd/MM/yyyy")}
                </HelperText>
              )}
              {!contractDate && contractualDeadlineDays && (
                <HelperText>Preencha a Data de Contratação para calcular a data</HelperText>
              )}
            </div>
          </CardContent>
        </Card>

        {/* === SEÇÃO: EQUIPE === */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Equipe</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{teamRoleLabels.executive ?? "Gerente Comercial"}</Label>
              <Select value={executiveId || undefined} onValueChange={setExecutiveId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {executives.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{teamRoleLabels.manager ?? "Gerente de Projetos"}</Label>
              <Select value={managerId || undefined} onValueChange={setManagerId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isTransdata && (
        <>
        {/* === SEÇÃO: PILOTO === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Piloto</CardTitle>
            <CardDescription>Marque se este projeto é um piloto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={isPilot} onCheckedChange={setIsPilot} />
              <Label>Projeto é piloto?</Label>
            </div>
            {isPilot && (
              <div className="space-y-2">
                <Label>Informação Adicional (Piloto) <span className="text-destructive">*</span></Label>
                <Textarea
                  value={pilotInfo}
                  onChange={e => setPilotInfo(e.target.value)}
                  placeholder="Descreva informações relevantes sobre o piloto..."
                  rows={3}
                  maxLength={settings.pilotInfoMax}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Treinamento de instalação embarcada</Label>
              <Select value={embeddedTraining} onValueChange={setEmbeddedTraining}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Com treinamento de instalação embarcada</SelectItem>
                  <SelectItem value="nao">Sem treinamento de instalação embarcada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


        {/* === SEÇÃO: VENDA COMPLEMENTAR === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Venda Complementar</CardTitle>
            <CardDescription>Indica se o projeto possui venda complementar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={complementarySale} onCheckedChange={setComplementarySale} />
              <Label>Possui venda complementar?</Label>
            </div>
            {complementarySale && (
              <div className="space-y-2">
                <Label>Frota Complementar</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={complementaryFleet}
                  onChange={e => setComplementaryFleet(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}

        {/* === SEÇÃO: STATUS === */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Status</CardTitle></CardHeader>
          <CardContent>
            <Select value={status} onValueChange={v => setStatus(v as ProjectStatus)}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.project_status.map(s => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* === SEÇÃO: CAMPOS PERSONALIZADOS === */}
        {!isTransdata && customFieldsConfig.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campos do seu negócio</CardTitle>
              <CardDescription>Definidos em Administração &gt; Personalização</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {customFieldsConfig.map(f => (
                <div key={f.id} className="space-y-2">
                  <Label>{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
                  {f.type === "boolean" ? (
                    <div className="flex items-center gap-3 pt-1">
                      <Switch
                        checked={customData[f.id] === "true"}
                        onCheckedChange={v => setCustomData(d => ({ ...d, [f.id]: v ? "true" : "false" }))}
                      />
                    </div>
                  ) : f.type === "select" ? (
                    <Select value={customData[f.id] || ""} onValueChange={v => setCustomData(d => ({ ...d, [f.id]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(f.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={customData[f.id] || ""}
                      onChange={e => setCustomData(d => ({ ...d, [f.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* === SEÇÃO: ANEXOS === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anexos</CardTitle>
            <CardDescription>Informe o link (URL) onde o documento está hospedado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {ATTACHMENT_CATEGORIES.map(cat => {
              const links = attachmentLinks[cat.key] ?? [];
              const addLink = () => {
                const url = (linkInputs[cat.key] || "").trim();
                if (!url) return;
                if (!/^https?:\/\//i.test(url)) {
                  toast({ title: "URL inválida", description: "A URL deve começar com http:// ou https://", variant: "destructive" });
                  return;
                }
                setAttachmentLinks(prev => ({ ...prev, [cat.key]: [...(prev[cat.key] ?? []), url] }));
                setLinkInputs(prev => ({ ...prev, [cat.key]: "" }));
              };
              const removeLink = (idx: number) => {
                setAttachmentLinks(prev => ({ ...prev, [cat.key]: prev[cat.key].filter((_, i) => i !== idx) }));
              };
              return (
                <div key={cat.key} className="space-y-2">
                  <Label className="text-sm font-medium">{cat.label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={linkInputs[cat.key] || ""}
                      onChange={e => setLinkInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                      placeholder="https://..."
                    />
                    <Button type="button" size="sm" variant="outline" onClick={addLink}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                  {links.length > 0 ? (
                    <div className="space-y-1.5">
                      {links.map((url, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{url}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button type="button" size="sm" variant="outline" asChild>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Acessar
                              </a>
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLink(idx)}>
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum link cadastrado</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* === SEÇÃO: AUDITORIA === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Auditoria</CardTitle>
            <CardDescription>Responsável pelo preenchimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Preenchido por</Label>
              <Input
                value={user?.email || "Usuário logado"}
                disabled
                className="bg-muted"
              />
              <HelperText>Registrado automaticamente com o usuário logado</HelperText>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/projetos")}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            <Save className="mr-2 h-4 w-4" /> {submitting ? "Salvando..." : "Salvar Projeto"}
          </Button>
        </div>
      </form>
    </div>
  );
}
