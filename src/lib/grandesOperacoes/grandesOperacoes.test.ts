import { describe, expect, it } from "vitest";
import {
  CODIGO_VALIDO, camposParaStatus, comAtividade, comObsEtapa, etapaStatus, hubGrupos, indexar, matchResp, openUpstream, podeComecar, relDe, respOptions,
  responsaveisDe, stats, sugerirCodigo, FILTROS_HUB_PADRAO,
  type GoAtividade, type GoCliente, type GoProjeto,
} from "@/lib/grandesOperacoes/dados";
import { calcularPrevisao, chaveCodigo, lerDuracao, paraTexto, somarUteis, temBarra, voltarUteis, lerData, type ResultadoPrevisao } from "@/lib/grandesOperacoes/previsao";

const atv = (x: Partial<GoAtividade> & Pick<GoAtividade, "id" | "codigo">): GoAtividade => ({
  projeto_id: 1, etapa_id: 1, titulo: `Atividade ${x.codigo}`, responsavel: "", objetivo: "", duracao: "", data_prevista: null, data_realizada: null,
  status: "espera", ordem: 0, atualizado_em: "2026-10-28T10:00:00Z", predecessoras: [], observacoes: [], stakeholders: [], ...x,
});
const datas = (r: ResultadoPrevisao) => (temBarra(r) ? `${r.tipo} ${paraTexto(r.inicio)} → ${paraTexto(r.fim)}` : r.tipo === "planejar" ? `planejar ${paraTexto(r.inicio)}` : r.tipo);
const proj = (x: Partial<GoProjeto> & Pick<GoProjeto, "id">): GoProjeto => ({ cliente_id: 1, nome: `Projeto ${x.id}`, curto: "", situacao: "ativo", sequenciar_automatico: true, ordem: x.id, project_id: null, responsaveis: [], stakeholders: [], ...x });

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

describe("troca de status", () => {
  it("concluir sem Realizado em grava a data de hoje; os outros status mantêm a data", () => {
    expect(camposParaStatus({ status: "andamento", data_realizada: null }, "concluido", "2026-10-29")).toEqual({ status: "concluido", data_realizada: "2026-10-29" });
    expect(camposParaStatus({ status: "espera", data_realizada: "2026-10-01" }, "concluido", "2026-10-29")).toEqual({ status: "concluido", data_realizada: "2026-10-01" });
    expect(camposParaStatus({ status: "concluido", data_realizada: "2026-10-01" }, "andamento", "2026-10-29")).toEqual({ status: "andamento", data_realizada: "2026-10-01" });
  });
  it("a tela troca o status e recalcula o que pode começar", () => {
    const d = indexar([], [proj({ id: 1 })], [], [atv({ id: 1, codigo: "1.1.1", status: "andamento" }), atv({ id: 2, codigo: "1.1.2", predecessoras: [1] })]);
    expect(podeComecar(d, d.act.get(2)!)).toBe(false);
    const n = comAtividade(d, 1, { status: "concluido", data_realizada: "2026-10-29" });
    expect(n.act.get(1)!.status).toBe("concluido");
    expect(podeComecar(n, n.act.get(2)!)).toBe(true);
    expect(d.act.get(1)!.status).toBe("andamento");
  });
});

describe("cadastros pela tela", () => {
  const etapas = [{ id: 1, projeto_id: 1, nome: "Infra", ordem: 1 }, { id: 2, projeto_id: 1, nome: "Integração", ordem: 2 }, { id: 3, projeto_id: 1, nome: "Nova", ordem: 3 }];
  const stk = [{ id: 7, nome: "Ana Lima", empresa: "ENBI", ordem: 1 }, { id: 8, nome: "João Reis", empresa: "Transdata", ordem: 2 }];
  const d = indexar([], [proj({ id: 1, responsaveis: ["Transdata", "ENBI"], stakeholders: stk }), proj({ id: 2 })], etapas, [
    atv({ id: 1, codigo: "1.1.1", etapa_id: 1, responsavel: "Transdata + ENBI" }),
    atv({ id: 2, codigo: "1.1.2", etapa_id: 1, responsavel: "Ana Lima (ENBI)", stakeholders: [7] }),
    atv({ id: 3, codigo: "1.2.1", etapa_id: 2, responsavel: "Ana Lima (ENBI) + João Reis (Transdata)", stakeholders: [7, 8] }),
    atv({ id: 4, codigo: "1.2.4.1", etapa_id: 2 }),
  ], { obsEtapa: new Map([[1, [{ id: 5, etapa_id: 1, texto: "antigo", criado_em: "2026-11-01T10:00:00Z", autor_nome: "Luiz" }]]]) });

  it("código sugerido: o próximo da etapa; etapa vazia ou nova começa uma etapa do projeto", () => {
    expect(sugerirCodigo(d, 1, 1)).toBe("1.1.3");
    // subatividade (1.2.4.1) conta pelo terceiro número
    expect(sugerirCodigo(d, 1, 2)).toBe("1.2.5");
    expect(sugerirCodigo(d, 1, 3)).toBe("1.3.1");
    expect(sugerirCodigo(d, 1, null)).toBe("1.3.1");
    expect(sugerirCodigo(d, 2, null)).toBe("1.1.1");
    expect(["1.2.3", "1", "1.2."].map(c => CODIGO_VALIDO.test(c))).toEqual([true, true, false]);
  });
  it("filtro de responsável: empresas e nomes dos stakeholders e só o texto das atividades antigas", () => {
    expect(respOptions(d, [d.proj.get(1)!])).toEqual(["Transdata", "ENBI", "Ana Lima", "João Reis", "Transdata + ENBI"]);
    expect(d.atividades.filter(a => matchResp(a, "Ana Lima")).map(a => a.id)).toEqual([2, 3]);
    expect(d.atividades.filter(a => matchResp(a, "ENBI")).map(a => a.id)).toEqual([1, 2, 3]);
    expect(responsaveisDe(d, d.act.get(3)!).map(s => s.nome)).toEqual(["Ana Lima", "João Reis"]);
  });
  it("acompanhamento novo entra no topo da etapa e a troca de status não perde o acompanhamento", () => {
    const n = comObsEtapa(d, { id: 6, etapa_id: 1, texto: "novo", criado_em: "2026-11-06T10:00:00Z", autor_nome: "Luiz" });
    expect(n.obsEtapa.get(1)!.map(o => o.texto)).toEqual(["novo", "antigo"]);
    expect(d.obsEtapa.get(1)!.length).toBe(1);
    expect(comAtividade(n, 1, { status: "concluido" }).obsEtapa.get(1)!.length).toBe(2);
  });
});
