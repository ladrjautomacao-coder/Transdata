import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, LayoutGrid, Maximize, Minimize, Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  nomeDeExibicao, MODELO_APRESENTACAO, VELOCIDADES, duracaoDoRoteiro, minutos, segundosNoSlide,
  type DadosApresentacao, type SlideId, type Velocidade,
} from "@/lib/apresentacao";
import logoT from "@/assets/apresentacao/t-laranja.webp";
import { Slide } from "./Slides";

const L = 1280, A = 720;

/** Mostra o slide (1280×720) escalado para a largura pedida. */
export function Palco({ largura, children, className }: { largura: number; children: ReactNode; className?: string }) {
  const s = largura / L;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ width: largura, height: A * s }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${s})` }}>{children}</div>
    </div>
  );
}

/** Mostra o slide ocupando a largura de quem o contém (16:9). */
export function PalcoFluido({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${L} / ${A}` }}>
      {w > 0 && <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${w / L})` }}>{children}</div>}
    </div>
  );
}

const tituloDe = (id: SlideId) => MODELO_APRESENTACAO.find(m => m.id === id)?.titulo ?? id;

/** Velocidade do modo automático: preferência de quem apresenta, guardada no navegador. */
const CHAVE_VELOCIDADE = "apresentacao:velocidade";
export function velocidadeSalva(): Velocidade {
  try {
    const v = localStorage.getItem(CHAVE_VELOCIDADE);
    return VELOCIDADES.some(x => x.id === v) ? (v as Velocidade) : "normal";
  } catch { return "normal"; }
}
function salvarVelocidade(v: Velocidade) {
  try { localStorage.setItem(CHAVE_VELOCIDADE, v); } catch { /* sem armazenamento: vale só agora */ }
}
/** 254 → "04:14" */
const relogio = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Entra e sai da tela cheia do navegador (precisa vir de um clique). */
export function telaCheia(entrar: boolean) {
  try {
    if (entrar && !document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    if (!entrar && document.fullscreenElement) void document.exitFullscreen?.();
  } catch { /* o navegador recusou: segue na janela */ }
}

/**
 * Apresentação em tela inteira: setas, espaço, Page Up/Down (passadores de slide), Home/End e Esc.
 * Modo automático (P liga e pausa) com velocidade, relógio e duração prevista. Ao passar do último
 * slide, oferece registrar a apresentação.
 */
export function ModoApresentacao({ slides, dados, inicio = 0, onSair, onConcluir, automatico = false }: {
  slides: SlideId[];
  dados: DadosApresentacao;
  inicio?: number;
  onSair: () => void;
  /** Registrar a apresentação ao terminar (some quando já registrada). */
  onConcluir?: () => void;
  /** Começar já no modo automático. */
  automatico?: boolean;
}) {
  const total = slides.length;
  const [i, setI] = useState(Math.min(inicio, total - 1));
  const [fim, setFim] = useState(false);
  const [grade, setGrade] = useState(false);
  const [barra, setBarra] = useState(true);
  const [cheia, setCheia] = useState(!!document.fullscreenElement);
  const [esc, setEsc] = useState(1);
  const timer = useRef<number>();
  const [auto, setAuto] = useState(automatico);
  const [vel, setVel] = useState<Velocidade>(velocidadeSalva);
  const [prog, setProg] = useState(0);
  const [decorrido, setDecorrido] = useState(0);

  const sair = useCallback(() => { telaCheia(false); onSair(); }, [onSair]);
  const avancar = useCallback(() => { if (i < total - 1) setI(i + 1); else setFim(true); }, [i, total]);
  const voltar = useCallback(() => { if (fim) setFim(false); else setI(Math.max(0, i - 1)); }, [fim, i]);
  const escolherVel = (v: Velocidade) => { setVel(v); salvarVelocidade(v); };

  // relógio da apresentação
  useEffect(() => {
    const t0 = Date.now();
    const t = window.setInterval(() => setDecorrido(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, []);

  // modo automático: cada slide fica o seu tempo (na velocidade escolhida) e passa sozinho;
  // pausar guarda o que já correu, e trocar de slide recomeça a contagem
  const avancarRef = useRef(avancar);
  avancarRef.current = avancar;
  const corrido = useRef(0);
  useEffect(() => { corrido.current = 0; setProg(0); }, [i, fim]);
  useEffect(() => {
    if (!auto || fim || grade) return;
    const dur = segundosNoSlide(slides[i], vel) * 1000;
    const marco = Date.now();
    const t = window.setInterval(() => {
      const ja = corrido.current + Date.now() - marco;
      setProg(Math.min(1, ja / dur));
      if (ja >= dur) avancarRef.current();
    }, 150);
    return () => { corrido.current += Date.now() - marco; window.clearInterval(t); };
  }, [auto, fim, grade, i, vel, slides]);
  const previsto = duracaoDoRoteiro(slides, vel);

  // escala do quadro para caber na tela
  useEffect(() => {
    const medir = () => setEsc(Math.min(window.innerWidth / L, window.innerHeight / A));
    medir();
    window.addEventListener("resize", medir);
    const fs = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => { window.removeEventListener("resize", medir); document.removeEventListener("fullscreenchange", fs); };
  }, []);

  // a barra some depois de 2,5 s parado (volta ao mexer o mouse)
  const mostrarBarra = useCallback(() => {
    setBarra(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBarra(false), 2500);
  }, []);
  useEffect(() => { mostrarBarra(); return () => window.clearTimeout(timer.current); }, [mostrarBarra]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); if (grade) setGrade(false); else sair(); return; }
      if (grade) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); avancar(); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); voltar(); }
      else if (e.key === "Home") { setFim(false); setI(0); }
      else if (e.key === "End") { setFim(false); setI(total - 1); }
      else if (e.key === "p" || e.key === "P") { e.preventDefault(); setAuto(a => !a); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [avancar, voltar, sair, grade, total]);

  // sem rolagem da página por baixo
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, []);

  const botao = "flex h-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-lilas-claro";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Apresentação da solução: ${nomeDeExibicao(dados.cliente)}`}
      className={cn("fixed inset-0 z-[90] select-none bg-black", !barra && "cursor-none")} onMouseMove={mostrarBarra}>
      {/* o slide, centralizado */}
      <div className="absolute inset-0 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) avancar(); }}>
        <div key={fim ? "fim" : i} className="animate-in fade-in duration-300" style={{ width: L * esc, height: A * esc }} onClick={avancar}>
          {fim ? (
            <Palco largura={L * esc}>
              <div className="slide-td sl-escuro flex flex-col items-center justify-center gap-8 text-center" onClick={e => e.stopPropagation()}>
                <img src={logoT} alt="" aria-hidden className="h-16" />
                <div>
                  <p className="sl-titulo text-[72px]">Fim da apresentação</p>
                  <p className="mt-3 text-[22px] text-white/70">{total} slides para {nomeDeExibicao(dados.cliente)}</p>
                </div>
                <div className="flex gap-4">
                  {onConcluir && (
                    <button type="button" onClick={() => { telaCheia(false); onConcluir(); }}
                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-marca-laranja to-marca-rosa px-8 py-4 text-[22px] font-semibold text-white shadow-[0_10px_30px_hsl(var(--marca-rosa)/0.4)]">
                      <Check className="h-6 w-6" />Registrar a apresentação de hoje
                    </button>
                  )}
                  <button type="button" onClick={() => { setFim(false); setI(0); }} className="flex items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-[20px] font-medium text-white/85 hover:bg-white/10">
                    <RotateCcw className="h-5 w-5" />Recomeçar
                  </button>
                </div>
              </div>
            </Palco>
          ) : (
            <Palco largura={L * esc}><Slide id={slides[i]} dados={dados} n={i + 1} total={total} /></Palco>
          )}
        </div>
      </div>

      {/* barra de controles: aparece ao mexer o mouse */}
      <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-5 pb-4 pt-12 transition-opacity duration-300",
        barra || grade ? "opacity-100" : "pointer-events-none opacity-0")}>
        <div className="flex items-center gap-3 text-white">
          <span className="hidden min-w-0 flex-1 items-center gap-2.5 sm:flex">
            <img src={logoT} alt="" aria-hidden className="h-5" />
            <span className="truncate text-sm font-medium text-white/80">{fim ? "Fim" : tituloDe(slides[i])}</span>
            <span className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs tabular-nums text-white/75 md:flex"
              title={`Tempo decorrido e duração prevista no modo automático (${VELOCIDADES.find(v => v.id === vel)?.nome.toLowerCase()})`}>
              <Timer className="h-3.5 w-3.5" />{relogio(decorrido)}<span className="text-white/45">de ~{minutos(previsto)}</span>
            </span>
          </span>
          <span className="flex flex-1 items-center justify-center gap-1 sm:flex-none">
            <button type="button" className={cn(botao, "w-10")} onClick={voltar} disabled={i === 0 && !fim} aria-label="Slide anterior" title="Anterior (←)"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-[72px] text-center text-sm font-semibold tabular-nums" aria-live="polite" data-total={total}>{fim ? "Fim" : `${i + 1} / ${total}`}</span>
            <button type="button" className={cn(botao, "w-10")} onClick={avancar} disabled={fim} aria-label="Próximo slide" title="Próximo (→ ou espaço)"><ChevronRight className="h-5 w-5" /></button>
          </span>
          <span className="flex flex-1 items-center justify-end gap-1">
            {/* modo automático: o anel mostra quanto falta para o próximo slide */}
            <button type="button" className={cn(botao, "relative w-10", auto && "text-white")} onClick={() => setAuto(a => !a)} aria-pressed={auto}
              aria-label={auto ? "Pausar o modo automático" : "Passar os slides sozinho"} title={auto ? "Pausar (P)" : "Modo automático (P)"}>
              <svg aria-hidden viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                <circle cx="20" cy="20" r="17" fill="none" strokeWidth="2.5" className="stroke-white/15" />
                {auto && <circle cx="20" cy="20" r="17" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-marca-laranja"
                  strokeDasharray={106.8} strokeDashoffset={106.8 * (1 - prog)} />}
              </svg>
              {auto ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
            </button>
            <span role="radiogroup" aria-label="Velocidade do modo automático" className="mr-1 hidden items-center rounded-full bg-white/10 p-0.5 sm:flex">
              {VELOCIDADES.map(v => (
                <button key={v.id} type="button" role="radio" aria-checked={vel === v.id} onClick={() => escolherVel(v.id)}
                  title={`${v.nome}: ${minutos(duracaoDoRoteiro(slides, v.id))} no total`}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-lilas-claro",
                    vel === v.id ? "bg-white text-marca-fundo" : "text-white/70 hover:text-white")}>
                  {v.nome}
                </button>
              ))}
            </span>
            <button type="button" className={cn(botao, "w-10", grade && "bg-white/15")} onClick={() => setGrade(g => !g)} aria-pressed={grade} aria-label="Todos os slides" title="Todos os slides"><LayoutGrid className="h-[18px] w-[18px]" /></button>
            <button type="button" className={cn(botao, "w-10")} onClick={() => telaCheia(!cheia)} aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"} title={cheia ? "Sair da tela cheia" : "Tela cheia"}>
              {cheia ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
            </button>
            <button type="button" className={cn(botao, "gap-1.5 px-3.5 text-sm font-medium")} onClick={sair} title="Sair (Esc)"><X className="h-[18px] w-[18px]" />Sair</button>
          </span>
        </div>
        {/* progresso */}
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-marca-laranja to-marca-rosa transition-[width] duration-300" style={{ width: `${fim ? 100 : ((i + 1) / total) * 100}%` }} />
        </div>
      </div>
      {/* com a barra escondida, o automático segue visível numa linha fina no pé da tela */}
      {auto && !fim && !barra && !grade && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <div className="h-full bg-gradient-to-r from-marca-laranja to-marca-rosa" style={{ width: `${prog * 100}%` }} />
        </div>
      )}

      {/* todos os slides */}
      {grade && (
        <div className="absolute inset-x-0 bottom-[84px] top-0 overflow-y-auto bg-black/80 p-6 backdrop-blur-sm">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {slides.map((id, k) => (
              <button key={id} type="button" onClick={() => { setFim(false); setI(k); setGrade(false); }}
                className={cn("group rounded-xl p-1.5 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-lilas-claro", k === i && !fim && "bg-white/10 ring-2 ring-marca-laranja")}>
                <PalcoFluido className="pointer-events-none rounded-lg"><Slide id={id} dados={dados} n={k + 1} total={total} estatico /></PalcoFluido>
                <span className="mt-1.5 block px-1 text-[13px] text-white/80"><span className="tabular-nums text-white/50">{String(k + 1).padStart(2, "0")}</span> · {tituloDe(id)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
