// Nomes dos dois papéis de equipe (ligado a executiveId / managerId em cada
// projeto), personalizáveis por tenant em Administração > Personalização.
// Sem valor default único aqui de propósito: os textos de hoje já são
// inconsistentes entre telas ("Gerente Comercial" vs "Executivo de Vendas"
// pro mesmo campo) — cada tela mantém o próprio fallback, então sem
// override nada muda (Transdata inclusive); com override, todas as telas
// passam a mostrar o mesmo texto novo.
export const teamRoleLabels: { executive: string | null; manager: string | null } = {
  executive: null,
  manager: null,
};

export function applyTeamRoleLabelOverrides(overrides: { executive?: string; manager?: string } | null | undefined) {
  teamRoleLabels.executive = overrides?.executive || null;
  teamRoleLabels.manager = overrides?.manager || null;
}
