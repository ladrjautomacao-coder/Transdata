// O login é um só, na tela de acesso do Gerenciador Transdata (portal principal). Este sistema
// abre dentro do endereço dele, em /transdata/, e usa a mesma sessão do Supabase: quem entrou no
// portal já está conectado aqui. Sem sessão, a pessoa vai para a tela de acesso e volta depois.

/** Caminho do app no endereço do portal, com a barra no fim ("/transdata/"). */
export const BASE_APP = import.meta.env.BASE_URL;

/** Endereço de uma tela deste app para links comuns (fora do roteador), ex.: "/projetos/123". */
export function urlDoApp(rota: string): string {
  return BASE_APP + rota.replace(/^\/+/, "");
}

let saindo = false;

/** A pessoa pediu para sair: a tela de acesso abre limpa, sem voltar para este sistema. */
export function avisarSaida(): void {
  saindo = true;
}

/** Leva à tela de acesso do portal. Por padrão, volta para a página atual depois de entrar. */
export function irParaLogin(opcoes: { acesso?: "cadastro" | "senha"; voltar?: boolean } = {}): void {
  if (saindo) return; // quem sai vai para o portal (irParaPortal)
  const parametros = new URLSearchParams();
  if (opcoes.acesso) parametros.set("acesso", opcoes.acesso);
  if (opcoes.voltar !== false) {
    parametros.set("voltar", window.location.pathname + window.location.search + window.location.hash);
  }
  const busca = parametros.toString();
  window.location.replace("/" + (busca ? `?${busca}` : ""));
}

/** Volta à página inicial do portal (cartões dos sistemas). */
export function irParaPortal(): void {
  window.location.assign("/");
}
