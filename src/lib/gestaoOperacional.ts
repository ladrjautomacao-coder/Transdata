// Gestão Operacional (em desenvolvimento, só Super Admin): os processos que operavam em outro
// sistema e estão sendo trazidos para o portal. A página de entrada tem um quadrante por área,
// como a de Projetos; cada área abre em /gestao-operacional/<id> e recebe os seus processos.
import { Activity, Network, type LucideIcon } from "lucide-react";

/** Endereço da página da Gestão Operacional. */
export const URL_GESTAO_OPERACIONAL = "/gestao-operacional";

export interface AreaOperacional {
  id: string;
  titulo: string;
  /** Uma frase dizendo para que serve (no quadrante). */
  descricao: string;
  icon: LucideIcon;
}

/** As áreas, na ordem dos quadrantes. */
export const AREAS_OPERACIONAIS: AreaOperacional[] = [
  { id: "operacoes", titulo: "Operações", descricao: "Rotinas e acompanhamento das operações", icon: Activity },
  { id: "grandes-operacoes", titulo: "Grandes Operações", descricao: "Rotinas e acompanhamento das grandes operações", icon: Network },
];

export const urlArea = (a: Pick<AreaOperacional, "id">) => `${URL_GESTAO_OPERACIONAL}/${a.id}`;
export const areaOperacional = (id: string | undefined) => AREAS_OPERACIONAIS.find(a => a.id === id) ?? null;
