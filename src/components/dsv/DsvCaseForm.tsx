import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Code2, Headset, Link2, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceCard } from "@/components/agendamento/AgendaDialogs";
import { errorMessage } from "@/lib/implantationScheduling";
import { DSV_KINDS, createDsvCase, parseAzureLink, type DsvCase, type DsvKind } from "@/lib/dsvCases";

const KIND_ICON = { suporte: Headset, desenvolvimento: Code2 } as const;
const FieldError = ({ msg }: { msg?: string }) => msg ? <p className="mt-1 text-[11px] font-medium text-destructive">{msg}</p> : null;

/** Registrar um caso DSV (ticket no Azure DevOps) no projeto. */
export default function DsvCaseForm({ projectId, existing, onCreated }: {
  projectId: string;
  /** Casos já registrados no projeto (para não repetir o mesmo link ou nº). */
  existing: DsvCase[];
  onCreated: () => void;
}) {
  const [link, setLink] = useState("");
  const [kind, setKind] = useState<DsvKind | "">("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<{ link?: string; kind?: string; title?: string }>({});
  const [saving, setSaving] = useState(false);

  const parsed = parseAzureLink(link);
  const duplicate = parsed.url
    ? existing.find(c => c.url.toLowerCase() === parsed.url!.toLowerCase() || (parsed.azureId != null && c.azure_id === parsed.azureId))
    : undefined;

  const submit = async () => {
    const next: typeof errors = {
      link: !link.trim() ? "Cole o link do caso no Azure." : !parsed.url ? "Link inválido. Cole o endereço completo do caso (ex.: https://dev.azure.com/...)." : duplicate ? "Este caso já está registrado neste projeto." : undefined,
      kind: !kind ? "Escolha se o caso é de suporte técnico ou de desenvolvimento." : undefined,
      title: title.trim().length < 2 ? "Dê um título curto para o caso." : undefined,
    };
    setErrors(next);
    if (next.link || next.kind || next.title) return;
    setSaving(true);
    try {
      await createDsvCase({ project_id: projectId, url: parsed.url!, azure_id: parsed.azureId, kind: kind as DsvKind, title: title.trim() });
      toast.success(`Caso DSV registrado${parsed.azureId ? `: #${parsed.azureId}` : ""}`);
      setLink(""); setKind(""); setTitle(""); setErrors({});
      onCreated();
    } catch (err) {
      toast.error("Não foi possível registrar o caso", { description: errorMessage(err) });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 rounded-lg border border-sky-500/30 bg-sky-500/[0.04] p-4">
      <div>
        <Label className="text-xs" htmlFor="dsv-link">Link do caso no Azure *</Label>
        <div className="relative mt-1.5">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="dsv-link" className="pl-9" inputMode="url" maxLength={2000} value={link}
            onChange={e => { setLink(e.target.value); setErrors(er => ({ ...er, link: undefined })); }}
            placeholder="https://dev.azure.com/empresa/projeto/_workitems/edit/12345" />
        </div>
        {errors.link ? <FieldError msg={errors.link} /> : parsed.url && (
          parsed.isAzure ? (
            <p className="mt-1 text-[11px] text-sky-700 dark:text-sky-300">{parsed.azureId ? `Caso #${parsed.azureId} do Azure DevOps.` : "Link do Azure DevOps."}</p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />Este link não parece do Azure DevOps. Confira antes de registrar.
            </p>
          )
        )}
      </div>
      <div>
        <Label className="text-xs" id="dsv-kind">Tipo *</Label>
        <div role="radiogroup" aria-labelledby="dsv-kind" className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {DSV_KINDS.map(k => (
            <ChoiceCard key={k.value} on={kind === k.value} icon={KIND_ICON[k.value]} title={k.label} hint={k.hint}
              onSelect={() => { setKind(k.value); setErrors(er => ({ ...er, kind: undefined })); }} />
          ))}
        </div>
        <FieldError msg={errors.kind} />
      </div>
      <div>
        <Label className="text-xs" htmlFor="dsv-title">Título *</Label>
        <Input id="dsv-title" className="mt-1.5" maxLength={160} value={title}
          onChange={e => { setTitle(e.target.value); setErrors(er => ({ ...er, title: undefined })); }}
          placeholder="Ex.: Validador não sincroniza as viagens da garagem 2" />
        <FieldError msg={errors.title} />
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-1.5 h-4 w-4" />}Registrar caso
        </Button>
      </div>
    </div>
  );
}
