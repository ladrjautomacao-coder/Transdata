import { describe, expect, it } from "vitest";
import type { GerProject } from "@/lib/gerenciamento";
import { modulo02Vazio } from "@/lib/modulo02";
import { cartoesDoTermo, descricaoCartao, faltandoTermo, montarTermo, qtdTermo } from "@/lib/termoCartoes";

const project = {
  id: "p1", company_name: "Transportadora Abreu & Souza Ltda", project_code: "FORMGSANEW0280-TRANSPORTADORAABREUSOUZALTDA",
  fleet_size: 13, client_manager_name: "Diogo Abreu", city: "Formiga", state: "MG",
} as unknown as GerProject;

describe("cartões do termo", () => {
  it("modelo: Chave 1, Senha 5, Acesso = frota (1 por carro), MK TRANSPORT 1; sem o Cadastro", () => {
    const l = cartoesDoTermo(project, modulo02Vazio().cartoes);
    expect(l.map(c => [c.tipo, c.quantidade])).toEqual([["Chave", 1], ["Senha", 5], ["Acesso", 13], ["MK TRANSPORT", 1]]);
  });
  it("Acesso acompanha a frota do cadastro até o GP mudar a quantidade", () => {
    const c = { ...modulo02Vazio().cartoes, ajustes: { senha: 6 } };
    expect(cartoesDoTermo({ ...project, fleet_size: 20 }, c).map(x => x.quantidade)).toEqual([1, 6, 20, 1]);
    expect(cartoesDoTermo(project, { ...c, ajustes: { acesso: 15 } })[2].quantidade).toBe(15);
  });
  it("cartões acrescentados vêm depois dos do modelo", () => {
    const c = { ...modulo02Vazio().cartoes, extras: [{ id: "x1", tipo: "Supervisor", destacavel: false, quantidade: 2 }] };
    expect(cartoesDoTermo(project, c).at(-1)).toMatchObject({ tipo: "Supervisor", quantidade: 2, padrao: null });
  });
  it("descrição no singular ou no plural; quantidade com dois dígitos", () => {
    expect(descricaoCartao(false, 1)).toBe("Cartão Não Destacável");
    expect(descricaoCartao(false, 5)).toBe("Cartões Não Destacáveis");
    expect(descricaoCartao(true, 13)).toBe("Cartões Destacáveis");
    expect([1, 5, 13, 120].map(qtdTermo)).toEqual(["01", "05", "13", "120"]);
  });
});

describe("montarTermo", () => {
  it("usa o cadastro e os padrões: Campinas, data da reunião de PE e Gerente do Projeto; quem recebe fica em branco", () => {
    const e = modulo02Vazio();
    e.contato.reuniaoPe = "2026-05-10T09:00";
    const d = montarTermo(project, e);
    expect(d.projeto).toBe("FORMGSANEW0280 - TRANSPORTADORA ABREU & SOUZA LTDA");
    expect(d.cliente).toBe("Transportadora Abreu & Souza Ltda");
    expect(d.clienteAssinatura).toBe("TRANSPORTADORA ABREU & SOUZA LTDA");
    expect(d.cartoes[2]).toEqual({ quantidade: "13", descricao: "Cartões Destacáveis", tipo: "Acesso" });
    expect([d.local, d.data, d.recebedor, d.cargo]).toEqual(["Campinas", "10/05/2026", "—", "Gerente do Projeto"]);
    expect(d.arquivo).toBe("Termo-Recebimento-Cartoes-FORMGSANEW0280");
  });
  it("cartão zerado sai da tabela; o que o GP preencheu vale sobre o padrão", () => {
    const e = modulo02Vazio();
    e.cartoes.ajustes = { mk: 0 };
    e.termo = { ...e.termo, local: "Formiga", data: "2026-05-11", recebedor: "Ana Souza", cargo: "Diretora" };
    const d = montarTermo(project, e);
    expect(d.cartoes.map(c => c.tipo)).toEqual(["Chave", "Senha", "Acesso"]);
    expect([d.local, d.data, d.recebedor, d.cargo]).toEqual(["Formiga", "11/05/2026", "Ana Souza", "Diretora"]);
  });
  it("diz o que falta", () => {
    const e = modulo02Vazio();
    expect(faltandoTermo(project, e)).toEqual(["data", "quem recebe os cartões"]);
    e.cartoes.extras = [{ id: "x1", tipo: " ", destacavel: false, quantidade: 1 }];
    e.termo.data = "2026-05-10";
    e.termo.recebedor = "Diogo Abreu";
    expect(faltandoTermo(project, e)).toEqual(["o tipo do cartão acrescentado"]);
  });
});
