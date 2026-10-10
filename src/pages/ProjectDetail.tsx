import { PROJECT_SEGMENTS, projectSegmentLabel } from "@/lib/projectSegments";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ArrowLeft, Edit2, Save, X, CalendarIcon, Upload, FileText, Trash2, Info, Download, Eye, PlusCircle, RefreshCw, User, Link2, ExternalLink } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { LocationFields } from "@/components/LocationFields";
import { MarkdownNoteEditor, NoteContent } from "@/components/MarkdownNoteEditor";
import { formatLocation } from "@/lib/location";
import type { Database } from "@/integrations/supabase/types";
import { useSettings } from "@/contexts/SettingsContext";
import { subPhasesByStatus } from "@/pages/ProjectManagement";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import { useNoteDraft } from "@/hooks/useNoteDraft";

type ProjectStatus = Database["public"]["Enums"]["project_status"];
type BrazilianState = Database["public"]["Enums"]["brazilian_state"];

const statusLabels: Record<ProjectStatus, string> = {
  comercial: "Comercial", planejamento: "Planejamento", implantacao: "Implantação", encerrado: "Implementado", suspenso: "Outros",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = (location.state as any)?.from || "/projetos/lista";
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state - existing
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("BR");
  const [state, setState] = useState<BrazilianState>("SP");
  const [contractDate, setContractDate] = useState<Date>();
  const [dZeroDate, setDZeroDate] = useState<Date>();
  const [handoverDate, setHandoverDate] = useState<Date>();
  const [executiveProjectDate, setExecutiveProjectDate] = useState<Date>();
  const [executiveId, setExecutiveId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planejamento");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Edit state - new fields
  const [projectTypeId, setProjectTypeId] = useState("");
  const [projectSegment, setProjectSegment] = useState("");
  const [selectedSolutions, setSelectedSolutions] = useState<string[]>([]);
  const [fleetSize, setFleetSize] = useState<string>("");
  const [fleetUrbano, setFleetUrbano] = useState<string>("0");
  const [fleetSeccionado, setFleetSeccionado] = useState<string>("0");
  const [implDeadlineDays, setImplDeadlineDays] = useState<string>("");
  const [contractualDeadlineDays, setContractualDeadlineDays] = useState<string>("");
  const [isPilot, setIsPilot] = useState(false);
  const [pilotInfo, setPilotInfo] = useState("");
  const [embeddedTraining, setEmbeddedTraining] = useState<string>("");
  const [installationTransmobile, setInstallationTransmobile] = useState<string>("0");
  const [installationClient, setInstallationClient] = useState<string>("0");
  const [complementarySale, setComplementarySale] = useState(false);
  const [complementaryFleet, setComplementaryFleet] = useState<string>("0");
  const [implementedFleet, setImplementedFleet] = useState<string>("0");
  const [observations, setObservations] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const { value: newNote, update: setNewNote, clear: clearNoteDraft, draftSavedAt: noteDraftSavedAt } = useNoteDraft(id);
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [updatingNote, setUpdatingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<any | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  // Lookups
  const [executives, setExecutives] = useState<{ id: string; full_name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [allSolutions, setAllSolutions] = useState<{ id: string; name: string }[]>([]);
  const [allIntegrations, setAllIntegrations] = useState<{ id: string; name: string }[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [allEquipments, setAllEquipments] = useState<{ id: string; name: string }[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [equipmentQty, setEquipmentQty] = useState<Record<string, string>>({});
  const [originalEquipments, setOriginalEquipments] = useState<{ id: string; quantity: number }[]>([]);
  const [solutionFeatures, setSolutionFeatures] = useState<{ id: string; solution_id: string; name: string }[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [originalFeatures, setOriginalFeatures] = useState<string[]>([]);

  const implEndDate = useMemo(() => {
    if (contractDate && implDeadlineDays && parseInt(implDeadlineDays) > 0) return addDays(contractDate, parseInt(implDeadlineDays));
    return null;
  }, [contractDate, implDeadlineDays]);

  const contractEndDate = useMemo(() => {
    if (contractDate && contractualDeadlineDays && parseInt(contractualDeadlineDays) > 0) return addDays(contractDate, parseInt(contractualDeadlineDays));
    return null;
  }, [contractDate, contractualDeadlineDays]);

  const loadProject = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("projects")
      .select("*, executive:team_members!projects_executive_id_fkey(id,full_name), manager:team_members!projects_manager_id_fkey(id,full_name), project_products(product_id, product:products(id,name)), project_type:project_types(id,name), project_solutions(solution_id, solution:solutions(id,name))")
      .eq("id", id).single();
    if (data) {
      setProject(data);
      setCompanyName(data.company_name);
      setCity(data.city);
      setCountryCode(data.country_code || "BR");
      setState(data.state);
      setContractDate(new Date(data.contract_date + "T00:00:00"));
      setDZeroDate(data.d_zero_date ? new Date(data.d_zero_date + "T00:00:00") : undefined);
      setHandoverDate(data.handover_date ? new Date(data.handover_date + "T00:00:00") : undefined);
      setExecutiveProjectDate(data.executive_project_date ? new Date(data.executive_project_date + "T00:00:00") : undefined);
      setExecutiveId(data.executive?.id || "");
      setManagerId(data.manager?.id || "");
      setStatus(data.status);
      setSelectedProducts(data.project_products?.map((pp: any) => pp.product_id) || []);
      setProjectTypeId(data.project_type_id || "");
      setProjectSegment((data as any).project_segment || "");
      setSelectedSolutions(data.project_solutions?.map((ps: any) => ps.solution_id) || []);
      setFleetSize(data.fleet_size?.toString() || "");
      setFleetUrbano((data as any).fleet_urbano?.toString() || "0");
      setFleetSeccionado((data as any).fleet_seccionado?.toString() || "0");
      setImplDeadlineDays(data.implementation_deadline_days?.toString() || "");
      setContractualDeadlineDays(data.contractual_deadline_days?.toString() || "");
      setIsPilot(data.is_pilot || false);
      setEmbeddedTraining((data as any).embedded_install_training === null || (data as any).embedded_install_training === undefined ? "" : ((data as any).embedded_install_training ? "sim" : "nao"));
      setPilotInfo(data.pilot_info || "");
      setInstallationTransmobile(data.installation_transmobile?.toString() || "0");
      setInstallationClient(data.installation_client?.toString() || "0");
      setComplementarySale(data.complementary_sale || false);
      setComplementaryFleet(data.complementary_fleet?.toString() || "0");
      setImplementedFleet(data.implemented_fleet?.toString() || "0");
      setObservations(data.observations || "");

      // Load project integrations
      const { data: piData } = await supabase.from("project_integrations").select("integration_id").eq("project_id", id);
      const intIds = piData?.map((pi: any) => pi.integration_id) || [];
      setSelectedIntegrations(intIds);
      setProject((prev: any) => ({ ...prev, _integrationIds: intIds }));

      // Load project equipments
      const { data: peData } = await (supabase.from("project_equipments" as any) as any).select("equipment_type_id, quantity").eq("project_id", id);
      const eqRows: { id: string; quantity: number }[] = (peData || []).map((p: any) => ({ id: p.equipment_type_id, quantity: p.quantity }));
      setSelectedEquipments(eqRows.map(r => r.id));
      setEquipmentQty(Object.fromEntries(eqRows.map(r => [r.id, String(r.quantity)])));
      setOriginalEquipments(eqRows);

      // Load project solution features
      const { data: psfData } = await (supabase.from("project_solution_features" as any) as any).select("solution_feature_id").eq("project_id", id);
      const featIds = (psfData || []).map((p: any) => p.solution_feature_id);
      setSelectedFeatures(featIds);
      setOriginalFeatures(featIds);
    }
    setLoading(false);
  };

  const loadNotes = async () => {
    if (!id) return;
    const { data } = await supabase.from("project_notes").select("*").eq("project_id", id).order("created_at", { ascending: false });
    if (!data) { setNotes([]); return; }
    const userIds = [...new Set(data.map(n => n.created_by).filter(Boolean))] as string[];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      if (profiles) profiles.forEach(p => { profileMap[p.user_id] = p.full_name || "Usuário"; });
    }
    setNotes(data.map(n => ({
      ...n,
      _user_name: n.created_by
        ? (profileMap[n.created_by] || (n.created_by === user?.id ? (user?.email ?? "Usuário") : "Usuário"))
        : "Sistema",
    })));
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const { error } = await supabase.from("project_notes").insert({
        project_id: id,
        content: newNote.trim(),
        created_by: user?.id || null,
      });
      if (error) throw error;
      clearNoteDraft();
      toast({ title: "Acompanhamento registrado!" });
      loadNotes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  const startEditingNote = (note: any) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteContent("");
  };

  const handleUpdateNote = async () => {
    if (!editingNoteId || !editingNoteContent.trim()) return;
    setUpdatingNote(true);
    try {
      const { error } = await supabase
        .from("project_notes")
        .update({ content: editingNoteContent.trim() })
        .eq("id", editingNoteId);
      if (error) throw error;
      cancelEditingNote();
      await loadNotes();
      toast({ title: "Acompanhamento atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro ao editar", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingNote(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    setDeletingNote(true);
    try {
      const { error } = await supabase.from("project_notes").delete().eq("id", noteToDelete.id);
      if (error) throw error;
      if (editingNoteId === noteToDelete.id) cancelEditingNote();
      setNoteToDelete(null);
      await loadNotes();
      toast({ title: "Acompanhamento excluído!" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeletingNote(false);
    }
  };

  const loadHistory = async () => {
    if (!id) return;
    const { data } = await supabase.from("project_history").select("*").eq("project_id", id).order("created_at", { ascending: false });
    if (!data) { setHistory([]); return; }
    // Fetch profile names for changed_by
    const userIds = [...new Set(data.map(h => h.changed_by).filter(Boolean))] as string[];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      if (profiles) profiles.forEach(p => { profileMap[p.user_id] = p.full_name || "Usuário"; });
    }
    setHistory(data.map(h => ({ ...h, _user_name: h.changed_by ? (profileMap[h.changed_by] || "Usuário") : "Sistema" })));
  };

  useEffect(() => {
    loadProject();
    if (id) {
      loadHistory();
      loadNotes();
      supabase.from("project_attachments").select("*").eq("project_id", id).order("created_at", { ascending: false }).then(({ data }) => setAttachments(data || []));
    }
    supabase.from("team_members").select("id, full_name").eq("role", "executivo_vendas").eq("active", true).then(({ data }) => setExecutives(data || []));
    supabase.from("team_members").select("id, full_name").eq("role", "gerente_projetos").eq("active", true).then(({ data }) => setManagers(data || []));
    supabase.from("products").select("id, name").eq("active", true).then(({ data }) => setAllProducts(data || []));
    supabase.from("project_types").select("id, name").eq("active", true).then(({ data }) => setProjectTypes(data || []));
    supabase.from("solutions").select("id, name").eq("active", true).then(({ data }) => setAllSolutions(data || []));
    supabase.from("integrations").select("id, name").eq("active", true).then(({ data }) => setAllIntegrations(data || []));
    (supabase.from("equipment_types" as any) as any).select("id, name").eq("active", true).order("sort_order").then(({ data }: any) => setAllEquipments(data || []));
    (supabase.from("solution_features" as any) as any).select("id, solution_id, name").eq("active", true).order("sort_order").then(({ data }: any) => setSolutionFeatures(data || []));
  }, [id]);

  const buildChanges = () => {
    const changes: { field: string; from: string; to: string }[] = [];
    const str = (v: any) => v == null ? "" : String(v);
    const add = (label: string, oldVal: any, newVal: any) => {
      if (str(oldVal) !== str(newVal)) changes.push({ field: label, from: str(oldVal) || "—", to: str(newVal) || "—" });
    };

    add("Empresa", project.company_name, companyName);
    add("Cidade", project.city, city);
    add("Estado", project.state, state);
    add("País", project.country_code, countryCode);
    add("Status", statusLabels[project.status as ProjectStatus], statusLabels[status]);
    
    const oldTypeName = project.project_type?.name || "—";
    const newTypeName = projectTypes.find(t => t.id === projectTypeId)?.name || "—";
    add("Tipo de Projeto", oldTypeName, newTypeName);
    
    add("Frota Contratada", project.fleet_size, fleetSize);
    add("Prazo Implantação (dias)", project.implementation_deadline_days, implDeadlineDays);
    add("Prazo Contratual (dias)", project.contractual_deadline_days, contractualDeadlineDays);
    add("Piloto", project.is_pilot ? "Sim" : "Não", isPilot ? "Sim" : "Não");
    const trainLabel = (v: any) => v === true ? "Com treinamento" : v === false ? "Sem treinamento" : "—";
    add("Treinamento de instalação embarcada", trainLabel((project as any).embedded_install_training), trainLabel(embeddedTraining === "" ? null : embeddedTraining === "sim"));

    const oldExec = project.executive?.full_name || "—";
    const newExec = executives.find(e => e.id === executiveId)?.full_name || "—";
    add(teamRoleLabels.executive ?? "Executivo de Vendas", oldExec, newExec);

    const oldMgr = project.manager?.full_name || "—";
    const newMgr = managers.find(m => m.id === managerId)?.full_name || "—";
    add(teamRoleLabels.manager ?? "Gestor de Projetos", oldMgr, newMgr);

    add("Data do Contrato", fmtDate(project.contract_date), contractDate ? format(contractDate, "dd/MM/yyyy") : "—");
    add("Data D-Zero", fmtDate(project.d_zero_date), dZeroDate ? format(dZeroDate, "dd/MM/yyyy") : "—");
    add("Data de Entrega", fmtDate(project.handover_date), handoverDate ? format(handoverDate, "dd/MM/yyyy") : "—");
    add("Projeto Executivo", fmtDate(project.executive_project_date), executiveProjectDate ? format(executiveProjectDate, "dd/MM/yyyy") : "—");

    const oldSols = (project.project_solutions?.map((ps: any) => ps.solution?.name).filter(Boolean) || []).sort().join(", ") || "—";
    const newSols = selectedSolutions.map(sid => allSolutions.find(s => s.id === sid)?.name).filter(Boolean).sort().join(", ") || "—";
    add("Soluções", oldSols, newSols);

    if (isPilot) add("Info Piloto", project.pilot_info || "—", pilotInfo || "—");
    add("Instalação Transmobile", project.installation_transmobile ?? 0, parseInt(installationTransmobile) || 0);
    add("Instalação Cliente", project.installation_client ?? 0, parseInt(installationClient) || 0);
    add("Venda Complementar", project.complementary_sale ? "Sim" : "Não", complementarySale ? "Sim" : "Não");
    if (complementarySale) add("Frota Complementar", project.complementary_fleet ?? 0, parseInt(complementaryFleet) || 0);
    if (complementarySale) add("Frota Implementada", project.implemented_fleet ?? 0, parseInt(implementedFleet) || 0);

    add("Acompanhamento do Projeto", project.observations || "—", observations || "—");

    // Integrations changes
    const currentIntNames = selectedIntegrations.map(iid => allIntegrations.find(i => i.id === iid)?.name).filter(Boolean).sort().join(", ") || "—";
    const oldIntIds = project._integrationIds || [];
    const oldIntNames = oldIntIds.map((iid: string) => allIntegrations.find(i => i.id === iid)?.name).filter(Boolean).sort().join(", ") || "—";
    add("Integrações", oldIntNames, currentIntNames);

    // Equipment changes
    const fmtEq = (rows: { id: string; quantity: number }[]) =>
      rows.map(r => `${allEquipments.find(e => e.id === r.id)?.name || "?"} (${r.quantity})`).sort().join(", ") || "—";
    const oldEqStr = fmtEq(originalEquipments);
    const newEqRows = selectedEquipments
      .map(eid => ({ id: eid, quantity: parseInt(equipmentQty[eid] || "0") || 0 }))
      .filter(r => r.quantity > 0);
    const newEqStr = fmtEq(newEqRows);
    add("Equipamentos", oldEqStr, newEqStr);

    // Features (sub-características de soluções, ex.: AtlasMob)
    const fmtFeat = (ids: string[]) =>
      ids.map(fid => {
        const f = solutionFeatures.find(x => x.id === fid);
        if (!f) return null;
        const sol = allSolutions.find(s => s.id === f.solution_id)?.name || "?";
        return `${sol} → ${f.name}`;
      }).filter(Boolean).sort().join(", ") || "—";
    add("Características de Soluções", fmtFeat(originalFeatures), fmtFeat(selectedFeatures));

    return changes;
  };

  const handleSave = async () => {
    if (!id) return;
    if (!projectTypeId) { toast({ title: "Selecione o Tipo do Projeto", variant: "destructive" }); return; }
    if (selectedSolutions.length === 0) { toast({ title: "Selecione pelo menos uma Solução", variant: "destructive" }); return; }
    const fleet = parseInt(fleetSize);
    if (!fleetSize || isNaN(fleet) || fleet < 1) { toast({ title: "Informe a Frota Contratada", variant: "destructive" }); return; }
    const urbano = parseInt(fleetUrbano) || 0;
    const seccionado = parseInt(fleetSeccionado) || 0;
    if (urbano < 0 || seccionado < 0) { toast({ title: "Sistema: valores não podem ser negativos", variant: "destructive" }); return; }
    if (urbano + seccionado !== fleet) { toast({ title: "A soma de Urbano e Seccionado deve ser igual à Frota Contratada", variant: "destructive" }); return; }
    const implDays = parseInt(implDeadlineDays);
    if (!implDeadlineDays || isNaN(implDays) || implDays < 1) { toast({ title: "Informe o Prazo de Implantação", variant: "destructive" }); return; }
    const contrDays = parseInt(contractualDeadlineDays);
    if (!contractualDeadlineDays || isNaN(contrDays) || contrDays < 1) { toast({ title: "Informe o Prazo Contratual", variant: "destructive" }); return; }
    if (isPilot && !pilotInfo.trim()) { toast({ title: "Informe as informações do Piloto", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const changes = buildChanges();

      const { error } = await supabase.from("projects").update({
        company_name: companyName, city, country_code: countryCode,
        state: countryCode === "BR" ? state : null,
        contract_date: contractDate ? format(contractDate, "yyyy-MM-dd") : project.contract_date,
        d_zero_date: dZeroDate ? format(dZeroDate, "yyyy-MM-dd") : null,
        handover_date: handoverDate ? format(handoverDate, "yyyy-MM-dd") : null,
        executive_project_date: executiveProjectDate ? format(executiveProjectDate, "yyyy-MM-dd") : null,
        executive_id: executiveId || null, manager_id: managerId || null, status,
        project_type_id: projectTypeId || null,
        project_segment: projectSegment || null,
        fleet_size: fleet,
        fleet_urbano: urbano,
        fleet_seccionado: seccionado,
        implementation_deadline_days: implDays,
        contractual_deadline_days: contrDays,
        is_pilot: isPilot,
        pilot_info: isPilot ? pilotInfo : null,
        embedded_install_training: embeddedTraining === "" ? null : embeddedTraining === "sim",
        installation_transmobile: parseInt(installationTransmobile) || 0,
        installation_client: parseInt(installationClient) || 0,
        complementary_sale: complementarySale,
        complementary_fleet: complementarySale ? (parseInt(complementaryFleet) || 0) : 0,
        implemented_fleet: complementarySale ? (parseInt(implementedFleet) || 0) : 0,
        observations: observations || null,
      }).eq("id", id);
      if (error) throw error;

      // Update solutions
      await supabase.from("project_solutions").delete().eq("project_id", id);
      if (selectedSolutions.length > 0) {
        await supabase.from("project_solutions").insert(selectedSolutions.map(sid => ({ project_id: id, solution_id: sid })));
      }

      // Update integrations
      await supabase.from("project_integrations").delete().eq("project_id", id);
      if (selectedIntegrations.length > 0) {
        await supabase.from("project_integrations").insert(selectedIntegrations.map(iid => ({ project_id: id, integration_id: iid })));
      }

      // Update equipments
      await (supabase.from("project_equipments" as any) as any).delete().eq("project_id", id);
      const eqRowsToInsert = selectedEquipments
        .map(eid => ({ project_id: id, equipment_type_id: eid, quantity: parseInt(equipmentQty[eid] || "0") || 0 }))
        .filter(r => r.quantity > 0);
      if (eqRowsToInsert.length > 0) {
        await (supabase.from("project_equipments" as any) as any).insert(eqRowsToInsert);
      }

      // Update solution features
      await (supabase.from("project_solution_features" as any) as any).delete().eq("project_id", id);
      const validFeatures = selectedFeatures.filter(fid => {
        const f = solutionFeatures.find(x => x.id === fid);
        return f && selectedSolutions.includes(f.solution_id);
      });
      if (validFeatures.length > 0) {
        await (supabase.from("project_solution_features" as any) as any).insert(
          validFeatures.map(fid => ({ project_id: id, solution_feature_id: fid }))
        );
      }

      // Histórico registrado automaticamente por trigger no banco

      toast({ title: "Projeto atualizado!" });
      setEditing(false);
      loadProject();
      loadHistory();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const [uploading, setUploading] = useState(false);
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const ATTACHMENT_CATEGORIES = [
    { key: "pasta", label: "Pasta do Projeto", prefix: "[Pasta do Projeto]" },
  ];

  const getAttachmentsForCategory = (prefix: string) => {
    return attachments.filter(a => a.file_name?.startsWith(prefix));
  };

  const getUncategorizedAttachments = () => {
    const prefixes = ATTACHMENT_CATEGORIES.map(c => c.prefix);
    return attachments.filter(a => !prefixes.some(p => a.file_name?.startsWith(p)));
  };

  const handleAddLink = async (category: typeof ATTACHMENT_CATEGORIES[0]) => {
    const url = (linkInputs[category.key] || "").trim();
    if (!url || !id) return;
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: "URL inválida", description: "A URL deve começar com http:// ou https://", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { error } = await supabase.from("project_attachments").insert({
        project_id: id,
        file_name: `${category.prefix} ${url}`,
        file_path: url,
        file_size: null,
        content_type: "link",
        uploaded_by: user?.id || null,
      });
      if (error) { toast({ title: "Erro ao salvar link", description: error.message, variant: "destructive" }); return; }
      setLinkInputs(prev => ({ ...prev, [category.key]: "" }));
      toast({ title: "Link salvo!" });
      const { data: refreshed } = await supabase.from("project_attachments").select("*").eq("project_id", id).order("created_at", { ascending: false });
      setAttachments(refreshed || []);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (att: any) => {
    if (att.content_type !== "link") {
      await supabase.storage.from("project-attachments").remove([att.file_path]);
    }
    await supabase.from("project_attachments").delete().eq("id", att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    toast({ title: "Anexo removido" });
  };

  const handleDownload = async (att: any) => {
    const { data } = await supabase.storage.from("project-attachments").createSignedUrl(att.file_path, settings.downloadUrlTtl);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = att.file_name;
      a.target = "_blank";
      a.click();
    }
  };

  const handlePreview = async (att: any) => {
    const { data } = await supabase.storage.from("project-attachments").createSignedUrl(att.file_path, settings.previewUrlTtl);
    if (data?.signedUrl) {
      setPreviewName(att.file_name);
      setPreviewUrl(data.signedUrl);
    }
  };

  const fmtDate = (d: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!project) return <p className="text-center py-12 text-muted-foreground">Projeto não encontrado.</p>;

  const DateField = ({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d?: Date) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-full justify-start", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3 w-3" /> {date ? format(date, "dd/MM/yyyy") : "—"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {date && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => onSelect(undefined)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  const HelperText = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      <Info className="h-3 w-3" /> {children}
    </p>
  );

  // Status progression order for determining completed milestones
  const statusOrder: ProjectStatus[] = ["comercial", "planejamento", "implantacao", "encerrado"];
  const currentStatusIndex = Math.max(0, statusOrder.indexOf(project.status as ProjectStatus));
  const reachedImplemented = !!project.reached_implemented;
  const reachedImplementedAt = project.reached_implemented_at
    ? format(new Date(project.reached_implemented_at), "dd/MM/yyyy")
    : null;

  // Linha do tempo segue a fase atual; "Implementado" mantém o check permanente caso
  // o projeto já tenha passado por essa fase (mesmo se voltou para outra coluna do Kanban).
  const baseTimeline: Array<{ label: string; date: string | null; done: boolean; reachedBadge?: boolean; returned?: boolean }> = [
    { label: "Contratação", date: project.contract_date, done: true },
    { label: "D-zero", date: project.d_zero_date, done: !!project.d_zero_date || currentStatusIndex >= 2 || reachedImplemented },
    { label: "Handover", date: project.handover_date, done: !!project.handover_date || currentStatusIndex >= 3 || reachedImplemented },
    { label: "Implementado", date: null, done: currentStatusIndex >= 3 || reachedImplemented, reachedBadge: reachedImplemented && currentStatusIndex < 3 },
  ];

  // Passos pós-Implementado: extraídos de project_history (status_change após reached_implemented_at).
  // Caso o histórico não exista (projetos antigos), usa fallback: status atual + updated_at.
  const postImplementedSteps = (() => {
    if (!reachedImplemented || project.status === "encerrado") return [] as { status: ProjectStatus; date: string }[];
    const reachedAt = project.reached_implemented_at ? new Date(project.reached_implemented_at).getTime() : 0;
    const moves = history
      .filter(h => h.change_type === "status_change" && new Date(h.created_at).getTime() >= reachedAt)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(h => ({
        status: (h.new_values?.status || null) as ProjectStatus | null,
        date: h.created_at as string,
      }))
      .filter(m => !!m.status) as { status: ProjectStatus; date: string }[];
    const dedup: { status: ProjectStatus; date: string }[] = [];
    moves.forEach(m => {
      const last = dedup[dedup.length - 1];
      if (!last || last.status !== m.status) dedup.push(m);
    });
    if (dedup.length === 0) {
      return [{ status: project.status as ProjectStatus, date: project.updated_at as string }];
    }
    return dedup;
  })();


  const timeline = [
    ...baseTimeline,
    ...postImplementedSteps.map((s) => ({
      label: statusLabels[s.status as ProjectStatus] || "—",
      date: s.date ? format(new Date(s.date), "yyyy-MM-dd") : null,
      done: true,
      returned: true,
    })),

  ];

  // Etapa "atual": último passo se houve movimentações pós-Implementado; senão, status corrente.
  const currentMilestoneIndex = postImplementedSteps.length > 0 ? timeline.length - 1 : currentStatusIndex;


  const projectTypeName = project.project_type?.name || "—";
  const solutionNames = project.project_solutions?.map((ps: any) => ps.solution?.name).filter(Boolean) || [];

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(backPath)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{project.company_name}</h1>
          {project.project_code && (
            <span className="font-mono text-xs px-2 py-1 rounded bg-muted text-muted-foreground w-fit">
              Código: {project.project_code}
            </span>
          )}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        ) : isAdmin ? (
          <Button size="sm" onClick={() => setEditing(true)}><Edit2 className="mr-1 h-4 w-4" /> Editar</Button>
        ) : null}
      </div>

      {/* Timeline */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Linha do Tempo</CardTitle></CardHeader>
        <CardContent>
          {reachedImplemented && currentStatusIndex < 3 && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20 px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-xs text-red-700 dark:text-red-300">
                Projeto já atingiu <strong>Implementado</strong>{reachedImplementedAt ? ` em ${reachedImplementedAt}` : ""} e foi movido para <strong>{statusLabels[project.status as ProjectStatus]}</strong>.
              </span>
            </div>
          )}
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
            {timeline.map((t, i) => {
              const isCurrentStep = i === currentMilestoneIndex;
              return (
                <div key={i} className="relative flex flex-col items-center z-10">
                  <div className="relative">
                    {isCurrentStep && (
                      <>
                        <motion.div
                          className="absolute inset-[-4px] rounded-full border-2 border-primary"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.div
                          className="absolute inset-[-2px] rounded-full border border-primary"
                          animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                        />
                      </>
                    )}
                    <motion.div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold relative",
                        t.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        (t as any).returned && "ring-2 ring-red-400 ring-offset-2 ring-offset-background"
                      )}
                      animate={isCurrentStep ? {
                        boxShadow: [
                          "0 0 0px hsl(var(--primary) / 0.3)",
                          "0 0 16px hsl(var(--primary) / 0.6)",
                          "0 0 0px hsl(var(--primary) / 0.3)",
                        ],
                      } : {}}
                      transition={isCurrentStep ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                    >
                      {i + 1}
                    </motion.div>
                  </div>
                  <span className={cn("text-xs font-medium mt-2", isCurrentStep && "text-primary font-bold")}>{t.label}</span>
                  {t.date ? (
                    <span className="text-xs text-muted-foreground">{fmtDate(t.date)}</span>
                  ) : t.done ? (
                    <span className="text-xs text-primary font-semibold">✓</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {(t as any).reachedBadge && (
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Já atingido
                    </span>
                  )}
                  {(t as any).returned && (
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                      Retorno
                    </span>
                  )}

                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Acompanhamento do Projeto */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Acompanhamento do Projeto</CardTitle>
          <CardDescription>Cada registro guarda automaticamente o autor, a data e a hora. Sem limite de caracteres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {noteDraftSavedAt && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5">
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Rascunho restaurado de {format(noteDraftSavedAt, "dd/MM/yyyy HH:mm")}
                </span>
                <button
                  className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                  onClick={() => clearNoteDraft()}
                >
                  Descartar
                </button>
              </div>
            )}
            <MarkdownNoteEditor
              value={newNote}
              onChange={setNewNote}
              placeholder="Registre aqui uma nova informação de acompanhamento..."
              disabled={addingNote}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
                <PlusCircle className="w-4 h-4 mr-2" />
                {addingNote ? "Registrando..." : "Registrar acompanhamento"}
              </Button>
            </div>
          </div>

          <Separator />

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum acompanhamento registrado.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(n => {
                const canManageNote = isAdmin || n.created_by === user?.id;
                const wasEdited = n.updated_at && new Date(n.updated_at).getTime() !== new Date(n.created_at).getTime();
                const isEditingNote = editingNoteId === n.id;
                return (
                  <div key={n.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{n._user_name}</span>
                        <span>•</span>
                        <span>{format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                        {wasEdited && (
                          <span title={`Última edição em ${format(new Date(n.updated_at), "dd/MM/yyyy 'às' HH:mm")}`}>
                            • Editado em {format(new Date(n.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                          </span>
                        )}
                      </div>
                      {canManageNote && !isEditingNote && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditingNote(n)} title="Editar acompanhamento">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNoteToDelete(n)} title="Excluir acompanhamento">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isEditingNote ? (
                      <div className="space-y-2">
                        <MarkdownNoteEditor
                          value={editingNoteContent}
                          onChange={setEditingNoteContent}
                          disabled={updatingNote}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditingNote} disabled={updatingNote}>Cancelar</Button>
                          <Button size="sm" onClick={handleUpdateNote} disabled={updatingNote || !editingNoteContent.trim()}>
                            <Save className="mr-2 h-4 w-4" />
                            {updatingNote ? "Salvando..." : "Salvar alteração"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <NoteContent content={n.content} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!noteToDelete} onOpenChange={open => { if (!open && !deletingNote) setNoteToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acompanhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O comentário deixará de aparecer no projeto, mas uma cópia será preservada no histórico de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {noteToDelete?.content && (
            <div className="max-h-32 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
              <NoteContent content={noteToDelete.content} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingNote}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => { event.preventDefault(); void handleDeleteNote(); }}
              disabled={deletingNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingNote ? "Excluindo..." : "Excluir comentário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Dados Gerais */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados Gerais</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Empresa</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <LocationFields
                    countryCode={countryCode}
                    onCountryChange={setCountryCode}
                    city={city}
                    onCityChange={setCity}
                    state={state}
                    onStateChange={v => setState(v as BrazilianState)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo do Projeto</Label>
                  <Select value={projectTypeId} onValueChange={setProjectTypeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{projectTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Seguimento do Projeto</Label>
                  <Select value={projectSegment || undefined} onValueChange={setProjectSegment}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{PROJECT_SEGMENTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Frota Contratada</Label>
                  <Input type="number" min={1} step={1} value={fleetSize} onChange={e => setFleetSize(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sistema · Urbano</Label>
                  <Input type="number" min={0} step={1} value={fleetUrbano} onChange={e => setFleetUrbano(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sistema · Seccionado</Label>
                  <Input type="number" min={0} step={1} value={fleetSeccionado} onChange={e => setFleetSeccionado(e.target.value)} />
                </div>
                {(() => {
                  const u = parseInt(fleetUrbano) || 0;
                  const s = parseInt(fleetSeccionado) || 0;
                  const f = parseInt(fleetSize) || 0;
                  const ok = f > 0 && u + s === f;
                  return (
                    <div className={cn("text-xs font-medium", ok ? "text-emerald-600" : "text-destructive")}>
                      Soma Urbano + Seccionado: {u + s} / Frota Contratada: {f}
                    </div>
                  );
                })()}
                <DateField label="Contratação" date={contractDate} onSelect={d => d && setContractDate(d)} />
                <DateField label="D-zero" date={dZeroDate} onSelect={setDZeroDate} />
                <DateField label="Handover" date={handoverDate} onSelect={setHandoverDate} />
                <DateField label="Projeto Executivo" date={executiveProjectDate} onSelect={setExecutiveProjectDate} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={v => setStatus(v as ProjectStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Constants.public.Enums.project_status.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-muted-foreground">Empresa</span><p className="font-medium">{project.company_name}</p></div>
                <div><span className="text-xs text-muted-foreground">Localização</span><p>{formatLocation(project.city, project.state, project.country_code)}</p></div>
                <div><span className="text-xs text-muted-foreground">Tipo do Projeto</span><p>{projectTypeName}</p></div>
                <div><span className="text-xs text-muted-foreground">Seguimento do Projeto</span><p>{projectSegmentLabel((project as any).project_segment)}</p></div>
                <div><span className="text-xs text-muted-foreground">Frota Contratada</span><p>{project.fleet_size ?? "—"} veículos</p></div>
                <div><span className="text-xs text-muted-foreground">Sistema</span><p>Urbano: <strong>{(project as any).fleet_urbano ?? 0}</strong> · Seccionado: <strong>{(project as any).fleet_seccionado ?? 0}</strong></p></div>
                <div><span className="text-xs text-muted-foreground">Contratação</span><p>{fmtDate(project.contract_date)}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-xs text-muted-foreground">D-zero</span><p>{fmtDate(project.d_zero_date)}</p></div>
                  <div><span className="text-xs text-muted-foreground">Handover</span><p>{fmtDate(project.handover_date)}</p></div>
                </div>
                <div><span className="text-xs text-muted-foreground">Projeto Executivo</span><p>{fmtDate(project.executive_project_date)}</p></div>
                <div><span className="text-xs text-muted-foreground">Status</span><p><Badge variant="outline">{statusLabels[project.status as ProjectStatus]}</Badge></p></div>
                <div><span className="text-xs text-muted-foreground">Data e hora do cadastro</span><p>{project.created_at ? format(new Date(project.created_at), "dd/MM/yyyy 'às' HH:mm") : "—"}</p></div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Equipe & Soluções */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Equipe & Soluções</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{teamRoleLabels.executive ?? "Executivo de Vendas"}</Label>
                  <Select value={executiveId} onValueChange={setExecutiveId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{executives.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{teamRoleLabels.manager ?? "Gerente de Projetos"}</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{managers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Separator />
                <Label className="text-xs text-muted-foreground">Soluções</Label>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {allSolutions.map(s => (
                      <div key={s.id} className="flex items-center gap-3 border rounded-md p-2">
                        <Checkbox
                          checked={selectedSolutions.includes(s.id)}
                          onCheckedChange={c => {
                            setSelectedSolutions(prev => c ? [...prev, s.id] : prev.filter(x => x !== s.id));
                            if (!c) {
                              const featureIds = solutionFeatures.filter(f => f.solution_id === s.id).map(f => f.id);
                              setSelectedFeatures(prev => prev.filter(fid => !featureIds.includes(fid)));
                            }
                          }}
                        />
                        <span className="text-sm flex-1">{s.name}</span>
                      </div>
                    ))}
                  </div>
                  {allSolutions.filter(s => selectedSolutions.includes(s.id) && solutionFeatures.some(f => f.solution_id === s.id)).map(s => {
                    const feats = solutionFeatures.filter(f => f.solution_id === s.id);
                    return (
                      <div key={s.id} className="border rounded-md p-3 bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block">Características de {s.name}</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {feats.map(f => (
                            <div key={f.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedFeatures.includes(f.id)}
                                onCheckedChange={c => setSelectedFeatures(prev => c ? [...prev, f.id] : prev.filter(x => x !== f.id))}
                              />
                              <span className="text-sm">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator />
                <Label className="text-xs text-muted-foreground">Equipamentos</Label>
                <div className="grid gap-2">
                  {allEquipments.map(eq => {
                    const checked = selectedEquipments.includes(eq.id);
                    return (
                      <div key={eq.id} className="flex items-center gap-2 border rounded-md p-2">
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
                            className="w-20 h-8"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-muted-foreground">{teamRoleLabels.executive ?? "Executivo de Vendas"}</span><p>{project.executive?.full_name || "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">{teamRoleLabels.manager ?? "Gerente de Projetos"}</span><p>{project.manager?.full_name || "—"}</p></div>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">Soluções</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(project.project_solutions || []).length > 0
                      ? (project.project_solutions as any[]).map((ps: any) => {
                          const sid = ps.solution?.id || ps.solution_id;
                          const sname = ps.solution?.name || "?";
                          const feats = solutionFeatures
                            .filter(f => f.solution_id === sid && originalFeatures.includes(f.id))
                            .map(f => f.name);
                          return (
                            <Badge key={sid} variant="default" className="whitespace-normal">
                              {sname}
                              {feats.length > 0 && <span className="ml-1 opacity-90">— {feats.join(", ")}</span>}
                            </Badge>
                          );
                        })
                      : <span className="text-sm text-muted-foreground">Nenhuma</span>}
                  </div>
                </div>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">Equipamentos</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {originalEquipments.length > 0
                      ? originalEquipments.map(r => {
                          const name = allEquipments.find(e => e.id === r.id)?.name;
                          return name ? <Badge key={r.id} variant="secondary">{name} · {r.quantity}</Badge> : null;
                        })
                      : <span className="text-sm text-muted-foreground">Nenhum</span>}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prazos & Piloto */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Prazos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prazo de Implantação (dias)</Label>
                  <Input type="number" min={1} step={1} value={implDeadlineDays} onChange={e => setImplDeadlineDays(e.target.value)} />
                  {implEndDate && <HelperText>Finalização prevista: {format(implEndDate, "dd/MM/yyyy")}</HelperText>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prazo Contratual (dias)</Label>
                  <Input type="number" min={1} step={1} value={contractualDeadlineDays} onChange={e => setContractualDeadlineDays(e.target.value)} />
                  {contractEndDate && <HelperText>Fim do contrato: {format(contractEndDate, "dd/MM/yyyy")}</HelperText>}
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-xs text-muted-foreground">Prazo de Implantação</span>
                  <p>{project.implementation_deadline_days ? `${project.implementation_deadline_days} dias` : "—"}</p>
                  {project.implementation_deadline_days && project.contract_date && (
                    <HelperText>Finalização prevista: {format(addDays(new Date(project.contract_date + "T00:00:00"), project.implementation_deadline_days), "dd/MM/yyyy")}</HelperText>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Prazo Contratual</span>
                  <p>{project.contractual_deadline_days ? `${project.contractual_deadline_days} dias` : "—"}</p>
                  {project.contractual_deadline_days && project.contract_date && (
                    <HelperText>Fim do contrato: {format(addDays(new Date(project.contract_date + "T00:00:00"), project.contractual_deadline_days), "dd/MM/yyyy")}</HelperText>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Piloto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="flex items-center gap-3">
                  <Switch checked={isPilot} onCheckedChange={setIsPilot} />
                  <Label>Projeto é piloto?</Label>
                </div>
                {isPilot && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Informação Adicional</Label>
                    <Textarea value={pilotInfo} onChange={e => setPilotInfo(e.target.value)} rows={3} maxLength={settings.pilotInfoMax} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Treinamento de instalação embarcada</Label>
                  <Select value={embeddedTraining} onValueChange={setEmbeddedTraining}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Com treinamento de instalação embarcada</SelectItem>
                      <SelectItem value="nao">Sem treinamento de instalação embarcada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-muted-foreground">Projeto Piloto</span><p>{project.is_pilot ? "Sim" : "Não"}</p></div>
                {project.is_pilot && project.pilot_info && (
                  <div><span className="text-xs text-muted-foreground">Informação Adicional</span><p className="text-sm">{project.pilot_info}</p></div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Treinamento de instalação embarcada</span>
                  <p>{(project as any).embedded_install_training === true ? "Com treinamento" : (project as any).embedded_install_training === false ? "Sem treinamento" : "—"}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Venda Complementar */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Venda Complementar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div className="flex items-center gap-3">
                <Switch checked={complementarySale} onCheckedChange={setComplementarySale} />
                <Label>Possui venda complementar?</Label>
              </div>
              {complementarySale && (
               <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frota Complementar</Label>
                    <Input type="number" min={0} step={1} value={complementaryFleet} onChange={e => setComplementaryFleet(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frota Total</Label>
                    <Input type="number" readOnly disabled value={(parseInt(fleetSize) || 0) + (parseInt(complementaryFleet) || 0)} className="bg-muted" />
                    <p className="text-[10px] text-muted-foreground">Soma de Frota Contratada + Frota Complementar</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frota Implementada</Label>
                    <Input type="number" min={0} step={1} value={implementedFleet} onChange={e => setImplementedFleet(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground">Quantidade de veículos já implementados neste projeto</p>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div><span className="text-xs text-muted-foreground">Venda Complementar</span><p>{project.complementary_sale ? "Sim" : "Não"}</p></div>
              {project.complementary_sale && (
                <>
                  <div><span className="text-xs text-muted-foreground">Frota Complementar</span><p>{project.complementary_fleet ?? 0}</p></div>
                  <div><span className="text-xs text-muted-foreground">Frota Total</span><p>{(project.fleet_size ?? 0) + (project.complementary_fleet ?? 0)}</p></div>
                  <div><span className="text-xs text-muted-foreground">Frota Implementada</span><p>{project.implemented_fleet ?? 0}</p></div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Attachments - Categorized */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Anexos</CardTitle>
          <CardDescription className="text-xs">Anexe documentos relacionados ao projeto (máx. 100MB cada)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {uploading && uploadProgress && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Enviando arquivo {uploadProgress.current} de {uploadProgress.total}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                </span>
              </div>
              <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground truncate">{uploadProgress.fileName}</p>
            </div>
          )}
          {ATTACHMENT_CATEGORIES.map(cat => {
            const catFiles = getAttachmentsForCategory(cat.prefix);
            return (
              <div key={cat.key} className="space-y-2">
                <Label className="text-sm font-medium">{cat.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={linkInputs[cat.key] || ""}
                    onChange={e => setLinkInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddLink(cat); } }}
                    placeholder="https://..."
                  />
                  <Button size="sm" variant="outline" disabled={uploading} onClick={() => handleAddLink(cat)}>
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
                {catFiles.length > 0 ? (
                  <div className="space-y-1.5">
                    {catFiles.map(att => {
                      const isLink = att.content_type === "link";
                      const isPdf = att.content_type === "application/pdf" || att.file_name?.toLowerCase().endsWith(".pdf");
                      const isImage = att.content_type?.startsWith("image/");
                      const canPreview = !isLink && (isPdf || isImage);
                      const displayName = att.file_name?.replace(cat.prefix + " ", "") || att.file_name;
                      return (
                        <div key={att.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isLink ? <Link2 className="h-4 w-4 text-muted-foreground shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <span className="text-sm truncate">{displayName}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ""}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isLink ? (
                              <Button size="sm" variant="outline" asChild>
                                <a href={att.file_path} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Acessar
                                </a>
                              </Button>
                            ) : (
                              <>
                                {canPreview && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(att)} title="Visualizar">
                                    <Eye className="h-4 w-4 text-primary" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(att)} title="Baixar">
                                  <Download className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteAttachment(att)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum link cadastrado</p>
                )}
              </div>
            );
          })}

          {/* Uncategorized attachments (legacy) */}
          {getUncategorizedAttachments().length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Outros (anteriores)</Label>
              <div className="space-y-1.5">
                {getUncategorizedAttachments().map(att => {
                  const isPdf = att.content_type === "application/pdf" || att.file_name?.toLowerCase().endsWith(".pdf");
                  const isImage = att.content_type?.startsWith("image/");
                  const canPreview = isPdf || isImage;
                  return (
                    <div key={att.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{att.file_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ""}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canPreview && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(att)} title="Visualizar">
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(att)} title="Baixar">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteAttachment(att)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={open => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl h-[80vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-sm truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="w-full flex-1 border-0 rounded-b-lg" style={{ height: "calc(80vh - 60px)" }} />
          )}
        </DialogContent>
      </Dialog>

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Histórico de Alterações</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico.</p>
          ) : (
            <div className="space-y-4">
              {history.map(h => {
                const isCreated = h.change_type === "created";
                const isDeleted = h.change_type === "deleted";
                const isStatus = h.change_type === "status_change";

                // Formatação amigável
                const FIELD_LABELS: Record<string, string> = {
                  company_name: "Empresa", city: "Cidade", state: "UF",
                  status: "Status", sub_phase: "Sub-fase",
                  contract_date: "Data do contrato", d_zero_date: "Data D-zero",
                  handover_date: "Data de handover", executive_project_date: "Data do projeto executivo",
                  executive_id: teamRoleLabels.executive ?? "Executivo", manager_id: teamRoleLabels.manager ?? "Gerente de Projetos",
                  project_type_id: "Tipo de Projeto", project_code: "Código do Projeto",
                  project_segment: "Seguimento do Projeto",
                  fleet_size: "Frota Total", fleet_urbano: "Frota Urbano",
                  fleet_seccionado: "Frota Seccionado", complementary_fleet: "Frota Complementar",
                  implemented_fleet: "Frota Implementada",
                  is_pilot: "Piloto", pilot_info: "Info do Piloto",
                  embedded_install_training: "Treinamento de instalação embarcada",
                  complementary_sale: "Venda Complementar", observations: "Observações",
                  implementation_deadline_days: "Prazo de Implantação (dias)",
                  contractual_deadline_days: "Prazo Contratual (dias)",
                  reached_implemented: "Atingiu Implementado",
                };
                const IGNORE = new Set(["id","created_at","updated_at","filled_by","created_by","reached_implemented_at"]);

                const allSubs = Object.values(subPhasesByStatus).flat().filter(Boolean) as { id: string; label: string }[];
                const fmtVal = (key: string, val: any): string => {
                  if (val === null || val === undefined || val === "") return "—";
                  if (key === "status") return statusLabels[val as ProjectStatus] || String(val);
                  if (key === "sub_phase") return allSubs.find(s => s.id === val)?.label || String(val);
                  if (key === "manager_id") return managers.find(m => m.id === val)?.full_name || "—";
                  if (key === "executive_id") return executives.find(e => e.id === val)?.full_name || "—";
                  if (key === "project_type_id") return projectTypes.find(t => t.id === val)?.name || "—";
                  if (typeof val === "boolean") return val ? "Sim" : "Não";
                  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                    try { return format(new Date(val.length > 10 ? val : val + "T00:00:00"), "dd/MM/yyyy"); } catch { return val; }
                  }
                  if (typeof val === "object") return JSON.stringify(val);
                  return String(val);
                };

                let diffs: { label: string; from: string; to: string }[] = [];
                // Formato antigo: new_values.changes = [{field,from,to}]
                const legacyChanges = h.new_values?.changes as { field: string; from?: string; to?: string }[] | undefined;
                if (legacyChanges && Array.isArray(legacyChanges)) {
                  diffs = legacyChanges.map(c => ({ label: FIELD_LABELS[c.field] || c.field, from: c.from || "—", to: c.to || "—" }));
                } else if (!isCreated && !isDeleted) {
                  const oldV = (h.old_values || {}) as Record<string, any>;
                  const newV = (h.new_values || {}) as Record<string, any>;
                  const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)]);
                  keys.forEach(k => {
                    if (IGNORE.has(k)) return;
                    diffs.push({ label: FIELD_LABELS[k] || k, from: fmtVal(k, oldV[k]), to: fmtVal(k, newV[k]) });
                  });
                }

                const badge = isCreated
                  ? { icon: <PlusCircle className="h-4 w-4" />, text: "Criado", cls: "text-blue-600" }
                  : isDeleted
                    ? { icon: <Trash2 className="h-4 w-4" />, text: "Excluído", cls: "text-red-600" }
                    : isStatus
                      ? { icon: <RefreshCw className="h-4 w-4" />, text: "Mudança de Status", cls: "text-amber-600" }
                      : { icon: <RefreshCw className="h-4 w-4" />, text: "Atualizado", cls: "text-green-600" };

                return (
                  <div key={h.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", badge.cls)}>
                        {badge.icon}{badge.text}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>Por: <span className="font-medium text-foreground">{h._user_name || "Sistema"}</span></span>
                    </div>
                    {isCreated ? (
                      <p className="text-sm text-muted-foreground">Projeto cadastrado com os dados iniciais</p>
                    ) : isDeleted ? (
                      <p className="text-sm text-muted-foreground">Projeto excluído</p>
                    ) : diffs.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        {diffs.map((c, i) => (
                          <div key={i} className="text-sm flex flex-wrap items-start gap-x-2 gap-y-0.5">
                            <span className="font-medium text-muted-foreground min-w-[160px]">{c.label}:</span>
                            <span className="text-destructive/70 line-through">{c.from}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-foreground font-medium">{c.to}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem alterações detalhadas.</p>
                    )}
                  </div>
                );
              })}
            </div>

          )}
        </CardContent>
      </Card>
    </div>
  );
}
