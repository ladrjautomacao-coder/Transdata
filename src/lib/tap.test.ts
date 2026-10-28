import { describe, expect, it } from "vitest";
import { ORDEM_PADRAO, modulo01Vazio, type GerProject } from "@/lib/gerenciamento";
import { montarTap } from "@/lib/tap";

const projeto = (extra: Partial<GerProject> = {}) => ({
  id: "p1", company_name: " Empresa Teste Ltda ", project_code: "TUBSCASUPG0002-EMPRESATESTELTDA", city: "TUBARÃO", state: "SC", country_code: "BR",
  status: "planejamento", sub_phase: null, created_at: "2026-10-25T10:00:00-03:00", manager_id: "m1",
  manager: { full_name: "Luiz Alves" }, executive: { full_name: "Romano Garcia" }, fleet_size: 20, fleet_urbano: 14, fleet_seccionado: 6,
  reserve_fleet: 2, contract_date: "2026-09-15", contractual_deadline_days: 365, d_zero_date: "2026-10-20", handover_date: null,
  project_segment: null, cnpj: "11.111.111/1111-11", client_manager_name: "Carla Souza", atlas_pay: false,
  project_type: { name: "Alocação de equipamentos (SIGO)" }, project_solutions: [{ solution: { name: "Bilhetagem" } }],
  ...extra,
}) as GerProject;

const tap = (p: GerProject, coordenador: string | null = null) =>
  montarTap({ project: p, estado: modulo01Vazio(), ordem: ORDEM_PADRAO, emitidoPor: "Luiz Alves", fase: "Planejamento", coordenador, agora: new Date("2026-10-26T15:00:00") });

describe("montarTap", () => {
  it("assinam o GP, o Coordenador de Implantação e o Gerente Comercial (executivo do projeto)", () => {
    expect(tap(projeto(), "Fabiano Gazola").aprovacao).toEqual([
      { papel: "Gerente de Projetos", nome: "Luiz Alves" },
      { papel: "Coordenador de Implantação", nome: "Fabiano Gazola" },
      { papel: "Gerente Comercial", nome: "Romano Garcia" },
    ]);
    // sem coordenador cadastrado, a linha fica para assinar à mão
    expect(tap(projeto()).aprovacao[1]).toEqual({ papel: "Coordenador de Implantação", nome: "" });
  });
  it("identificação traz o fim do contrato (contratação + prazo contratual)", () => {
    expect(tap(projeto()).identificacao).toContainEqual(["Fim do contrato", "15/09/2027"]);
    expect(tap(projeto({ contractual_deadline_days: null })).identificacao).toContainEqual(["Fim do contrato", "—"]);
  });
  it("o GP no cliente só entra nas partes interessadas quando está no cadastro", () => {
    expect(tap(projeto()).partes.map(p => p.nome)).toContain("Carla Souza");
    expect(tap(projeto({ client_manager_name: null })).partes.map(p => p.papel)).not.toContain("Gerente de Projetos no cliente");
  });
  it("sem Carrier, ITS ou Gestão de Frota, o mapa de calor fica fora dos marcos e da responsabilidade da Assistente", () => {
    const d = tap(projeto());
    expect(d.marcos.map(m => m.atividade)).not.toContain("Mapa de calor das operadoras");
    expect(d.partes.find(p => p.papel === "Assistente de Projetos")?.responsabilidade)
      .toBe("Apoia o GP; responde por baixar pedidos - TOTVS, pastas do projeto no Drive, cadastro do código BD e checklist de pré-requisitos.");
    // com Carrier, o mapa de calor também é dela
    expect(tap(projeto({ project_solutions: [{ solution: { name: "Carrier" } }] })).partes.find(p => p.papel === "Assistente de Projetos")?.responsabilidade)
      .toContain("checklist de pré-requisitos e mapa de calor das operadoras.");
    expect(d.cliente).toBe("Empresa Teste Ltda");
    expect(d.emitidoEm).toBe("26/10/2026 às 15:00");
  });
  it("TOTVS, Drive, código BD e checklist ficam com a Assistente de Projetos, com o nome dela quando está na Equipe", () => {
    const estado = modulo01Vazio();
    estado.codigobd = { enviadoEm: "2026-10-27T10:00:00Z", codigo: "00757", registradoEm: "2026-10-28T10:00:00Z", por: "Silvana" };
    estado.feitos = { pedidos: { em: "2026-10-28T09:00:00Z", por: "Graciele" }, totvs: { em: "2026-10-28T09:10:00Z", por: "Silvana" }, drive: { em: "2026-10-28T09:20:00Z", por: "Silvana" } };
    const comNome = montarTap({ project: projeto(), estado, ordem: ORDEM_PADRAO, emitidoPor: "Luiz Alves", fase: "Planejamento", assistente: "Silvana" });
    const resp = (atividade: string) => comNome.marcos.find(m => m.atividade === atividade)?.responsavel;
    expect(resp("Cadastro do código BD")).toBe("Assistente de Projetos · Silvana");
    expect(resp("Baixar pedidos - TOTVS")).toBe("Assistente de Projetos · Silvana");
    expect(resp("Pastas do projeto no Drive")).toBe("Assistente de Projetos · Silvana");
    expect(resp("Cadastro no sistema de pedidos")).toBe("GP · Luiz Alves");
    expect(comNome.partes.find(p => p.papel === "Assistente de Projetos")?.nome).toBe("Silvana");
    const semNome = montarTap({ project: projeto(), estado, ordem: ORDEM_PADRAO, emitidoPor: "Luiz Alves", fase: "Planejamento" });
    expect(semNome.marcos.find(m => m.atividade === "Cadastro do código BD")?.responsavel).toBe("Assistente de Projetos");
  });
});
