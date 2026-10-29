import { describe, expect, it } from "vitest";
import {
  etapaStatus, hubGrupos, indexar, matchResp, openUpstream, relDe, respOptions, stats, FILTROS_HUB_PADRAO,
  type GoAtividade, type GoCliente, type GoProjeto,
} from "@/lib/grandesOperacoes/dados";
import { calcularPrevisao, chaveCodigo, lerDuracao, paraTexto, somarUteis, temBarra, voltarUteis, lerData, type ResultadoPrevisao } from "@/lib/grandesOperacoes/previsao";

const atv = (x: Partial<GoAtividade> & Pick<GoAtividade, "id" | "codigo">): GoAtividade => ({
  projeto_id: 1, etapa_id: 1, titulo: `Atividade ${x.codigo}`, responsavel: "", objetivo: "", duracao: "", data_prevista: null, data_realizada: null,
  status: "espera", ordem: 0, atualizado_em: "2026-10-28T10:00:00Z", predecessoras: [], observacoes: [], ...x,
});
const datas = (r: ResultadoPrevisao) => (temBarra(r) ? `${r.tipo} ${paraTexto(r.inicio)} → ${paraTexto(r.fim)}` : r.tipo === "planejar" ? `planejar ${paraTexto(r.inicio)}` : r.tipo);
const proj = (x: Partial<GoProjeto> & Pick<GoProjeto, "id">): GoProjeto => ({ cliente_id: 1, nome: `Projeto ${x.id}`, curto: "", situacao: "ativo", sequenciar_automatico: true, ordem: x.id, responsaveis: [], ...x });

describe("dias úteis e leitura dos campos", () => {
  it("sábado e domingo não contam; 1 dia termina no mesmo dia", () => {
    // 2026-10-30 é sexta
    expect(paraTexto(somarUteis(lerData("2026-10-30")!, 2))).toBe("2026-11-02");
    expect(paraTexto(somarUteis(lerData("2026-10-30")!, 1))).toBe("2026-10-30");
    expect(paraTexto(voltarUteis(lerData("2026-11-02")!, 2))).toBe("2026-10-30");
  });
  it("duração vale o primeiro número; código ordena número a número", () => {
    expect([lerDuracao("5 dias"), lerDuracao("1 dia"), lerDuracao("a definir")]).toEqual([5, 1, 0]);
    const cods = ["1.10", "1.2", "1.4.6.1", "1.4.7", "1.4.6"].sort((a, b) => chaveCodigo(a).localeCompare(chaveCodigo(b)));
    expect(cods).toEqual(["1.2", "1.4.6", "1.4.6.1", "1.4.7", "1.10"]);
  });
});

describe("calcularPrevisao", () => {
  const hoje = "2026-10-28"; // quarta-feira
  it("concluída volta a duração a partir do realizado; sem datas fica sem barra", () => {
    const r = calcularPrevisao([
      atv({ id: 1, codigo: "1.1.1", status: "concluido", duracao: "3 dias", data_realizada: "2026-10-20" }),
      atv({ id: 2, codigo: "1.1.2", status: "concluido" }),
    ], [proj({ id: 1 })], hoje);
    expect(datas(r[1])).toBe("real 2026-10-16 → 2026-10-20");
    expect(datas(r[2])).toBe("semdatas");
  });
  it("sem predecessoras e com sequenciar: as pendentes entram em fila pelo código", () => {
    const r = calcularPrevisao([
      atv({ id: 1, codigo: "1.1.1", status: "andamento", duracao: "2 dias" }),
      atv({ id: 2, codigo: "1.1.2", duracao: "3 dias" }),
      atv({ id: 3, codigo: "1.1.3" }),
    ], [proj({ id: 1 })], hoje);
    expect(datas(r[1])).toBe("est 2026-10-28 → 2026-10-29");
    expect(datas(r[2])).toBe("est 2026-10-30 → 2026-11-03");
    expect(datas(r[3])).toBe("planejar 2026-11-04");
  });
  it("sem sequenciar, cada pendente começa hoje; com predecessoras, só elas empurram", () => {
    const semFila = calcularPrevisao([atv({ id: 1, codigo: "1.1.1", duracao: "2 dias" }), atv({ id: 2, codigo: "1.1.2", duracao: "1 dia" })],
      [proj({ id: 1, sequenciar_automatico: false })], hoje);
    expect(datas(semFila[2])).toBe("est 2026-10-28 → 2026-10-28");
    const comLigacao = calcularPrevisao([
      atv({ id: 1, codigo: "1.1.1", duracao: "2 dias" }),
      atv({ id: 2, codigo: "1.1.2", duracao: "1 dia" }),
      atv({ id: 3, codigo: "1.1.3", duracao: "1 dia", predecessoras: [1] }),
    ], [proj({ id: 1 })], hoje);
    expect(datas(comLigacao[2])).toBe("est 2026-10-28 → 2026-10-28");
    expect(datas(comLigacao[3])).toBe("est 2026-10-30 → 2026-10-30");
  });
  it("início previsto no futuro vale para quem está em espera; removida não entra", () => {
    const r = calcularPrevisao([
      atv({ id: 1, codigo: "1.1.1", duracao: "1 dia", data_prevista: "2026-11-07" }),
      atv({ id: 2, codigo: "1.1.2", status: "removido", duracao: "1 dia" }),
    ], [proj({ id: 1, sequenciar_automatico: false })], hoje);
    expect(datas(r[1])).toBe("est 2026-11-09 → 2026-11-09");
    expect(r[2]).toBeUndefined();
  });
});

describe("consultas do Hub e do painel", () => {
  const clientes: GoCliente[] = [{ id: 2, nome: "Cliente Sul", local: "Brasília/DF", ordem: 2 }, { id: 1, nome: "Cliente Norte", local: "Recife/PE", ordem: 1 }];
  const projetos = [proj({ id: 10, cliente_id: 1, nome: "Bilhetagem", responsaveis: ["Transdata", "Cliente"] }), proj({ id: 11, cliente_id: 1, nome: "Encerrado", situacao: "encerrado" })];
  const atividades = [
    atv({ id: 1, codigo: "1.1.2", projeto_id: 10, status: "concluido", responsavel: "Transdata + Cliente" }),
    atv({ id: 2, codigo: "1.1.1", projeto_id: 10, status: "andamento", responsavel: "Todos" }),
    atv({ id: 3, codigo: "1.1.10", projeto_id: 10, responsavel: "Parceiro", predecessoras: [2] }),
    atv({ id: 4, codigo: "1.1.3", projeto_id: 10, status: "removido", predecessoras: [3] }),
  ];
  const d = indexar(clientes, projetos, [{ id: 1, projeto_id: 10, nome: "Infra", ordem: 1 }], atividades);

  it("ordena clientes, projetos e atividades como o original", () => {
    expect(d.clientes.map(c => c.nome)).toEqual(["Cliente Norte", "Cliente Sul"]);
    expect(d.atividades.map(a => a.codigo)).toEqual(["1.1.1", "1.1.2", "1.1.3", "1.1.10"]);
  });
  it("removida não entra na conta", () => {
    expect(stats(d.atividades)).toEqual({ total: 3, done: 1, doing: 1, wait: 1, removed: 1, pct: 33 });
    expect(etapaStatus(d.atividades)).toBe("andamento");
  });
  it("\"Com Cliente\" pega as combinações e as de \"Todos\"", () => {
    expect(d.atividades.filter(a => matchResp(a, "Cliente")).map(a => a.id)).toEqual([2, 1]);
    expect(respOptions(d, [d.proj.get(10)!])).toEqual(["Transdata", "Cliente", "Parceiro", "Todos", "Transdata + Cliente"]);
  });
  it("antes e depois da selecionada; o que ainda falta antes", () => {
    const rel = relDe(d, 3);
    expect([...rel.pred]).toEqual([2]);
    expect([...rel.succ]).toEqual([4]);
    expect(openUpstream(d, d.act.get(4)!).map(a => a.codigo)).toEqual(["1.1.1", "1.1.10"]);
  });
  it("Hub: o padrão esconde os encerrados e mostra cliente sem projeto", () => {
    const { ps, grupos } = hubGrupos(d, FILTROS_HUB_PADRAO);
    expect(ps.map(p => p.id)).toEqual([10]);
    expect(grupos.map(g => g.c.nome)).toEqual(["Cliente Norte", "Cliente Sul"]);
    expect(hubGrupos(d, { ...FILTROS_HUB_PADRAO, sit: "encerrado" }).grupos.map(g => g.ps.map(p => p.id))).toEqual([[11]]);
    expect(hubGrupos(d, { ...FILTROS_HUB_PADRAO, q: "validacao" }).ps).toEqual([]);
    expect(hubGrupos(d, { ...FILTROS_HUB_PADRAO, q: "recife" }).ps.map(p => p.id)).toEqual([10]);
  });
});
