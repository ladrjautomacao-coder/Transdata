import { useEffect, useState } from "react";
import { NIVEL, type Nivel } from "@/lib/nivelMedidor";

// Medidor em meio círculo: 0% à esquerda, 100% à direita
const CX = 130, CY = 128, R = 100;
const ponto = (pct: number, r = R) => {
  const a = Math.PI * (1 - pct / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};
const arco = (de: number, ate: number) => {
  const [x0, y0] = ponto(de), [x1, y1] = ponto(ate);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};

/** Velocímetro de saúde (Gerenciamento e Grandes Operações), com as faixas de `nivelMedidor`. */
export function Velocimetro({ pct, nivel, rotulo }: { pct: number; nivel: Nivel; /** Leitura para leitor de tela. */ rotulo: string }) {
  // o ponteiro sobe do zero ao abrir (sem animação para quem prefere menos movimento)
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setMostrado(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  const angulo = -90 + (mostrado / 100) * 180;
  return (
    <svg viewBox="0 0 260 150" className="w-full max-w-[320px]" role="img" aria-label={rotulo}>
      {/* faixas de fundo: atenção, em andamento, quase lá */}
      <path d={arco(0, 40)} className="fill-none stroke-red-500/20" strokeWidth={22} />
      <path d={arco(40, 70)} className="fill-none stroke-amber-500/25" strokeWidth={22} />
      <path d={arco(70, 100)} className="fill-none stroke-emerald-500/25" strokeWidth={22} />
      {pct > 0 && <path d={arco(0, pct)} className={`fill-none ${NIVEL[nivel].arco}`} strokeWidth={22} strokeLinecap="round" />}
      {[0, 25, 50, 75, 100].map(t => {
        const [x0, y0] = ponto(t, R - 17), [x1, y1] = ponto(t, R - 11);
        return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} className="stroke-muted-foreground/50" strokeWidth={1.5} />;
      })}
      <text x={CX - R} y={CY + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">0</text>
      <text x={CX + R} y={CY + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">100</text>
      <g style={{ transform: `rotate(${angulo}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 900ms cubic-bezier(.2,.8,.2,1)" }} className="motion-reduce:!transition-none">
        <path d={`M${CX - 4},${CY} L${CX},${CY - R + 26} L${CX + 4},${CY} Z`} className="fill-foreground" />
      </g>
      <circle cx={CX} cy={CY} r={9} className="fill-foreground" />
      <circle cx={CX} cy={CY} r={3.5} className="fill-background" />
    </svg>
  );
}
