import type { ReactNode } from "react";
import { Clock3, type LucideIcon } from "lucide-react";
import type { Atividade, SituacaoAtividade } from "@/lib/gerenciamento";

/** Um módulo no progresso do projeto, com as atividades na ordem atual e a situação de cada uma. */
export interface ModuloProgresso {
  numero: string;
  nome: string;
  atividades: { a: Atividade<string>; sit: SituacaoAtividade }[];
  /** Como chamar as atividades bloqueadas deste módulo (o padrão é "Esperando outra etapa"). */
  rotuloBloqueado?: string;
  /** No rodapé do módulo (ex.: o documento TAP no 01, a reunião de PE no 02). */
  extra?: ReactNode;
}

/** Um ponto de atenção do projeto, na coluna ao lado dos módulos. */
export interface AvisoProjeto {
  icone: LucideIcon;
  titulo: string;
  texto: string;
  /** "ambar" pede ação; "neutro" só informa. */
  tom: "ambar" | "neutro";
  /** Tocar no aviso abre este módulo (e a atividade, se houver). */
  modulo?: string;
  atividade?: string;
}

/** Feitas e aplicáveis de um módulo. */
export function contaModulo(m: ModuloProgresso) {
  const aplicaveis = m.atividades.filter(x => x.sit !== "naoaplica");
  const feitas = aplicaveis.filter(x => x.sit === "feito").length;
  return { feitas, total: aplicaveis.length, completo: aplicaveis.length > 0 && feitas === aplicaveis.length };
}

/** A próxima atividade do módulo: a primeira que se aplica e ainda não está feita. */
export const proximaDe = (m: ModuloProgresso) => m.atividades.find(x => x.sit !== "naoaplica" && x.sit !== "feito");

/** O que pede atenção no projeto: os avisos e, junto, as atividades esperando retorno de alguém. */
export const avisosDoProjeto = (avisos: AvisoProjeto[], modulos: ModuloProgresso[]): AvisoProjeto[] => [
  ...avisos,
  ...modulos.flatMap(m => m.atividades.filter(x => x.sit === "aguardando").map(x => ({
    icone: Clock3, titulo: x.a.titulo, texto: `Aguardando retorno · módulo ${m.numero}`, tom: "ambar" as const, modulo: m.numero, atividade: x.a.id,
  }))),
];
