import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  ChevronsUpDown,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmptyBlock } from "@/components/agendamento/AgendaShared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BUCKET = "report-imp";
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface ProjectOption {
  id: string;
  company_name: string;
  project_code: string | null;
  city: string;
}

interface ReportFile {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFileName(name: string) {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return normalized.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150) || "arquivo";
}

export default function ReportImp() {
  const { user, isAdmin } = useAuth();
  const { can, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileSearch, setFileSearch] = useState("");

  const canView = can("report_imp", "view");
  const canUpload = can("report_imp", "create");
  const canDelete = can("report_imp", "delete");

  useEffect(() => {
    if (permissionsLoading || !canView) return;
    supabase
      .from("projects")
      .select("id, company_name, project_code, city")
      .order("company_name")
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Erro ao carregar projetos", description: error.message, variant: "destructive" });
          return;
        }
        setProjects(data ?? []);
      });
  }, [canView, permissionsLoading, toast]);

  const loadFiles = useCallback(async () => {
    if (!selectedProjectId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("report_imp_files")
      .select("id, project_id, file_name, file_path, file_size, content_type, uploaded_by, created_at")
      .eq("project_id", selectedProjectId)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const loadedFiles = data ?? [];
    setFiles(loadedFiles);
    const authorIds = [...new Set(loadedFiles.map(file => file.uploaded_by))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);
      setAuthorNames(Object.fromEntries((profiles ?? []).map(profile => [profile.user_id, profile.full_name || "Usuário"])));
    } else {
      setAuthorNames({});
    }
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => {
    if (canView) void loadFiles();
  }, [canView, loadFiles]);

  const selectedProject = projects.find(project => project.id === selectedProjectId);
  const visibleFiles = useMemo(() => {
    const term = fileSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return files;
    return files.filter(file =>
      file.file_name.toLocaleLowerCase("pt-BR").includes(term)
      || (authorNames[file.uploaded_by] || "").toLocaleLowerCase("pt-BR").includes(term)
    );
  }, [authorNames, fileSearch, files]);

  /** Envia um ou vários arquivos, um de cada vez, e recarrega a lista no fim. */
  const uploadFiles = async (selected: File[]) => {
    if (!user || !selectedProjectId || !canUpload || selected.length === 0) return;
    const tooBig = selected.filter(file => file.size > MAX_FILE_SIZE);
    const accepted = selected.filter(file => file.size <= MAX_FILE_SIZE);
    if (tooBig.length > 0) {
      toast({
        title: tooBig.length === 1 ? "Arquivo acima de 100 MB" : `${tooBig.length} arquivos acima de 100 MB`,
        description: `${tooBig.map(file => file.name).join(", ")} não foi enviado. Selecione arquivos menores.`,
        variant: "destructive",
      });
    }
    if (accepted.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    const sent: string[] = [];
    const failed: string[] = [];
    try {
      for (const [index, file] of accepted.entries()) {
        const path = `${selectedProjectId}/${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        try {
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
          if (uploadError) throw uploadError;

          const { error: metadataError } = await supabase.from("report_imp_files").insert({
            project_id: selectedProjectId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            content_type: file.type || null,
          });
          if (metadataError) {
            await supabase.storage.from(BUCKET).remove([path]);
            throw metadataError;
          }
          sent.push(file.name);
        } catch (error) {
          failed.push(`${file.name}: ${error instanceof Error ? error.message : "não foi possível enviar"}`);
        }
        setUploadProgress(Math.round(((index + 1) / accepted.length) * 100));
      }

      if (sent.length > 0) {
        toast({
          title: sent.length === 1 ? "Arquivo enviado" : `${sent.length} arquivos enviados`,
          description: sent.length === 1 ? `${sent[0]} foi vinculado ao projeto.` : "Todos foram vinculados ao projeto.",
        });
      }
      if (failed.length > 0) {
        toast({ title: "Erro no envio", description: failed.join("\n"), variant: "destructive" });
      }
      await loadFiles();
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadFile = async (file: ReportFile) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.file_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao abrir arquivo", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const deleteFile = async (file: ReportFile) => {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([file.file_path]);
    if (storageError) {
      toast({ title: "Erro ao excluir arquivo", description: storageError.message, variant: "destructive" });
      return;
    }
    const { error: metadataError } = await supabase.from("report_imp_files").delete().eq("id", file.id);
    if (metadataError) {
      toast({ title: "Arquivo removido, mas o registro não foi limpo", description: metadataError.message, variant: "destructive" });
      return;
    }
    setFiles(current => current.filter(item => item.id !== file.id));
    toast({ title: "Arquivo excluído" });
  };

  if (permissionsLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!canView) return <Navigate to="/" replace />;

  const projectPicker = (
    <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={projectPickerOpen}
          aria-label="Selecionar projeto"
          className="h-auto min-h-11 w-full justify-between gap-2 py-1.5 text-left font-normal sm:w-[420px]"
        >
          {selectedProject ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{selectedProject.company_name}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {selectedProject.city}{selectedProject.project_code ? ` · ${selectedProject.project_code}` : ""}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground"><Search className="h-4 w-4" /> Buscar projeto…</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Empresa, código ou cidade..." />
          <CommandList>
            <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
            <CommandGroup>
              {projects.map(project => (
                <CommandItem
                  key={project.id}
                  value={`${project.project_code || ""} ${project.company_name} ${project.city}`}
                  onSelect={() => {
                    setSelectedProjectId(project.id);
                    setProjectPickerOpen(false);
                    setFileSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedProjectId === project.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.company_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{project.city} · {project.project_code || "Sem código"}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const openFilePicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        disabled={uploading}
        onChange={event => void uploadFiles(Array.from(event.target.files ?? []))}
      />

      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Implantação</span>
          <h1 className="text-2xl font-bold tracking-tight">Report IMP</h1>
          <p className="text-sm text-muted-foreground">Envie e consulte os arquivos de implantação de cada projeto.</p>
        </div>
        {selectedProjectId && projectPicker}
      </div>

      {!selectedProjectId ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <EmptyBlock
            icon={FolderOpen}
            title="Escolha um projeto para começar"
            text="Os arquivos de implantação ficam organizados por projeto. Busque pelo nome da empresa, código ou cidade."
            action={<div className="w-[min(420px,calc(100vw-96px))]">{projectPicker}</div>}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-4 py-3">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Arquivos do projeto</h2>
            {!loading && !loadError && (
              <span className="text-xs text-muted-foreground">{files.length} {files.length === 1 ? "arquivo" : "arquivos"}</span>
            )}
            <div className="relative w-full sm:ml-auto sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={fileSearch} onChange={event => setFileSearch(event.target.value)} placeholder="Buscar arquivo ou autor" className="h-9 pl-9 text-sm" />
            </div>
          </div>

          {canUpload && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Enviar arquivos para o projeto"
              aria-disabled={uploading}
              onClick={openFilePicker}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
              onDragOver={event => {
                event.preventDefault();
                if (!uploading) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => {
                event.preventDefault();
                setDragging(false);
                if (!uploading) void uploadFiles(Array.from(event.dataTransfer.files));
              }}
              className={cn(
                "m-4 flex cursor-pointer flex-col items-center gap-3.5 rounded-xl border-2 border-dashed p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:text-left",
                dragging ? "border-primary bg-primary/10" : "border-primary/35 bg-primary/[0.04] hover:bg-primary/[0.07]",
                uploading && "cursor-default",
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div className="w-full min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {uploading ? `Enviando… ${uploadProgress}%` : (
                    <>
                      <span className="hidden sm:inline">Arraste arquivos para cá ou clique para selecionar</span>
                      <span className="sm:hidden">Toque para enviar arquivos</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Qualquer formato · até 100 MB por arquivo · vários de uma vez</p>
                {uploading && <Progress value={uploadProgress} className="mt-2 h-1.5" />}
              </div>
              <Button size="sm" className="h-9" tabIndex={-1} disabled={uploading} onClick={event => { event.stopPropagation(); openFilePicker(); }}>
                {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
                Selecionar arquivos
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-2 px-4 pb-4 pt-1">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : loadError ? (
            <div className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="min-w-0 flex-1">
                <span className="font-semibold">Não foi possível carregar os arquivos.</span>{" "}
                <span className="text-muted-foreground">{loadError}</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => void loadFiles()}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          ) : files.length === 0 ? (
            <EmptyBlock
              icon={FileText}
              title="Nenhum arquivo enviado ainda"
              text={canUpload ? "Use a área acima para enviar o primeiro arquivo deste projeto." : "Os arquivos enviados para este projeto aparecerão aqui."}
            />
          ) : visibleFiles.length === 0 ? (
            <EmptyBlock
              icon={SearchX}
              title="Nenhum arquivo com essa busca"
              text="Tente outro nome de arquivo ou autor."
              action={<Button variant="outline" size="sm" onClick={() => setFileSearch("")}>Limpar busca</Button>}
            />
          ) : (
            <ul className={cn(!canUpload && "[&>li:first-child]:border-t-0")}>
              {visibleFiles.map(file => {
                const mayDelete = canDelete && (isAdmin || file.uploaded_by === user?.id);
                return (
                  <li key={file.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={file.file_name}>{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)} · {authorNames[file.uploaded_by] || "Usuário"} · {format(new Date(file.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => void downloadFile(file)} title="Baixar" aria-label={`Baixar ${file.file_name}`}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {mayDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Excluir"
                            aria-label={`Excluir ${file.file_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação removerá “{file.file_name}” permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void deleteFile(file)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
