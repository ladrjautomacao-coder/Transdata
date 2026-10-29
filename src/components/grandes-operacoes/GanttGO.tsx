import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  STATUS_NOME, etapaNome, etapaNum, etapaStatus, etapasOf, hojeTexto, nomeCurto, stats, subLevel,
  type GoAtividade, type GoDados, type GoRel, type GoStatus,
} from "@/lib/grandesOperacoes/dados";
import { calcularPrevisao, ehDiaUtil, lerData, lerDuracao, temBarra, type ResultadoBarra, type ResultadoPrevisao } from "@/lib/grandesOperacoes/previsao";
import { COR_STATUS, CORES_PROJETO } from "@/lib/grandesOperacoes/ui";
import { Dot, RelTag, StatusPill } from "./GoShared";

// Visão Gantt do painel (tradução do gantt.js do original): só leitura das datas, que vêm de
// calcularPrevisao. Os filtros de cima do painel (cliente, projeto, busca, responsável) valem aqui.

const GZ = { dia: { px: 34, label: "Dias" }, semana: { px: 14, label: "Semanas" }, mes: { px: 5, label: "Meses" } } as const;
type Zoom = keyof typeof GZ;
const G_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const G_MESF = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const G_SEM = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIA = 864e5;
const H = { proj: 42, et: 34, act: 34 };
const STS: [GoStatus, string][] = [["concluido", "Concluídas"], ["andamento", "Em andamento"], ["espera", "Em espera"]];
// pendente = estimativa, desenhada hachurada
const HACHURA = "repeating-linear-gradient(135deg, rgba(255,255,255,.32) 0 5px, transparent 5px 10px)";

const gDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA);
const gFmt = (d: Date | null | undefined) => (d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "");
const gDurTxt = (s: string) => { const n = lerDuracao(s); return n ? `${n} ${n > 1 ? "dias" : "dia"}` : ""; };

// escala, marcação e ligações ficam lembradas no navegador (a mesma chave do original)
const GANTT_KEY = "go-gantt";
function lerSalvo(): { zoom: Zoom; marked: Set<number>; links: boolean } {
  try {
    const s = JSON.parse(localStorage.getItem(GANTT_KEY) ?? "{}");
    return { zoom: s.zoom in GZ ? s.zoom : "semana", marked: new Set(Array.isArray(s.marked) ? s.marked.map(Number) : []), links: !!s.links };
  } catch { return { zoom: "semana", marked: new Set(), links: false }; }
}

type Linha =
  | { t: "proj"; p: number; acts: GoAtividade[]; key: string }
  | { t: "et"; e: ReturnType<typeof etapasOf>[number]; p: number; acts: GoAtividade[]; key: string }
  | { t: "act"; a: GoAtividade; p: number };

export function GanttGO({ dados, visiveis, act, onSelect, rel }: {
  dados: GoDados;
  /** Atividades que passam nos filtros do painel. */
  visiveis: GoAtividade[];
  act: number | null;
  /** Clicar de novo na mesma atividade solta a seleção. */
  onSelect: (id: number | null) => void;
  rel: GoRel;
}) {
  const salvo = useMemo(lerSalvo, []);
  const [zoom, setZoom] = useState<Zoom>(salvo.zoom);
  const [marked, setMarked] = useState<Set<number>>(salvo.marked);
  const [links, setLinks] = useState(salvo.links);
  const [hideProj, setHideProj] = useState<Set<number>>(new Set());
  const [etapa, setEtapa] = useState("all");
  const [sts, setSts] = useState<Set<GoStatus>>(new Set(["concluido", "andamento", "espera"]));
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [tip, setTip] = useState<{ a: GoAtividade; r: ResultadoBarra; x: number; y: number } | null>(null);
  const scRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try { localStorage.setItem(GANTT_KEY, JSON.stringify({ zoom, marked: Array.from(marked), links })); } catch { /* ignore */ }
  }, [zoom, marked, links]);

  // a previsão é calculada sobre todas as atividades, como no original
  const hoje = hojeTexto();
  const S = useMemo(() => calcularPrevisao(dados.atividades, dados.projetos, hoje), [dados, hoje]);
  const t0 = lerData(hoje)!;
  const pAll = dados.projetos.map(p => p.id);
  const pColor = (pid: number) => CORES_PROJETO[Math.max(0, pAll.indexOf(pid)) % CORES_PROJETO.length];
  const pNome = (pid: number) => dados.proj.get(pid)?.nome ?? "";

  const base = visiveis.filter(a => a.status !== "removido");
  const projsHere: number[] = [];
  base.forEach(a => { if (!projsHere.includes(a.projeto_id)) projsHere.push(a.projeto_id); });
  const byProj = base.filter(a => !hideProj.has(a.projeto_id));
  const etOpts = etapasOf(dados, byProj);
  const etapaSel = etapa !== "all" && !etOpts.some(e => String(e.key) === etapa) ? "all" : etapa;
  const inEt = (a: GoAtividade) => etapaSel === "all" || String(a.etapa_id) === etapaSel;
  const list = byProj.filter(a => sts.has(a.status) && inEt(a) && (!onlyMarked || marked.has(a.id)));
  const nMarked = Array.from(marked).filter(id => dados.act.has(id)).length;
  const cnt = (st: GoStatus) => byProj.filter(a => a.status === st && inEt(a) && (!onlyMarked || marked.has(a.id))).length;
  // etapas 100% concluídas começam recolhidas, para o foco ficar no que falta
  const fechada = (key: string, etapaId?: number) =>
    closed[key] ?? (etapaId != null && etapaStatus(base.filter(a => a.etapa_id === etapaId)) === "concluido");
  const alternarProj = (p: number) => setHideProj(s => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const alternarStatus = (k: GoStatus) => setSts(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // ---- linhas: projeto → etapa → atividade ----
  const rows: Linha[] = [];
  const projsL: number[] = [];
  list.forEach(a => { if (!projsL.includes(a.projeto_id)) projsL.push(a.projeto_id); });
  projsL.forEach(p => {
    const pl = list.filter(a => a.projeto_id === p);
    rows.push({ t: "proj", p, acts: pl, key: `p:${p}` });
    if (fechada(`p:${p}`)) return;
    etapasOf(dados, pl).forEach(e => {
      const k = `e:${e.key}`;
      rows.push({ t: "et", e, p, acts: e.acts, key: k });
      if (fechada(k, e.key)) return;
      e.acts.forEach(a => rows.push({ t: "act", a, p }));
    });
  });

  // ---- escala ----
  let mn: Date | null = null, mx: Date | null = null;
  const upd = (s: Date, e: Date) => { if (!mn || s < mn) mn = s; if (!mx || e > mx) mx = e; };
  list.forEach(a => {
    const r = S[a.id];
    if (!r) return;
    if (temBarra(r)) upd(r.inicio, r.fim); else if (r.tipo === "planejar") upd(r.inicio, r.inicio);
  });
  upd(t0, t0);
  let from = new Date(mn!), to = new Date(mx!);
  from.setDate(from.getDate() - 7); to.setDate(to.getDate() + 28);
  if (zoom === "mes") { from = new Date(from.getFullYear(), from.getMonth(), 1); to = new Date(to.getFullYear(), to.getMonth() + 1, 0); }
  else { while (from.getDay() !== 1) from.setDate(from.getDate() - 1); while (to.getDay() !== 0) to.setDate(to.getDate() + 1); }
  const px = GZ[zoom].px, nDays = gDiff(from, to) + 1, W = nDays * px, X = (d: Date) => gDiff(from, d) * px;
  const LW = typeof window !== "undefined" && window.innerWidth < 700 ? 190 : 360;
  const tx = X(t0) + px / 2;

  // ao abrir e ao trocar a escala, a rolagem vai para hoje; nos outros cliques fica onde estava
  const irParaHoje = (suave: boolean) => {
    const sc = scRef.current; if (!sc) return;
    sc.scrollTo({ left: Math.max(0, tx - (sc.clientWidth - LW) * 0.22), behavior: suave ? "smooth" : "auto" });
  };
  useLayoutEffect(() => { irParaHoje(false); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const cabecalho: { s: Date; e: Date; label: string; cls: string }[] = [];
  const meses: Date[] = [];
  for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const s = d < from ? from : d, e0 = new Date(d.getFullYear(), d.getMonth() + 1, 0), e = e0 > to ? to : e0;
    cabecalho.push({ s, e, label: zoom === "mes" ? G_MES[d.getMonth()] : `${G_MESF[d.getMonth()]} ${d.getFullYear()}`, cls: zoom === "mes" ? "bot" : "top" });
    if (d >= from) meses.push(d);
  }
  if (zoom === "mes") {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      const s = new Date(Math.max(from.getTime(), new Date(y, 0, 1).getTime())), e = new Date(Math.min(to.getTime(), new Date(y, 11, 31).getTime()));
      cabecalho.push({ s, e, label: String(y), cls: "top" });
    }
  } else if (zoom === "dia") {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) cabecalho.push({ s: new Date(d), e: new Date(d), label: `${G_SEM[d.getDay()]} ${d.getDate()}`, cls: `bot c${ehDiaUtil(d) ? "" : " we"}` });
  } else {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 7)) {
      const e = new Date(d); e.setDate(e.getDate() + 6);
      cabecalho.push({ s: new Date(d), e: e > to ? to : e, label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, cls: "bot" });
    }
  }
  const naoUteis: Date[] = [];
  if (zoom !== "mes") for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) if (!ehDiaUtil(d)) naoUteis.push(new Date(d));

  const span = (acts: GoAtividade[]) => {
    let s: Date | null = null, e: Date | null = null;
    acts.forEach(a => { const r = S[a.id]; if (!r || !temBarra(r)) return; if (!s || r.inicio < s) s = r.inicio; if (!e || r.fim > e) e = r.fim; });
    return s && e ? { s: s as Date, e: e as Date } : null;
  };

  // posições das barras, para desenhar as ligações
  const pos: Record<number, { x1: number; x2: number; y: number }> = {};
  let yAcum = 0;
  rows.forEach(r => {
    const h = H[r.t];
    if (r.t === "act") {
      const s = S[r.a.id];
      if (s && temBarra(s)) { const l = X(s.inicio), w = Math.max(px * 0.7, (gDiff(s.inicio, s.fim) + 1) * px); pos[r.a.id] = { x1: l, x2: l + w, y: yAcum + h / 2 }; }
    }
    yAcum += h;
  });
  const alturaTotal = yAcum;
  const caminhos: { d: string; cls: "" | "pr" | "su" }[] = [];
  rows.forEach(r => {
    if (r.t !== "act") return;
    const a = r.a, para = pos[a.id]; if (!para) return;
    a.predecessoras.forEach(pid => {
      const de = pos[pid]; if (!de) return;
      const isSel = act != null && (a.id === act || pid === act);
      if (!links && !isSel) return;
      const cls = !isSel ? "" : a.id === act ? "pr" : "su";
      const x1 = de.x2, y1 = de.y, x2 = para.x1, y2 = para.y, dx = Math.max(18, Math.min(60, Math.abs(x2 - x1) / 2));
      caminhos.push({ d: `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2 - 3} ${y2}`, cls });
    });
  });

  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"}`;
  const contagem = "rounded-full bg-muted px-1.5 text-[10.5px] font-bold tabular-nums text-foreground/80";
  const colEsq: CSSProperties = { width: LW };

  return (
    <div className="flex flex-col gap-3">
      {/* controles */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {projsHere.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Projetos</span>
              {projsHere.map(p => (
                <button key={p} type="button" aria-pressed={!hideProj.has(p)} title={pNome(p)} className={chip(!hideProj.has(p))}
                  onClick={() => alternarProj(p)}>
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: pColor(p), opacity: hideProj.has(p) ? 0.35 : 1 }} />{nomeCurto(dados.proj.get(p))}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Status</span>
            {STS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={sts.has(k)} className={chip(sts.has(k))} onClick={() => alternarStatus(k)}>
                <Dot status={k} className={sts.has(k) ? "" : "opacity-40"} />{l} <span className={contagem}>{cnt(k)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Select value={etapaSel} onValueChange={setEtapa}>
            <SelectTrigger className="h-8 w-full max-w-[300px] text-xs sm:w-[300px]" aria-label="Etapa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {etOpts.map(e => <SelectItem key={e.key} value={String(e.key)}>{`${e.num} · ${e.nome}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[12.5px]" title="Marque atividades na caixinha ao lado do código para montar uma seleção">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" checked={onlyMarked} onChange={ev => setOnlyMarked(ev.target.checked)} />
            Só as marcadas <span className={contagem}>{nMarked}</span>
          </label>
          {nMarked > 0 && <button type="button" className="text-[12px] font-medium text-primary hover:underline" onClick={() => { setMarked(new Set()); setOnlyMarked(false); }}>limpar marcação</button>}
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" checked={links} onChange={ev => setLinks(ev.target.checked)} />Mostrar ligações
          </label>
          <span className="flex-1" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setClosed(c => ({ ...Object.fromEntries(Object.keys(c).map(k => [k, false])), ...Object.fromEntries(etapasOf(dados, list).map(e => [`e:${e.key}`, false])) }))}>Expandir</Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setClosed(c => ({ ...c, ...Object.fromEntries(etapasOf(dados, list).map(e => [`e:${e.key}`, true])) }))}>Recolher etapas</Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!list.length} onClick={() => irParaHoje(true)}>Hoje</Button>
            <div role="group" aria-label="Escala" className="flex rounded-lg border p-0.5">
              {(Object.keys(GZ) as Zoom[]).map(k => (
                <button key={k} type="button" aria-pressed={zoom === k} onClick={() => setZoom(k)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${zoom === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{GZ[k].label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
          <p>Clique numa <b className="text-foreground">barra</b> ou no <b className="text-foreground">nome</b> para ver os detalhes abaixo (clique de novo para soltar). Use a caixinha ao lado do código para <b className="text-foreground">marcar</b> atividades.</p>
          <div className="flex flex-wrap items-center gap-3">
            {STS.map(([k]) => <span key={k} className="inline-flex items-center gap-1.5"><Dot status={k} />{STATUS_NOME[k]}</span>)}
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-[18px] rounded-sm bg-sky-500" style={{ backgroundImage: HACHURA }} />estimativa</span>
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3.5 w-0.5 bg-orange-500" />hoje</span>
          </div>
        </div>
      </div>

      {!list.length ? (
        <div className="rounded-xl border border-border/60 bg-card px-4 py-9 text-center text-sm text-muted-foreground">
          {onlyMarked && !nMarked ? "Nenhuma atividade marcada ainda. Desligue “Só as marcadas” e marque as que quiser acompanhar." : "Nenhuma atividade com esses filtros."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div ref={scRef} className="relative max-h-[72vh] overflow-auto overscroll-contain">
            <div className="relative" style={{ width: LW + W }}>
              {/* cabeçalho: meses / semanas / dias */}
              <div className="sticky top-0 z-[6] flex border-b bg-card">
                <div className="sticky left-0 z-[7] flex h-[52px] shrink-0 items-end border-r bg-card px-3.5 pb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground" style={colEsq}>Projeto · etapa · atividade</div>
                <div className="relative h-[52px] shrink-0" style={{ width: W }}>
                  {cabecalho.map((c, i) => (
                    <div key={i} className={`absolute flex items-center overflow-hidden whitespace-nowrap border-l border-border/50 text-[11px] text-muted-foreground ${c.cls.includes("top") ? "top-0 h-[26px] pl-1.5 font-bold text-foreground/80" : "top-[26px] h-[26px] border-t border-border/50 tabular-nums"} ${c.cls.includes(" c") ? "justify-center" : "pl-1.5"} ${c.cls.includes("we") ? "bg-muted/60 text-muted-foreground/70" : ""}`}
                      style={{ left: X(c.s), width: (gDiff(c.s, c.e) + 1) * px }}>{c.label}</div>
                  ))}
                  <span className="absolute bottom-[3px] z-[2] -translate-x-1/2 rounded-full bg-orange-500 px-1.5 text-[9.5px] font-bold uppercase tracking-wide text-white" style={{ left: tx }}>hoje</span>
                </div>
              </div>

              <div className="relative">
                {/* fundo: dias não úteis, viradas de mês e hoje */}
                <div className="pointer-events-none absolute bottom-0 top-0 z-0" style={{ left: LW, width: W }}>
                  {naoUteis.map(d => <div key={d.getTime()} className="absolute bottom-0 top-0 bg-muted/60" style={{ left: X(d), width: px }} />)}
                  {meses.map(d => <div key={d.getTime()} className="absolute bottom-0 top-0 border-l border-dashed border-border" style={{ left: X(d) }} />)}
                  <div className="absolute bottom-0 top-0 -ml-px w-0.5 bg-orange-500/85" style={{ left: tx }} />
                </div>

                {rows.map(r => {
                  if (r.t === "proj") {
                    const st = stats(base.filter(a => a.projeto_id === r.p)), sp = span(r.acts), aberta = !fechada(r.key), pc = pColor(r.p);
                    const l = sp ? X(sp.s) : 0, w = sp ? (gDiff(sp.s, sp.e) + 1) * px : 0;
                    return (
                      <div key={r.key} className="relative z-[1] flex border-b border-border/50" style={{ height: H.proj }}>
                        <button type="button" aria-expanded={aberta} onClick={() => setClosed(c => ({ ...c, [r.key]: aberta }))}
                          className="sticky left-0 z-[4] flex shrink-0 items-center gap-2 border-r bg-muted pl-3 pr-2.5 text-left text-[13px] font-bold hover:bg-muted/80"
                          style={{ ...colEsq, boxShadow: `inset 4px 0 0 ${pc}` }}>
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${aberta ? "" : "-rotate-90"}`} />
                          <span className="min-w-0 flex-1 truncate" title={pNome(r.p)}>{pNome(r.p)}</span>
                          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{st.done}/{st.total}</span>
                        </button>
                        <div className="relative shrink-0 bg-muted/40" style={{ width: W }}>
                          {sp && <>
                            <div className="absolute top-[13px] h-4 overflow-hidden rounded-md" style={{ left: l, width: w, background: `${pc}38`, boxShadow: `inset 0 0 0 1px ${pc}73` }}>
                              <i className="block h-full" style={{ width: `${st.pct}%`, background: `${pc}bf` }} />
                            </div>
                            <span className="pointer-events-none absolute top-[13px] whitespace-nowrap text-[11px] font-bold leading-4 tabular-nums text-foreground/80" style={{ left: l + w + 8 }}>
                              {st.pct}% · {gFmt(sp.e).slice(0, 5)}{sp.e.getFullYear() !== t0.getFullYear() ? `/${sp.e.getFullYear()}` : ""}
                            </span>
                          </>}
                        </div>
                      </div>
                    );
                  }
                  if (r.t === "et") {
                    const full = base.filter(a => a.etapa_id === r.e.key), st = stats(full), sp = span(r.acts), aberta = !fechada(r.key, r.e.key);
                    const l = sp ? X(sp.s) : 0, w = sp ? (gDiff(sp.s, sp.e) + 1) * px : 0;
                    return (
                      <div key={r.key} className="group relative z-[1] flex border-b border-border/50" style={{ height: H.et }}>
                        <button type="button" aria-expanded={aberta} onClick={() => setClosed(c => ({ ...c, [r.key]: aberta }))}
                          className="sticky left-0 z-[4] flex shrink-0 items-center gap-2 border-r bg-card pl-[22px] pr-2.5 text-left text-[12.5px] font-semibold text-foreground/85 group-hover:bg-muted" style={colEsq}>
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${aberta ? "" : "-rotate-90"}`} />
                          <span className="font-mono text-[11px] text-muted-foreground">{r.e.num}</span>
                          <span className="min-w-0 flex-1 truncate" title={r.e.nome}>{r.e.nome}</span>
                          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{st.done}/{st.total}</span>
                        </button>
                        <div className="relative shrink-0 group-hover:bg-muted/30" style={{ width: W }}>
                          {sp && <>
                            <div className="absolute top-[14px] h-[7px] overflow-hidden rounded-full bg-muted-foreground/25" style={{ left: l, width: w }}>
                              <i className="block h-full bg-emerald-500" style={{ width: `${st.pct}%` }} />
                            </div>
                            {!aberta && <span className="pointer-events-none absolute top-[10px] whitespace-nowrap text-[11px] font-semibold leading-[14px] text-muted-foreground" style={{ left: l + w + 8 }}>{st.done}/{st.total} concluídas</span>}
                          </>}
                        </div>
                      </div>
                    );
                  }
                  const a = r.a, s: ResultadoPrevisao = S[a.id] ?? { tipo: "semdatas", motivo: "" }, lv = subLevel(a.codigo), sel = act === a.id;
                  const barra = temBarra(s) ? s : null;
                  const isP = rel.pred.has(a.id), isS = rel.succ.has(a.id);
                  const info = [a.responsavel, gDurTxt(a.duracao)].filter(Boolean).join(" · ");
                  return (
                    <div key={a.id} className={`group relative z-[1] flex border-b border-border/50 ${sel ? "bg-primary/[0.06]" : ""}`} style={{ height: H.act }}>
                      <div className={`sticky left-0 z-[4] flex shrink-0 items-center gap-2 border-r pr-2.5 text-[12.5px] ${sel ? "bg-primary/10" : "bg-card group-hover:bg-muted"}`} style={{ ...colEsq, paddingLeft: 40 + lv * 16 }}>
                        <input type="checkbox" className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[hsl(var(--primary))]" aria-label={`Marcar ${a.codigo}`} checked={marked.has(a.id)}
                          onChange={ev => setMarked(m => { const n = new Set(m); if (ev.target.checked) n.add(a.id); else n.delete(a.id); return n; })} />
                        <Dot status={a.status} />
                        <span className="font-mono text-[11px] text-muted-foreground">{a.codigo}</span>
                        <button type="button" title={a.titulo} onClick={() => onSelect(sel ? null : a.id)}
                          className={`min-w-0 flex-1 truncate text-left hover:text-primary hover:underline ${a.status === "concluido" ? "text-muted-foreground" : "text-foreground/85"}`}>{a.titulo}</button>
                        <RelTag pred={isP} succ={isS} curto />
                      </div>
                      <div className="relative shrink-0 group-hover:bg-muted/30" style={{ width: W }}>
                        {!barra ? (
                          (s.tipo === "planejar" || s.tipo === "semdatas") && (
                            <span className="absolute top-2 whitespace-nowrap rounded-full border border-dashed border-muted-foreground/50 bg-card px-2 text-[10.5px] font-semibold text-muted-foreground"
                              style={{ left: s.tipo === "planejar" ? X(s.inicio) : 8 }}>{s.motivo}</span>
                          )
                        ) : (() => {
                          const l = X(barra.inicio), w = Math.max(px * 0.7, (gDiff(barra.inicio, barra.fim) + 1) * px);
                          return <>
                            <div role="button" tabIndex={0} aria-label={`${a.codigo} ${a.titulo}`}
                              className={`absolute top-[9px] z-[1] h-4 cursor-pointer rounded-md shadow-sm transition hover:-translate-y-px hover:shadow-md ${COR_STATUS[a.status].barra} ${sel ? "outline outline-2 outline-offset-2 outline-primary" : isP ? "outline outline-2 outline-offset-1 outline-primary" : isS ? "outline outline-2 outline-offset-1 outline-orange-500" : ""}`}
                              style={{ left: l, width: w, backgroundImage: barra.tipo === "est" ? HACHURA : undefined }}
                              onClick={() => { setTip(null); onSelect(sel ? null : a.id); }}
                              onKeyDown={ev => { if (ev.key === "Enter") onSelect(sel ? null : a.id); }}
                              onMouseEnter={ev => setTip({ a, r: barra, x: ev.clientX, y: ev.clientY })}
                              onMouseMove={ev => setTip(t => (t ? { ...t, x: ev.clientX, y: ev.clientY } : t))}
                              onMouseLeave={() => setTip(null)} />
                            {info && <span className="pointer-events-none absolute top-[9px] whitespace-nowrap text-[11px] leading-4 text-muted-foreground" style={{ left: l + w + 7 }}>{info}</span>}
                          </>;
                        })()}
                      </div>
                    </div>
                  );
                })}

                {/* ligações (predecessoras) */}
                <svg className="pointer-events-none absolute top-0 z-0 overflow-visible" style={{ left: LW }} width={W} height={alturaTotal} aria-hidden>
                  <defs>
                    {([["n", "hsl(var(--muted-foreground))"], ["pr", "hsl(var(--primary))"], ["su", "#f97316"]] as const).map(([id, c]) => (
                      <marker key={id} id={`goArr${id}`} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={c} /></marker>
                    ))}
                  </defs>
                  {caminhos.map((c, i) => (
                    <path key={i} d={c.d} fill="none" markerEnd={`url(#goArr${c.cls || "n"})`}
                      stroke={c.cls === "pr" ? "hsl(var(--primary))" : c.cls === "su" ? "#f97316" : "hsl(var(--muted-foreground))"}
                      strokeWidth={c.cls ? 2 : 1.3} opacity={c.cls ? 1 : 0.6} />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        <b className="text-foreground">Como as datas são montadas:</b> as concluídas usam a data de realização (e o tempo estimado para trás). As pendentes são uma estimativa a partir de hoje, somando o tempo estimado em dias úteis e respeitando as predecessoras (nos projetos sem ligações, a ordem do código). Atividades sem tempo estimado aparecem como “a planejar”. Os filtros de cima (projeto, busca e responsável) também valem aqui.
      </p>

      {/* dica ao passar o mouse na barra */}
      {tip && (
        <div className="pointer-events-none fixed z-[60] max-w-[300px] rounded-xl border bg-popover p-3 text-[12px] text-popover-foreground shadow-lg"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 316), top: Math.min(tip.y + 16, window.innerHeight - 190) }}>
          <div className="flex items-center gap-1.5"><span className="font-mono text-[11px] text-muted-foreground">{tip.a.codigo}</span><StatusPill status={tip.a.status} /></div>
          <b className="mb-1.5 mt-1 block text-[13px]">{tip.a.titulo}</b>
          {[
            [tip.r.tipo === "real" ? "Período" : "Previsão", `${gFmt(tip.r.inicio)}${gDiff(tip.r.inicio, tip.r.fim) > 0 ? ` → ${gFmt(tip.r.fim)}` : ""}`],
            ["Tempo estimado", gDurTxt(tip.a.duracao) || tip.a.duracao],
            ["Responsável", tip.a.responsavel],
            ["Etapa", `${etapaNum(tip.a.codigo)} ${etapaNome(dados, tip.a)}`],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3.5 text-muted-foreground"><span>{k}</span><span className="text-right font-semibold text-foreground/85">{v}</span></div>
          ))}
          <p className="mt-1.5 text-[11px] text-muted-foreground/80">{tip.r.tipo === "real" ? "Datas registradas no painel." : "Estimativa a partir de hoje, pelo tempo estimado e pelas predecessoras."}</p>
        </div>
      )}
    </div>
  );
}
