import { formatLocation } from "@/lib/location";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, MapPin, Calendar, Users, Pencil, Clock, Lock, CornerDownRight } from "lucide-react";
import { pendencyLabel } from "@/lib/projectPendencies";
import { format } from "date-fns";
import type { ProjectRow } from "@/pages/ProjectManagement";
import { useSettings } from "@/contexts/SettingsContext";
import { followUpSla, lastFollowUpAt, followUpLevelStyles, type FollowUpLevel } from "@/lib/followUpNotes";
import { useNoteDraft } from "@/hooks/useNoteDraft";

const fmtDate = (d: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";

const SLA_BAR: Record<FollowUpLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-yellow-500",
  late: "bg-orange-500",
  critical: "bg-red-500",
};

interface Props {
  project: ProjectRow;
  index: number;
  onUpdateObservations: (projectId: string, text: string) => Promise<void>;
  canEdit?: boolean;
  /** Cards filhos em aberto (soluções que o cliente deixou para depois). */
  pendencies?: number;
  /** Presente = pode criar card filho (Implantação e Implementado). */
  onCreateChild?: () => void;
  /** Em Implantação com card filho aberto: aviso para mover o projeto para Implementado. */
  onMoveToImplemented?: () => void;
}

export default function KanbanCard({ project: p, index, onUpdateObservations, canEdit = true, pendencies = 0, onCreateChild, onMoveToImplemented }: Props) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const { value: note, update: setNote, clear: clearNoteDraft, draftSavedAt } = useNoteDraft(p.id);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await onUpdateObservations(p.id, note.trim());
    setSaving(false);
    clearNoteDraft();
    setOpen(false);
  };

  const returnedFromImplemented = p.reached_implemented && p.status !== "encerrado";
  const returnedDateLabel = returnedFromImplemented && p.reached_implemented_at
    ? format(new Date(p.reached_implemented_at), "dd/MM/yyyy")
    : null;

  // SLA: baseado na data do último acompanhamento registrado (mesma regra da Visão Comercial)
  const sla = followUpSla(p.status, lastFollowUpAt(p.observations, p.last_note_at), {
    green: settings.slaGreenMaxDays,
    yellow: settings.slaYellowMaxDays,
    orange: settings.slaOrangeMaxDays,
  });
  const slaLabel = sla ? (sla.days !== null ? followUpLevelStyles[sla.level].label : "Sem acompanhamento") : "";
  const slaText = sla
    ? (sla.days !== null
        ? `${slaLabel} — sem acompanhamento há ${sla.days} dia${sla.days !== 1 ? "s" : ""}`
        : "Sem acompanhamento registrado")
    : "";

  const borderClass = returnedFromImplemented
    ? "border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10"
    : p.is_pilot
      ? "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10"
      : p.complementary_sale
        ? "border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10"
        : "";

  return (
    <Draggable draggableId={p.id} index={index} isDragDisabled={!canEdit}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
        >
          <Card
            className={`group relative ${canEdit ? "cursor-grab active:cursor-grabbing hover:shadow-md" : "cursor-pointer opacity-90"} transition-shadow border-border/40 bg-card overflow-hidden ${dragSnapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""} ${borderClass}`}
            onClick={() => !dragSnapshot.isDragging && !open && navigate(`/projetos/${p.id}`, { state: { from: "/projetos/gestao" } })}
          >
            {sla && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute top-0 left-0 right-0 h-3 z-10 cursor-help"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={`h-1.5 ${SLA_BAR[sla.level]} ${sla.level === "critical" ? "animate-pulse" : ""}`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {slaText}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {sla && (
              <span
                className={`absolute top-2 left-2 z-10 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ${SLA_BAR[sla.level]} ${sla.level === "critical" ? "animate-pulse" : ""}`}
                onClick={(e) => e.stopPropagation()}
                title={slaText}
              >
                <Clock className="h-2.5 w-2.5" />
                {sla.days !== null ? `${sla.days}d` : "—"}
              </span>
            )}
            {returnedFromImplemented && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="absolute bottom-3 right-3 z-20 flex h-4 w-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border border-white dark:border-gray-900" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Projeto retornou de Implementado{returnedDateLabel ? ` em ${returnedDateLabel}` : ""}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Building2 className={`h-3.5 w-3.5 text-primary mt-0.5 shrink-0 ${sla ? "ml-10" : ""}`} />
                <span className="text-sm font-semibold leading-tight flex-1">{p.company_name}</span>
                {!canEdit && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0 mt-1" onClick={e => e.stopPropagation()} />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">Somente leitura — projeto de outro gerente</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {pendencies > 0 && (
                    <Badge className="h-4 gap-0.5 border-orange-500/40 bg-orange-500/15 px-1.5 text-[10px] text-orange-700 hover:bg-orange-500/15 dark:text-orange-300" title="Soluções que ficaram para depois (coluna Implantação pendente)">
                      <CornerDownRight className="h-2.5 w-2.5" />{pendencyLabel(pendencies)}
                    </Badge>
                  )}
                  {p.is_pilot && (
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] h-4 px-1.5">Piloto</Badge>
                  )}
                  {p.complementary_sale && (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15 dark:border-emerald-500/35 text-[10px] h-4 px-1.5">
                      V. Compl.{p.complementary_fleet > 0 ? ` (${p.complementary_fleet})` : ""}
                    </Badge>
                  )}
                  {p.project_integrations?.map((pi, i) => (
                    <Badge key={i} className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-200 text-[10px] h-4 px-1.5">{pi.integration?.name}</Badge>
                  ))}
                </div>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="p-0.5 rounded hover:bg-muted shrink-0"
                      onClick={e => { e.stopPropagation(); }}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72"
                    side="right"
                    align="start"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Acompanhamento do Projeto</p>
                      {draftSavedAt && (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1">
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            Rascunho restaurado de {format(draftSavedAt, "dd/MM/yyyy HH:mm")}
                          </span>
                          <button
                            className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline"
                            onClick={() => clearNoteDraft()}
                          >
                            Descartar
                          </button>
                        </div>
                      )}
                      <Textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Registre o andamento atual..."
                        maxLength={settings.kanbanNoteMax}
                        rows={3}
                        className="text-sm"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleSave} disabled={saving || !note.trim()}>
                          {saving ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {formatLocation(p.city, p.state, p.country_code)}
              </div>
              {p.manager?.full_name && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {p.manager.full_name}
                </div>
              )}
              {p.d_zero_date && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  D-zero: {fmtDate(p.d_zero_date)}
                </div>
              )}
              {p.complementary_sale && p.implemented_fleet > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {p.implemented_fleet} impl. / {(p.complementary_fleet || 0) + (p as any).fleet_size || p.complementary_fleet || 0} total
                </div>
              )}
              {p.project_solutions?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.project_solutions.map((ps, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1.5">{ps.solution?.name}</Badge>
                  ))}
                </div>
              )}
              {canEdit && onMoveToImplemented && pendencies > 0 && (
                // o objetivo do card filho: liberar o projeto pai para Implementado
                <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-2" onClick={e => e.stopPropagation()}>
                  <p className="flex items-start gap-1.5 text-[11px] font-medium leading-snug text-orange-800 dark:text-orange-200">
                    <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" />
                    {pendencies === 1 ? "O que faltou já está no card filho." : `O que faltou já está em ${pendencies} cards filhos.`} Mova o projeto para Implementado.
                  </p>
                  <button type="button" onClick={onMoveToImplemented}
                    className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-emerald-600 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500">
                    Mover para Implementado
                  </button>
                </div>
              )}
              {canEdit && onCreateChild && (
                // em Implantação fica sempre à vista; em Implementado aparece ao passar o mouse (no toque, sempre)
                <button type="button" onClick={e => { e.stopPropagation(); onCreateChild(); }}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-orange-500/40 py-1 text-[11px] font-medium text-orange-700 transition-[colors,opacity] hover:bg-orange-500/10 focus-visible:opacity-100 dark:text-orange-300 ${p.status === "encerrado" ? "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" : ""}`}
                  title="Registrar uma solução que o cliente deixou para depois">
                  <CornerDownRight className="h-3 w-3" />Card filho
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}
