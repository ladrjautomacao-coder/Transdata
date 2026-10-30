import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Moldura dos blocos do Dashboard: título, uma frase e o que fica à direita do título. */
export function Bloco({ titulo, sub, direita, children, className }: {
  titulo: string; sub?: ReactNode; direita?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section aria-label={titulo} className={cn("flex min-w-0 flex-col rounded-xl border border-border/60 bg-card shadow-sm", className)}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 pt-4">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="text-[15px] font-semibold leading-tight">{titulo}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>}
        </div>
        {direita && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">{direita}</div>}
      </div>
      <div className="min-w-0 flex-1 px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}
