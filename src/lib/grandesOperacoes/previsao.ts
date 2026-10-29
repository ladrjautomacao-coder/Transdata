// Previsão das datas do Hub de Grandes Operações: só cálculo, não grava nada. Tradução fiel
// do previsao.js do sistema original (conferido lá contra o painel antigo: 92 de 92 datas).
// Se a regra mudar, as datas que o cliente recebe mudam junto.
//
// Concluída: termina em "Realizado em" e volta o tempo estimado em dias úteis (sem tempo, 1 dia);
//   sem "Realizado em", começa no "Início previsto" e soma o tempo; sem nenhuma, "sem datas".
// Pendente (em espera ou em andamento), estimativa a partir de hoje:
//   - em andamento: começa hoje e conta a duração inteira;
//   - em espera: começa hoje, no "Início previsto" (se no futuro) ou no dia útil seguinte ao
//     fim da última atividade de que depende, o que for mais tarde;
//   - depende de: projeto com predecessoras → as predecessoras pendentes; projeto sem nenhuma
//     predecessora e com sequenciar_automatico → a pendente anterior pelo código; senão nada;
//   - sem tempo estimado: "a planejar".
// Removida: não entra.

/** A ÚNICA função que decide se um dia é útil: sábado e domingo fora; feriados contam como úteis. */
export function ehDiaUtil(d: Date): boolean {
  const w = d.getDay();
  return w !== 0 && w !== 6;
}

export function primeiroUtil(d: Date): Date { const x = new Date(d); while (!ehDiaUtil(x)) x.setDate(x.getDate() + 1); return x; }
export function proximoUtil(d: Date): Date { const x = new Date(d); x.setDate(x.getDate() + 1); while (!ehDiaUtil(x)) x.setDate(x.getDate() + 1); return x; }
export function anteriorUtil(d: Date): Date { const x = new Date(d); x.setDate(x.getDate() - 1); while (!ehDiaUtil(x)) x.setDate(x.getDate() - 1); return x; }
/** n dias úteis contando o próprio dia de início: 1 dia = termina no mesmo dia. */
export function somarUteis(d: Date, n: number): Date { let x = new Date(d); for (let i = 1; i < n; i++) x = proximoUtil(x); return x; }
export function voltarUteis(d: Date, n: number): Date { let x = new Date(d); for (let i = 1; i < n; i++) x = anteriorUtil(x); return x; }

/** "AAAA-MM-DD" → data local (meia-noite); vazio ou inválido → null. */
export function lerData(s: string | null | undefined): Date | null {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function paraTexto(d: Date | null): string {
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
}
/** Duração é texto livre ("5 dias", "5", "1 dia"): vale o primeiro número; sem número = 0. */
export function lerDuracao(s: string | null | undefined): number { const m = String(s || "").match(/(\d+)/); return m ? parseInt(m[1], 10) : 0; }
/** Ordena códigos número a número: 1.2 antes de 1.10; 1.4.6 → 1.4.6.1 → 1.4.7. */
export function chaveCodigo(c: string | null | undefined): string {
  return String(c || "").split(".").map(n => String(parseInt(n, 10) || 0).padStart(4, "0")).join(".");
}

export interface AtividadePrevisao {
  id: number; projeto_id: number; codigo: string; status: string; duracao: string;
  data_prevista: string | null; data_realizada: string | null; predecessoras: number[];
}
/** real: concluída, pelas datas registradas; est: pendente, estimada. */
export type ResultadoBarra = { tipo: "real" | "est"; inicio: Date; fim: Date };
export type ResultadoPrevisao =
  | ResultadoBarra
  /** pendente sem tempo estimado: começa em `inicio`, sem fim */
  | { tipo: "planejar"; inicio: Date; motivo: string }
  /** concluída sem nenhuma data registrada */
  | { tipo: "semdatas"; motivo: string };
/** O resultado tem barra (início e fim). */
export const temBarra = (r: ResultadoPrevisao): r is ResultadoBarra => r.tipo === "real" || r.tipo === "est";

/**
 * atividades: todas (de todos os projetos); projetos: na ordem cadastrada; hoje: "AAAA-MM-DD"
 * (o dia de hoje no computador de quem abre). Devolve o resultado por id de atividade.
 */
export function calcularPrevisao(
  atividades: AtividadePrevisao[], projetos: { id: number; sequenciar_automatico: boolean }[], hoje: string,
): Record<number, ResultadoPrevisao> {
  const t0 = primeiroUtil(lerData(hoje) ?? new Date());
  const seq: Record<number, boolean> = {}, rank: Record<number, number> = {};
  projetos.forEach((p, i) => { seq[p.id] = !!p.sequenciar_automatico; rank[p.id] = i; });

  // mesma ordem do painel: projetos pela ordem cadastrada, dentro do projeto pelo código
  const lista = atividades.slice().sort((a, b) =>
    ((rank[a.projeto_id] ?? 1e9) - (rank[b.projeto_id] ?? 1e9)) || chaveCodigo(a.codigo).localeCompare(chaveCodigo(b.codigo)));
  const porId: Record<number, AtividadePrevisao> = {};
  lista.forEach(a => { porId[a.id] = a; });
  const pendente = (a: AtividadePrevisao) => a.status === "espera" || a.status === "andamento";

  // projeto "tem ligações" se qualquer atividade dele tem predecessora (inclusive removida)
  const temLigacao: Record<number, boolean> = {};
  lista.forEach(a => { if ((a.predecessoras || []).length) temLigacao[a.projeto_id] = true; });

  // fila automática: a pendente anterior no mesmo projeto, pela ordem do código
  const anteriorNaFila: Record<number, number | null> = {}, ultima: Record<number, number> = {};
  lista.forEach(a => { if (!pendente(a)) return; anteriorNaFila[a.id] = ultima[a.projeto_id] ?? null; ultima[a.projeto_id] = a.id; });

  const dependeDe = (a: AtividadePrevisao): AtividadePrevisao[] => {
    if (temLigacao[a.projeto_id]) return (a.predecessoras || []).map(id => porId[id]).filter(x => x && pendente(x));
    const ant = anteriorNaFila[a.id];
    if (seq[a.projeto_id] && ant) return [porId[ant]];
    return [];
  };

  const res: Record<number, ResultadoPrevisao> = {};

  lista.forEach(a => {
    if (a.status !== "concluido") return;
    const d = lerDuracao(a.duracao) || 1, real = lerData(a.data_realizada), prev = lerData(a.data_prevista);
    if (real) res[a.id] = { inicio: voltarUteis(real, d), fim: real, tipo: "real" };
    else if (prev) res[a.id] = { inicio: prev, fim: somarUteis(prev, d), tipo: "real" };
    else res[a.id] = { tipo: "semdatas", motivo: "concluída, sem datas registradas" };
  });

  const calc = (a: AtividadePrevisao, pilha: Set<number>): ResultadoPrevisao => {
    if (res[a.id]) return res[a.id];
    if (pilha.has(a.id)) return { inicio: t0, fim: t0, tipo: "est" }; // ligação circular: não trava, começa hoje
    pilha.add(a.id);
    let ini = t0;
    if (a.status === "espera") {
      const p = lerData(a.data_prevista);
      if (p && p > ini) ini = primeiroUtil(p);
      dependeDe(a).forEach(dep => {
        const r = calc(dep, pilha);
        // a planejar: começa onde ela começaria; concluída sem datas não empurra nada
        const n = temBarra(r) ? proximoUtil(r.fim) : r.tipo === "planejar" ? r.inicio : t0;
        if (n > ini) ini = n;
      });
    }
    pilha.delete(a.id);
    const d = lerDuracao(a.duracao);
    if (!d) return (res[a.id] = { tipo: "planejar", inicio: ini, motivo: "a planejar (sem tempo estimado)" });
    return (res[a.id] = { inicio: ini, fim: somarUteis(ini, d), tipo: "est" });
  };
  lista.forEach(a => { if (pendente(a)) calc(a, new Set()); });
  return res;
}
