import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, ExternalLink, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESPONSAVEL_LABEL, type Atividade, type SituacaoAtividade } from "@/lib/gerenciamento";

// Peças comuns das atividades dos módulos do Gerenciamento.

const SITUACAO: Record<SituacaoAtividade, { dot: string; pill: string; label: string }> = {
  feito: { dot: "bg-emerald-600 text-white", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Feito" },
  afazer: { dot: "bg-primary text-primary-foreground", pill: "bg-primary/10 text-primary", label: "A fazer" },
  aguardando: { dot: "bg-amber-500 text-white", pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200", label: "Aguardando" },
  bloqueado: { dot: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground", label: "Aguarda o checklist" },
  naoaplica: { dot: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground", label: "Não se aplica" },
};

/** Setas para subir/descer a atividade enquanto a ordem oficial não é definida. */
export interface Mover { up: boolean; down: boolean; onMove: (dir: -1 | 1) => void }

/** Uma atividade na linha do módulo: número/estado à esquerda, cartão à direita. */
export function Etapa({ n, a, sit, pill, last, mover, children }: {
  n: number; a: Atividade<string>; sit: SituacaoAtividade; pill?: string; last: boolean; mover?: Mover; children: ReactNode;
}) {
  const s = SITUACAO[sit];
  const muted = sit === "bloqueado" || sit === "naoaplica";
  return (
    <li id={`ger-atv-${a.id}`} className="relative scroll-mt-6 pl-11 sm:pl-12">
      <span aria-hidden className={`absolute left-0 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ring-4 ring-background ${s.dot}`}>
        {sit === "feito" ? <Check className="h-4 w-4" /> : sit === "bloqueado" ? <Lock className="h-4 w-4" /> : n}
      </span>
      {!last && <span aria-hidden className="absolute bottom-[-14px] left-[17px] top-12 w-0.5 bg-border" />}
      <div className={`rounded-xl border p-4 ${muted ? "border-dashed border-border bg-muted/30" : "border-border/60 bg-card shadow-sm"}`}>
        {/* no celular os selos descem para baixo do título */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={`text-[15px] font-semibold ${muted ? "text-muted-foreground" : ""}`}>{a.titulo}</h3>
            <p className="text-[13px] text-muted-foreground">{a.descricao}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:order-last">
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{RESPONSAVEL_LABEL[a.responsavel]}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}>{pill ?? s.label}</span>
            {mover && (
              <span className="ml-1 flex overflow-hidden rounded-md border border-border/70 bg-background">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" disabled={!mover.up} onClick={() => mover.onMove(-1)} aria-label={`Subir ${a.titulo}`} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border-l border-border/70" disabled={!mover.down} onClick={() => mover.onMove(1)} aria-label={`Descer ${a.titulo}`} title="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
              </span>
            )}
          </div>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

/** Abre em outra aba o link digitado no campo (desabilitado enquanto não for um link). */
export function AbrirLink({ href }: { href: string | null }) {
  if (!href) {
    return <Button variant="outline" className="h-9" disabled title="Cole o link no campo para abrir"><ExternalLink className="mr-1.5 h-4 w-4" />Abrir</Button>;
  }
  return (
    <Button variant="outline" className="h-9" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer" title={href}><ExternalLink className="mr-1.5 h-4 w-4" />Abrir</a>
    </Button>
  );
}

/** Linha "Feito em … por …" com desfazer (`rotulo`: outro nome para o desfazer, ex.: "Alterar"). */
export function Registro({ texto, onDesfazer, rotulo = "Desfazer", children }: { texto: string; onDesfazer?: () => void; rotulo?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-[13px]">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0 flex-1">{texto}{children}</span>
      {onDesfazer && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onDesfazer}><RotateCcw className="mr-1 h-3.5 w-3.5" />{rotulo}</Button>}
    </div>
  );
}
