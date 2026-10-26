import { forwardRef, useMemo } from "react";
import {
  NOME_OPERADORA, OPERADORAS_COBERTURA, aneisDoSetor, pctTexto, periodoTexto,
  type OperadoraCobertura, type ResumoOperadora, type SetoresMunicipio,
} from "@/lib/coberturaOperadoras";

// O mapa vira imagem do e-mail: cores fixas (fundo branco), independentes do tema da tela.
const ESCALA: [number, string][] = [[0, "#d73027"], [25, "#fc8d59"], [50, "#fee08b"], [75, "#91cf60"], [100, "#1a9850"]];
const SEM_DADO = "#d9d4df";
const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

/** Cor do setor pela % com sinal: vermelho (sem sinal) → amarelo → verde (sinal em todo o setor). */
function corCobertura(pct: number | undefined): string {
  if (pct === undefined || Number.isNaN(pct)) return SEM_DADO;
  const v = Math.max(0, Math.min(100, pct));
  const i = Math.min(ESCALA.length - 2, Math.floor(v / 25));
  const [p0, c0] = ESCALA[i], [p1, c1] = ESCALA[i + 1];
  const t = (v - p0) / (p1 - p0), a = hex(c0), b = hex(c1);
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(",")})`;
}

const W = 1200, M = 28, GAP = 28, TOPO = 78, CAB = 52, LEG = 64, RODAPE = 30;
const PAINEL = (W - 2 * M - GAP) / 2;

/**
 * Mapa de calor da cobertura 4G, Claro | Vivo lado a lado, por setor censitário.
 * É o mesmo SVG da tela que vira o PNG do e-mail (svgParaPng).
 */
export const MapaCoberturaSvg = forwardRef<SVGSVGElement, {
  setores: SetoresMunicipio;
  resumo: ResumoOperadora[];
  recomendada: OperadoraCobertura | null;
  className?: string;
}>(function MapaCoberturaSvg({ setores, resumo, recomendada, className }, ref) {
  const desenho = useMemo(() => {
    const [x0, y0, x1, y1] = setores.bbox;
    const cos = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    const larguraGeo = (x1 - x0) * cos, alturaGeo = y1 - y0;
    // cabe no painel: largura cheia, altura entre 300 e 620
    let mapaW = PAINEL, mapaH = (PAINEL * alturaGeo) / larguraGeo;
    if (mapaH > 620) { mapaW = (620 * larguraGeo) / alturaGeo; mapaH = 620; }
    const altura = Math.max(mapaH, 300);
    // centraliza o município no painel
    const s = mapaW / larguraGeo, dx = (PAINEL - mapaW) / 2, dy = (altura - mapaH) / 2;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const paths = setores.setores.map(st => ({
      c: st.c,
      v: st.v,
      d: aneisDoSetor(st).map(anel => anel.map(([lon, lat], i) => `${i ? "L" : "M"}${r1(dx + (lon - x0) * cos * s)},${r1(dy + (y1 - lat) * s)}`).join("") + "Z").join(""),
    }));
    return { paths, mapaH: altura };
  }, [setores]);

  const H = TOPO + CAB + desenho.mapaH + LEG + RODAPE;
  const cidade = `${setores.municipio.nome}/${setores.municipio.uf}`;
  const yMapa = TOPO + CAB;
  const yLeg = yMapa + desenho.mapaH + 22;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={className} role="img" fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
      aria-label={`Mapa de calor da cobertura 4G da Claro e da Vivo em ${cidade}, por setor censitário`}>
      <rect width={W} height={H} fill="#ffffff" />
      <text x={M} y={38} fontSize="24" fontWeight="700" fill="#1f1630">Cobertura 4G estimada · {cidade}</text>
      <text x={M} y={62} fontSize="14" fill="#645a72">Anatel {periodoTexto(setores.periodo)} · por setor censitário do IBGE (Censo 2022)</text>

      {OPERADORAS_COBERTURA.map((op, i) => {
        const x = M + i * (PAINEL + GAP);
        const r = resumo.find(z => z.operadora === op);
        const rec = op === recomendada;
        return (
          <g key={op}>
            <text x={x} y={TOPO + 24} fontSize="20" fontWeight="700" fill="#1f1630">{NOME_OPERADORA[op]}</text>
            <text x={x} y={TOPO + 44} fontSize="14" fill="#645a72">{r ? `${pctTexto(r.area4g)} da área com 4G` : "sem dados"}</text>
            {rec && (
              <g transform={`translate(${x + PAINEL - 132}, ${TOPO + 8})`}>
                <rect width="132" height="26" rx="13" fill="#dcf3ea" />
                <text x="66" y="17.5" fontSize="12" fontWeight="700" fill="#047857" textAnchor="middle" letterSpacing="0.6">RECOMENDADA</text>
              </g>
            )}
            <g transform={`translate(${x}, ${yMapa})`}>
              <rect width={PAINEL} height={desenho.mapaH} fill="#f7f5fa" rx="8" />
              {desenho.paths.map(p => (
                <path key={p.c} d={p.d} fill={corCobertura(p.v[op]?.[0])} fillRule="evenodd" stroke="#ffffff" strokeWidth="0.5" strokeLinejoin="round" />
              ))}
            </g>
          </g>
        );
      })}

      {/* Legenda */}
      <defs>
        <linearGradient id="cobertura-escala" x1="0" x2="1" y1="0" y2="0">
          {ESCALA.map(([p, c]) => <stop key={p} offset={`${p}%`} stopColor={c} />)}
        </linearGradient>
      </defs>
      <text x={M} y={yLeg} fontSize="13" fill="#645a72">% do setor com sinal 4G</text>
      <rect x={M} y={yLeg + 10} width="320" height="14" rx="3" fill="url(#cobertura-escala)" />
      {[0, 50, 100].map(p => (
        <text key={p} x={M + (320 * p) / 100} y={yLeg + 42} fontSize="12" fill="#645a72" textAnchor={p === 0 ? "start" : p === 100 ? "end" : "middle"}>{p}%</text>
      ))}
      <rect x={M + 352} y={yLeg + 10} width="14" height="14" rx="3" fill={SEM_DADO} />
      <text x={M + 374} y={yLeg + 22} fontSize="12" fill="#645a72">sem dado</text>
      <text x={M} y={H - 12} fontSize="12" fill="#8a8197">
        Fonte: Anatel (cobertura estimada a partir das estações licenciadas) e IBGE (setores censitários, Censo 2022). Não substitui medição em campo.
      </text>
    </svg>
  );
});
