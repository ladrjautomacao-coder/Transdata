import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarCheck2, House, Layers, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AreaProjeto = "inicio" | "modulos" | "gestao";

const AREAS: { id: AreaProjeto; nome: string; curto: string; icone: LucideIcon }[] = [
  { id: "inicio", nome: "Início do projeto", curto: "Início", icone: House },
  { id: "modulos", nome: "Módulos de gerenciamento", curto: "Módulos", icone: Layers },
  { id: "gestao", nome: "Gestão de cronograma", curto: "Cronograma", icone: CalendarCheck2 },
];

/** Altura da faixa fixa do portal (h-14): a barra presa fica logo abaixo dela. */
const FAIXA = 56;

/**
 * Navegação do projeto: as três áreas (início, módulos e cronograma) em botões grandes, logo abaixo
 * do cabeçalho. Quando a tela rola e a barra sai de vista, uma cópia compacta fica presa embaixo da
 * faixa do portal, com o "← Projetos" e o nome do projeto, para voltar ou trocar de área de qualquer
 * ponto da página. (O `sticky` não funciona aqui: a moldura do portal tem `overflow: auto`, então a
 * cópia é `fixed`, na largura medida da barra original.)
 */
export function NavProjeto({ area, nomeProjeto, onIr, onVoltar, direita }: {
  area: AreaProjeto;
  nomeProjeto: string;
  onIr: (area: AreaProjeto) => void;
  /** Volta à lista de projetos. */
  onVoltar: () => void;
  /** No lado direito da barra (ex.: "Salvo no banco" nos módulos). */
  direita?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [presa, setPresa] = useState(false);
  const [caixa, setCaixa] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => { const r = el.getBoundingClientRect(); setCaixa({ left: r.left, width: r.width }); };
    medir();
    // a barra original passou para baixo da faixa do portal: mostra a presa
    const io = new IntersectionObserver(([e]) => setPresa(!e.isIntersecting && e.boundingClientRect.top < FAIXA), { rootMargin: `-${FAIXA}px 0px 0px 0px` });
    io.observe(el);
    // a largura muda quando a lateral recolhe ou a janela muda de tamanho
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => { io.disconnect(); ro.disconnect(); window.removeEventListener("resize", medir); };
  }, []);

  const abas = (compacta: boolean) => AREAS.map(a => {
    const on = a.id === area;
    const nome = <><span className="sm:hidden">{a.curto}</span><span className="hidden sm:inline">{a.nome}</span></>;
    return (
      <button key={a.id} type="button" onClick={() => onIr(a.id)} aria-current={on ? "page" : undefined}
        title={on ? `Você está em ${a.nome}` : `Ir para ${a.nome}`}
        className={cn("inline-flex min-w-0 items-center justify-center rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:shrink-0 sm:justify-start sm:gap-2",
          // na barra presa, no celular, como abas de aplicativo: ícone em cima e o nome embaixo, as três do mesmo tamanho
          compacta ? "h-11 flex-col gap-0.5 px-1 text-[11px] leading-none sm:h-9 sm:flex-row sm:px-3 sm:text-[13px]" : "h-11 gap-1.5 px-2 text-[13px] sm:px-4 sm:text-sm",
          on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/70 bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.05]")}>
        <a.icone className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{nome}</span>
      </button>
    );
  });

  return (
    <>
      <div ref={ref} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* no celular as três dividem a largura; do tablet para cima, cada uma no tamanho do nome */}
        <nav aria-label="Áreas do projeto" className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:max-w-full">{abas(false)}</nav>
        {direita && <div className="ml-auto">{direita}</div>}
      </div>

      {presa && caixa && (
        <div className="fixed top-14 z-20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2" style={{ left: caixa.left, width: caixa.width }}>
          <div className="flex items-center gap-2 rounded-b-xl border border-t-0 border-border/70 bg-card/95 px-2.5 py-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/85">
            {/* no celular só a seta (o nome fica para o leitor de tela); do tablet para cima, "← Projetos" */}
            <button type="button" onClick={onVoltar} title="Voltar à lista de projetos"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background text-[13px] font-semibold transition-colors hover:border-primary/40 hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-auto sm:px-3">
              <ArrowLeft className="h-4 w-4" aria-hidden /><span className="sr-only sm:not-sr-only">Projetos</span>
            </button>
            <span aria-hidden className="hidden h-6 w-px shrink-0 bg-border sm:block lg:hidden" />
            <span className="hidden min-w-0 max-w-[260px] truncate text-[13px] font-bold uppercase tracking-wide text-muted-foreground lg:block" title={nomeProjeto}>{nomeProjeto}</span>
            <span aria-hidden className="mx-1 hidden h-6 w-px shrink-0 bg-border lg:block" />
            <nav aria-label="Áreas do projeto (barra fixa)" className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 sm:flex sm:flex-none">{abas(true)}</nav>
          </div>
        </div>
      )}
    </>
  );
}
