import type { Technician } from "@/lib/implantationScheduling";
import { dayTitle } from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";

/** Cabeçalho do "app do técnico" (celular). */
export function MinhaAgendaHeader({ tech, today, title = "Minha agenda" }: { tech: Technician; today: Date; title?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-sm">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
        <p className="text-sm opacity-85">{dayTitle(today)}</p>
      </div>
      <TechAvatar tech={tech} size="h-11 w-11 text-sm ring-primary-foreground/40" />
    </div>
  );
}
