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

const tap = (p: GerProject) => montarTap({ project: p, estado: modulo01Vazio(), ordem: ORDEM_PADRAO, emitidoPor: "Luiz Alves", fase: "Planejamento", agora: new Date("2026-10-26T15:00:00") });

describe("montarTap", () => {
  it("identificação traz o fim do contrato (contratação + prazo contratual)", () => {
    expect(tap(projeto()).identificacao).toContainEqual(["Fim do contrato", "15/09/2027"]);
    expect(tap(projeto({ contractual_deadline_days: null })).identificacao).toContainEqual(["Fim do contrato", "—"]);
  });
  it("o GP no cliente só entra nas partes interessadas quando está no cadastro", () => {
    expect(tap(projeto()).partes.map(p => p.nome)).toContain("Carla Souza");
    expect(tap(projeto({ client_manager_name: null })).partes.map(p => p.papel)).not.toContain("Gerente de Projetos no cliente");
  });
  it("sem Carrier, ITS ou Gestão de Frota, o mapa de calor fica fora dos marcos e o Assistente fora das partes", () => {
    const d = tap(projeto());
    expect(d.marcos.map(m => m.atividade)).not.toContain("Mapa de calor das operadoras");
    expect(d.partes.map(p => p.papel)).not.toContain("Assistente de Projetos");
    expect(d.cliente).toBe("Empresa Teste Ltda");
    expect(d.emitidoEm).toBe("26/10/2026 às 15:00");
  });
});
