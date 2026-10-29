import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SITUACAO_NOME, STATUS_NOME, STATUS_ORDEM, type GoSituacao, type GoStats, type GoStatus } from "@/lib/grandesOperacoes/dados";
import { COR_STATUS } from "@/lib/grandesOperacoes/ui";
import { cn } from "@/lib/utils";

// Peças comuns das telas do Hub de Grandes Operações.

export function Dot({ status, className = "" }: { status: GoStatus; className?: string }) {
  return <i aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${COR_STATUS[status].dot} ${className}`} />;
}

/** Marcas "vem antes" / "vem depois" da atividade selecionada. */
export function RelTag({ pred, succ, curto = false }: { pred: boolean; succ: boolean; curto?: boolean }) {
  if (pred) return <span className="shrink-0 rounded bg-primary/10 px-1.5 text-[10.5px] font-bold text-primary">{curto ? "antes" : "vem antes"}</span>;
  if (succ) return <span className="shrink-0 rounded bg-orange-500/15 px-1.5 text-[10.5px] font-bold text-orange-700 dark:text-orange-300">{curto ? "depois" : "vem depois"}</span>;
  return null;
}

export function StatusPill({ status }: { status: GoStatus }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${COR_STATUS[status].pill}`}>{STATUS_NOME[status]}</span>;
}

/** O selo de status que abre a lista dos quatro status (para quem pode editar). */
export function StatusSelect({ status, onChange, codigo, className }: { status: GoStatus; onChange: (s: GoStatus) => void; codigo: string; className?: string }) {
  return (
    <Select value={status} onValueChange={v => onChange(v as GoStatus)}>
      <SelectTrigger aria-label={`Status de ${codigo}`} onClick={e => e.stopPropagation()}
        className={cn("h-7 w-auto shrink-0 gap-1.5 rounded-full border-0 px-2.5 text-[11px] font-semibold shadow-none focus:ring-2 focus:ring-ring focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70", COR_STATUS[status].pill, className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={e => e.stopPropagation()}>
        {STATUS_ORDEM.map(s => (
          <SelectItem key={s} value={s} className="text-[13px]">
            <span className="inline-flex items-center gap-2"><Dot status={s} />{STATUS_NOME[s]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Selo da situação do projeto (só aparece quando não é "ativo"). */
export function SituacaoPill({ situacao }: { situacao: GoSituacao }) {
  if (situacao === "ativo") return null;
  const cor = situacao === "pausado" ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-muted text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${cor}`}>{SITUACAO_NOME[situacao]}</span>;
}

/** Barra de progresso: concluídas em verde e em andamento em azul. */
export function Barra({ s, className = "h-1.5" }: { s: GoStats; className?: string }) {
  const dw = s.total ? (s.done / s.total) * 100 : 0, gw = s.total ? (s.doing / s.total) * 100 : 0;
  return (
    <span className={`flex w-full overflow-hidden rounded-full bg-muted ${className}`} aria-hidden>
      <i className="h-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${dw}%` }} />
      <i className="h-full bg-sky-500 transition-[width] duration-500" style={{ width: `${gw}%` }} />
    </span>
  );
}

/** Cabeçalho das telas do Hub: volta, sobretítulo, selo de desenvolvimento, título, ações e o que vem embaixo (`meta`). */
export function GoCabecalho({ voltar, titulo, sub, acoes, meta }: { voltar: { to: string; label: string }; titulo: string; sub: ReactNode; acoes?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Button variant="ghost" size="sm" className="-ml-2 h-8 w-fit text-muted-foreground" asChild>
        <Link to={voltar.to}><ArrowLeft className="mr-1.5 h-4 w-4" />{voltar.label}</Link>
      </Button>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gestão Operacional · Grandes Operações</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">Em desenvolvimento · só Super Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{sub}</p>
          {meta && <div className="mt-2 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
        {acoes && <div className="ml-auto flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </div>
  );
}

export function GoErro({ erro, onTentar }: { erro: string; onTentar: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
      <span className="min-w-0 flex-1">Não foi possível carregar os dados do Hub. {erro}</span>
      <Button size="sm" variant="outline" onClick={onTentar}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
    </div>
  );
}
