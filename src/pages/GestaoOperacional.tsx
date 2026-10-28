import { useNavigate } from "react-router-dom";
import { Signal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AREAS_OPERACIONAIS, urlArea } from "@/lib/gestaoOperacional";

/**
 * Gestão Operacional (em desenvolvimento, só Super Admin): a porta de entrada dos processos que
 * operavam em outro sistema, com um quadrante por área, no mesmo desenho da página de Projetos.
 */
export default function GestaoOperacional() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center overflow-hidden">
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(hsl(28, 90%, 52%) 1px, transparent 1px), linear-gradient(90deg, hsl(28, 90%, 52%) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Header */}
      <div className="relative z-10 mb-6 text-center sm:mb-10">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Signal className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Módulo Operacional</span>
          <Signal className="h-4 w-4 text-primary" />
        </div>
        <h1 className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
          Gestão Operacional
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Os processos da operação, que hoje rodam em outro sistema, reunidos no portal</p>
        <span className="mt-3 inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">Em desenvolvimento · só Super Admin</span>
      </div>

      {/* Quadrantes */}
      <div className="relative z-10 mx-auto grid w-full max-w-3xl justify-center gap-3 px-4 sm:grid-cols-2 sm:gap-8">
        {AREAS_OPERACIONAIS.map(a => (
          <Card key={a.id} role="link" tabIndex={0} aria-label={`Abrir ${a.titulo}`}
            className="group relative cursor-pointer overflow-hidden border-border/50 bg-card shadow-none transition-all duration-300 hover:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => navigate(urlArea(a))}
            onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); navigate(urlArea(a)); } }}>
            <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 transition-all duration-300 group-hover:from-primary/5 group-hover:to-primary/10" />
            <CardContent className="relative z-10 flex flex-row items-center gap-4 p-5 text-left sm:flex-col sm:gap-5 sm:p-10 sm:text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20 sm:h-16 sm:w-16 sm:rounded-2xl">
                <a.icon className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h2 className="mb-0.5 text-[17px] font-bold sm:mb-1.5 sm:text-xl">{a.titulo}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.descricao}</p>
              </div>
              <div className="hidden translate-y-2 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:flex">
                <span>Acessar</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom decorative line */}
      <div className="relative z-10 mt-6 flex items-center gap-3 text-muted-foreground/40 sm:mt-12">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/30" />
        <Signal className="h-3 w-3 text-primary/40" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/30" />
      </div>
    </div>
  );
}
