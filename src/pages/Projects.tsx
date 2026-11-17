import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarRange, Kanban, List, ListChecks, Pause, Play, Plus, Signal, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
// vídeos de ambiente gerados na Runway (ver runway/LEIA-ME.md); o .jpg é o primeiro quadro
import videoHero from "@/assets/projetos/hub-hero.mp4";
import posterHero from "@/assets/projetos/hub-hero.jpg";
import videoNovo from "@/assets/projetos/hub-novo.mp4";
import posterNovo from "@/assets/projetos/hub-novo.jpg";
import videoKanban from "@/assets/projetos/hub-kanban.mp4";
import posterKanban from "@/assets/projetos/hub-kanban.jpg";
import videoLista from "@/assets/projetos/hub-lista.mp4";
import posterLista from "@/assets/projetos/hub-lista.jpg";
import videoGerenciamento from "@/assets/projetos/hub-gerenciamento.mp4";
import posterGerenciamento from "@/assets/projetos/hub-gerenciamento.jpg";

const semMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const saudacao = (h: number) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

interface Atalho {
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  rota: string;
  video?: string;
  poster: string;
  /** Número ao vivo no rodapé do cartão (some enquanto carrega). */
  dado?: string | null;
}

/**
 * Um atalho da central: cartão escuro da marca com um clipe de ambiente ao fundo. O clipe fica parado
 * no primeiro quadro e só toca com o mouse em cima ou o foco do teclado (nunca para quem pede menos movimento).
 */
function CartaoAtalho({ a, onAbrir }: { a: Atalho; onAbrir: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const tocar = () => { if (!semMovimento()) video.current?.play().catch(() => { /* fica no primeiro quadro */ }); };
  const parar = () => video.current?.pause();
  return (
    <button type="button" onClick={onAbrir} onMouseEnter={tocar} onMouseLeave={parar} onFocus={tocar} onBlur={parar}
      className="group relative isolate flex min-h-[132px] flex-col overflow-hidden rounded-2xl bg-marca-fundo p-5 text-left text-white shadow-[0_14px_34px_-20px_hsl(var(--marca-fundo)/0.9)] transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-[300px] sm:p-6">
      <img src={a.poster} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
      {a.video && <video ref={video} src={a.video} muted loop playsInline preload="none" aria-hidden tabIndex={-1}
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100" />}
      {/* véu: escurece embaixo, onde fica o texto */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-marca-fundo via-marca-fundo/75 to-marca-fundo/25 sm:via-marca-fundo/55 sm:to-transparent" />
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-marca-laranja via-marca-rosa to-purple-500 transition-transform duration-500 group-hover:scale-x-100 group-focus-visible:scale-x-100" />

      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm transition-colors group-hover:border-marca-laranja/70 group-hover:bg-marca-laranja sm:h-14 sm:w-14 sm:rounded-2xl">
        <a.icone className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
      </span>
      <span className="mt-3 flex flex-1 flex-col sm:mt-auto sm:flex-none">
        <span className="font-display text-[22px] font-bold leading-tight sm:text-[26px]">{a.titulo}</span>
        <span className="mt-1 text-[13px] leading-snug text-white/75">{a.descricao}</span>
        <span className="mt-3 flex items-center gap-3 border-t border-white/15 pt-3 sm:mt-4">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-orange-200">{a.dado ?? " "}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-semibold transition-colors group-hover:bg-white group-hover:text-marca-fundo">
            Acessar<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </span>
      </span>
    </button>
  );
}

/** Central de Projetos: abertura com vídeo e os atalhos do módulo (cada um com um número ao vivo). */
export default function Projects() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, managerId, loading, profile } = useAuth();
  const branding = useTenantBranding();
  // quantos projetos em cada fase (os que o usuário pode ver)
  const { data: porFase } = useQuery({
    queryKey: ["central-projetos-fases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("status");
      if (error) throw error;
      const n: Record<string, number> = {};
      for (const p of data ?? []) n[p.status] = (n[p.status] ?? 0) + 1;
      return n;
    },
    staleTime: 60_000,
  });
  const heroRef = useRef<HTMLVideoElement>(null);
  const [pausado, setPausado] = useState(semMovimento);
  useEffect(() => {
    const v = heroRef.current;
    if (!v) return;
    if (pausado) v.pause(); else v.play().catch(() => setPausado(true));
  }, [pausado, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const de = (s: string) => porFase?.[s] ?? 0;
  const total = porFase ? Object.values(porFase).reduce((a, b) => a + b, 0) : null;
  const emAndamento = porFase ? de("comercial") + de("planejamento") + de("implantacao") : null;
  const atalhos: Atalho[] = [
    ...(isAdmin ? [{
      titulo: "Cadastrar novo projeto", descricao: "Crie um novo projeto no sistema", icone: Plus, rota: "/projetos/novo",
      video: videoNovo, poster: posterNovo, dado: "Novo cadastro",
    }] : []),
    {
      titulo: "Gestão de Projetos", descricao: "Kanban para gerentes de projetos", icone: Kanban, rota: "/projetos/gestao",
      video: videoKanban, poster: posterKanban, dado: emAndamento === null ? null : `${emAndamento} em andamento`,
    },
    {
      titulo: "Visualizar projetos", descricao: "Veja e gerencie os projetos existentes", icone: List, rota: "/projetos/lista",
      video: videoLista, poster: posterLista, dado: total === null ? null : plural(total, "projeto", "projetos"),
    },
    // Gerentes de Projetos (os projetos deles) e Super Admin (todos)
    ...(isSuperAdmin || managerId ? [{
      titulo: "Gerenciamento", descricao: "O roteiro do GP em cada fase do projeto", icone: ListChecks, rota: "/projetos/gerenciamento",
      video: videoGerenciamento, poster: posterGerenciamento, dado: porFase ? `${de("implantacao")} em implantação` : null,
    }] : []),
    // Teste isolado: Cronograma só aparece pra este tenant enquanto validamos se vale a pena expor pra todo mundo.
    ...(branding.slug === "empresateste" ? [{
      titulo: "Cronograma", descricao: "Linha do tempo dos projetos por atividade", icone: CalendarRange, rota: "/projetos/cronograma",
      poster: posterHero, dado: "Em teste",
    }] : []),
  ];
  const primeiroNome = profile?.full_name?.trim().split(/\s+/)[0];
  const hoje = new Date();

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      {/* Abertura: o vídeo ao fundo e a saudação */}
      <section aria-labelledby="central-titulo" className="relative isolate overflow-hidden rounded-3xl text-white shadow-[0_18px_44px_-22px_hsl(var(--marca-fundo)/0.8)]">
        <img src={posterHero} alt="" aria-hidden className="absolute inset-0 -z-30 h-full w-full object-cover" />
        <video ref={heroRef} src={videoHero} poster={posterHero} muted loop playsInline preload="metadata" aria-hidden tabIndex={-1}
          className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-marca-fundo/95 via-marca-logo/75 to-marca-logo/20" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-marca-fundo/90 to-transparent" />

        <div className="flex min-h-[240px] flex-col gap-8 p-6 sm:min-h-[280px] sm:p-9 lg:p-11">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] backdrop-blur-sm">
              <Signal className="h-3.5 w-3.5 text-orange-300" aria-hidden />Módulo de Projetos
            </span>
            <button type="button" onClick={() => setPausado(p => !p)} aria-pressed={pausado} title={pausado ? "Reproduzir o vídeo de fundo" : "Pausar o vídeo de fundo"}
              className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              {pausado ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
              <span className="sr-only">{pausado ? "Reproduzir o vídeo de fundo" : "Pausar o vídeo de fundo"}</span>
            </button>
          </div>

          <div className="max-w-2xl">
            <p className="text-sm text-white/75">
              {saudacao(hoje.getHours())}{primeiroNome ? `, ${primeiroNome}` : ""} · {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 id="central-titulo" className="mt-1 font-display text-5xl font-bold uppercase leading-[0.95] tracking-wide sm:text-6xl lg:text-7xl">
              Central de <span className="bg-gradient-to-r from-marca-laranja to-marca-rosa bg-clip-text text-transparent">Projetos</span>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] text-white/80">
              {branding.slug === "transdata" ? "Gerencie, monitore e analise seus projetos de bilhetagem" : "Gerencie, monitore e analise seus projetos"}, do cadastro à entrega.
            </p>
          </div>
        </div>
      </section>

      {/* Atalhos do módulo */}
      <section aria-label="Atalhos do módulo de projetos"
        className={cn("grid gap-4 sm:grid-cols-2", atalhos.length === 3 ? "xl:grid-cols-3" : atalhos.length >= 5 ? "xl:grid-cols-5" : atalhos.length === 4 && "xl:grid-cols-4")}>
        {atalhos.map(a => <CartaoAtalho key={a.titulo} a={a} onAbrir={() => navigate(a.rota)} />)}
      </section>
    </div>
  );
}
