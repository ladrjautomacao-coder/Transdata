import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, List, Signal, Kanban, CalendarRange } from "lucide-react";

export default function Projects() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const branding = useTenantBranding();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cards = [
    ...(isAdmin ? [{
      title: "Cadastrar Novo Projeto",
      description: "Crie um novo projeto no sistema",
      icon: Plus,
      onClick: () => navigate("/projetos/novo"),
    }] : []),
    {
      title: "Gestão de Projetos",
      description: "Kanban para gerentes de projetos",
      icon: Kanban,
      onClick: () => navigate("/projetos/gestao"),
    },
    {
      title: "Visualizar Projetos",
      description: "Veja e gerencie os projetos existentes",
      icon: List,
      onClick: () => navigate("/projetos/lista"),
    },
    // Teste isolado: Cronograma só aparece pra este tenant enquanto validamos
    // se vale a pena expor pra todo mundo.
    ...(branding.slug === "empresateste" ? [{
      title: "Cronograma",
      description: "Linha do tempo dos projetos por atividade",
      icon: CalendarRange,
      onClick: () => navigate("/projetos/cronograma"),
    }] : []),
  ];

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(hsl(28, 90%, 52%) 1px, transparent 1px), linear-gradient(90deg, hsl(28, 90%, 52%) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Header */}
      <div className="relative z-10 mb-6 text-center sm:mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Signal className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-[0.25em] text-primary font-semibold">
            Módulo de Projetos
          </span>
          <Signal className="h-4 w-4 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
          Projetos
        </h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
          {branding.slug === "transdata"
            ? "Gerencie, monitore e analise seus projetos de bilhetagem"
            : "Gerencie, monitore e analise seus projetos"}
        </p>
      </div>

      {/* Cards */}
      <div className={`relative z-10 grid gap-3 sm:gap-8 w-full max-w-5xl px-4 justify-center ${cards.length <= 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {cards.map((card) => (
          <Card
            key={card.title}
            className="group cursor-pointer transition-all duration-300 hover:-translate-y-2 relative overflow-hidden border-border/50 bg-card shadow-none"
            onClick={card.onClick}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-300" />

            <CardContent className="relative z-10 flex flex-row items-center gap-4 p-5 text-left sm:flex-col sm:gap-5 sm:p-10 sm:text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20 sm:h-16 sm:w-16 sm:rounded-2xl">
                <card.icon className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h2 className="mb-0.5 text-[17px] font-bold sm:mb-1.5 sm:text-xl">{card.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs text-primary font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                <span>Acessar</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom decorative line */}
      <div className="relative z-10 mt-6 sm:mt-12 flex items-center gap-3 text-muted-foreground/40">
        <div className="w-16 h-px bg-gradient-to-r from-transparent to-primary/30" />
        <Signal className="h-3 w-3 text-primary/40" />
        <div className="w-16 h-px bg-gradient-to-l from-transparent to-primary/30" />
      </div>
    </div>
  );
}
