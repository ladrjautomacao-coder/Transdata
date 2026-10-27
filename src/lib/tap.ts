// TAP (Termo de Abertura do Projeto, PMBOK): o documento oficial que fecha o módulo 01.
// Aqui os dados do cadastro e do módulo viram as seções do documento; o PDF é desenhado em
// src/lib/tapPdf.tsx (carregado só quando o GP gera o documento).
import { formatLocation } from "@/lib/location";
import { projectSegmentLabel } from "@/lib/projectSegments";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import { codigoCliente, sistemasTexto } from "@/lib/dataCenterEmail";
import { NOME_OPERADORA } from "@/lib/coberturaOperadoras";
import {
  CHECKLIST_ITENS, MODULO_01, RESPONSAVEL_LABEL, RESP_CHECKLIST, dataBr, dataHoraBr, fimDoContrato, linkExterno, naoAplica, precisaCobertura, solutionsOf,
  type AtividadeId, type GerProject, type Modulo01Estado,
} from "@/lib/gerenciamento";

export type Par = [rotulo: string, valor: string];

export interface DadosTap {
  codigo: string;
  cliente: string;
  versao: string;
  emitidoEm: string;
  emitidoPor: string;
  identificacao: Par[];
  objetivo: string;
  escopo: Par[];
  partes: { papel: string; nome: string; responsabilidade: string }[];
  checklist: {
    itens: { texto: string; responsavel: string; situacao: "Atendido" | "Não se aplica" | "Pendente" }[];
    vencimentoDzero: string | null;
    resultado: string;
    observacoes: string | null;
  };
  marcos: { atividade: string; responsavel: string; concluidaEm: string; registro: string; link?: string }[];
  handover: { data: string; participantes: string; particularidades: string; atencao: string; expectativas: string } | null;
  aprovacao: { papel: string; nome: string }[];
}

/** "Claro" ou, com várias cidades da operação, "Caçador/SC: Claro; Videira/SC: Vivo". */
const recomendadasTexto = (e: Modulo01Estado): string | null => {
  const rs = e.carrier.recomendadas ?? [];
  if (rs.length > 1) return rs.map(r => `${r.cidade}: ${r.operadora ? NOME_OPERADORA[r.operadora] : "nenhuma"}`).join("; ");
  return e.carrier.recomendada ? NOME_OPERADORA[e.carrier.recomendada] : null;
};
const ou = (v: string | null | undefined, vazio = "—") => (v && v.trim() ? v.trim() : vazio);
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

/** Monta o TAP a partir do cadastro do projeto e do que foi registrado no módulo 01. */
export function montarTap({ project, estado, ordem, emitidoPor, fase, coordenador = null, agora = new Date() }: {
  project: GerProject;
  estado: Modulo01Estado;
  ordem: AtividadeId[];
  emitidoPor: string;
  /** Coluna e etapa do Kanban, já com os nomes do tenant. */
  fase: string;
  /** Coordenador de Implantação da Equipe (null: assinatura sem nome). */
  coordenador?: string | null;
  agora?: Date;
}): DadosTap {
  const gp = project.manager?.full_name ?? "—";
  const executivo = project.executive?.full_name ?? "—";
  const papelGp = teamRoleLabels.manager ?? "Gerente de Projetos";
  // no TAP o Executivo de Vendas do projeto assina como Gerente Comercial
  const papelExec = teamRoleLabels.executive ?? "Gerente Comercial";
  const papelCoord = "Coordenador de Implantação";
  const solucoes = solutionsOf(project);
  const local = formatLocation(project.city, project.state, project.country_code);
  const cobertura = precisaCobertura(project);
  const c = estado.checklist;
  const dc = estado.datacenter;
  const h = estado.handover;
  const frota = project.fleet_size ?? 0;

  const identificacao: Par[] = [
    ["Cliente (razão social)", project.company_name.trim().toUpperCase()],
    ["CNPJ", ou(project.cnpj)],
    ["Cidade/UF", local],
    ["Tipo do projeto", ou(project.project_type?.name)],
    ["Segmento", projectSegmentLabel(project.project_segment)],
    ["Fase no Kanban", fase],
    ["Data de contratação", dataBr(project.contract_date)],
    ["D-zero", dataBr(project.d_zero_date)],
    ["Fim do contrato", dataBr(fimDoContrato(project))],
    ["Cadastro no portal", dataBr(project.created_at)],
  ];

  const escopo: Par[] = [
    ["Soluções contratadas", solucoes.length ? solucoes.join(", ") : "—"],
    ["Frota contratada", frota ? `${frota} veículo${frota === 1 ? "" : "s"} (urbano ${project.fleet_urbano ?? 0} · seccionado ${project.fleet_seccionado ?? 0})` : "—"],
    ["Frota reserva", `${project.reserve_fleet ?? 0} veículo${project.reserve_fleet === 1 ? "" : "s"} (parte da frota contratada)`],
    ["AtlasPay", project.atlas_pay ? "Sim" : "Não"],
  ];
  if (dc.email?.sistemas?.length) escopo.push(["Sistemas no Data Center", sistemasTexto(dc.email.sistemas)]);
  if (cobertura) escopo.push(["Operadora recomendada", recomendadasTexto(estado) ?? "Não informada"]);

  const objetivo = `Implantar ${solucoes.length ? lista(solucoes) : "as soluções contratadas"} para ${project.company_name.trim()}`
    + `${local ? ` em ${local}` : ""}${frota ? `, com frota contratada de ${frota} veículo${frota === 1 ? "" : "s"}` : ""}.`;

  const partes = [
    { papel: `${papelGp} (designado)`, nome: gp, responsabilidade: "Conduz o projeto do planejamento à entrega e responde pelas atividades deste termo." },
    { papel: papelExec, nome: executivo, responsabilidade: "Responsável comercial; repassa o contexto da venda e os combinados com o cliente no Handover." },
    ...(coordenador ? [{ papel: papelCoord, nome: coordenador, responsabilidade: "Coordena a implantação do projeto em campo junto ao GP." }] : []),
    ...(cobertura ? [{ papel: "Assistente de Projetos", nome: "—", responsabilidade: "Apoia o GP; envia ao cliente o comparativo de cobertura das operadoras." }] : []),
    { papel: "Cliente", nome: project.company_name.trim(), responsabilidade: "Contratante; providencia os pré-requisitos sob sua responsabilidade." },
    ...(project.client_manager_name?.trim() ? [{ papel: "Gerente de Projetos no cliente", nome: project.client_manager_name.trim(), responsabilidade: "Conduz o projeto do lado do cliente; ponto de contato do GP Transdata." }] : []),
  ];

  const checklist: DadosTap["checklist"] = {
    itens: CHECKLIST_ITENS.map(i => ({
      texto: i.texto,
      responsavel: RESP_CHECKLIST[i.resp].label,
      situacao: naoAplica(estado, i) ? "Não se aplica" : c.itens[i.id] ? "Atendido" : "Pendente",
    })),
    vencimentoDzero: c.vencimentoDzero ? dataBr(c.vencimentoDzero) : null,
    resultado: c.resultado === "excecao"
      ? `Liberado por exceção autorizada por ${ou(c.autorizadoPor)} em ${dataHoraBr(c.em)}.`
      : c.resultado === "atendido" ? `Atendido em ${dataHoraBr(c.em)}: todos os pré-requisitos que se aplicam estão ok.` : "Não concluído.",
    observacoes: c.observacoes.trim() || null,
  };

  const resp = (id: AtividadeId) => {
    const a = MODULO_01.atividades.find(x => x.id === id)!;
    return a.responsavel === "gp" ? `GP · ${gp}` : RESPONSAVEL_LABEL[a.responsavel];
  };
  const marco = (id: AtividadeId): DadosTap["marcos"][number] | null => {
    const a = MODULO_01.atividades.find(x => x.id === id)!;
    const base = { atividade: a.titulo, responsavel: resp(id) };
    switch (id) {
      case "portal": return { ...base, concluidaEm: dataBr(project.created_at), registro: "Código do projeto gerado" };
      case "pedidos": {
        const f = estado.feitos.pedidos, link = linkExterno(f?.valor);
        if (link) return { ...base, concluidaEm: dataBr(f?.em), registro: "Pedido no sistema de pedidos", link };
        return { ...base, concluidaEm: dataBr(f?.em), registro: f?.valor ? `Nº ${f.valor}` : "Sem link informado" };
      }
      case "totvs": {
        const f = estado.feitos.totvs;
        return { ...base, concluidaEm: dataBr(f?.em), registro: f?.valor ? `Nº ${f.valor}` : "Sem número informado" };
      }
      case "drive": {
        const f = estado.feitos.drive;
        return { ...base, concluidaEm: dataBr(f?.em), registro: f?.valor ? "Pasta do projeto no Drive" : "Sem link informado", link: linkExterno(f?.valor) ?? undefined };
      }
      case "codigobd": return { ...base, concluidaEm: dataBr(estado.codigobd.registradoEm), registro: estado.codigobd.codigo ? `Código BD ${estado.codigobd.codigo}` : "—" };
      case "checklist": return { ...base, concluidaEm: dataBr(c.em), registro: c.resultado === "excecao" ? `Exceção: ${ou(c.autorizadoPor)}` : "Atendido" };
      case "datacenter": return { ...base, concluidaEm: dataBr(dc.concluidoEm), registro: dc.email?.codigo ? codigoCliente(project, dc.email) : "Pedido feito por fora do portal" };
      case "handover": return { ...base, concluidaEm: dataBr(h.registradoEm), registro: h.agendadoPara ? `Reunião em ${dataHoraBr(h.agendadoPara)}` : "Reunião registrada" };
      case "carrier":
        if (!cobertura) return null;
        return { ...base, concluidaEm: dataBr(estado.carrier.concluidoEm), registro: recomendadasTexto(estado) ? `Recomendada: ${recomendadasTexto(estado)}` : "E-mail enviado por fora do portal" };
    }
  };

  return {
    codigo: ou(project.project_code),
    cliente: project.company_name.trim(),
    versao: "1.0",
    emitidoEm: dataHoraBr(agora.toISOString()),
    emitidoPor,
    identificacao,
    objetivo,
    escopo,
    partes,
    checklist,
    marcos: ordem.map(marco).filter((m): m is NonNullable<typeof m> => !!m),
    handover: h.registradoEm ? {
      data: dataHoraBr(h.agendadoPara || h.registradoEm),
      participantes: ou(h.participantes, `${papelExec}: ${executivo}; ${papelGp}: ${gp}`),
      particularidades: ou(h.particularidades, "Nada registrado."),
      atencao: ou(h.atencao, "Nada registrado."),
      expectativas: ou(h.expectativas, "Nada registrado."),
    } : null,
    aprovacao: [
      { papel: papelGp, nome: gp === "—" ? "" : gp },
      { papel: papelCoord, nome: coordenador ?? "" },
      { papel: papelExec, nome: executivo === "—" ? "" : executivo },
    ],
  };
}
