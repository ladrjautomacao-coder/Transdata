// Atalhos do topo do portal: abrem a busca (CommandPalette) e o assistente de qualquer lugar.
export const EVENTO_ABRIR_BUSCA = "transdata:abrir-busca";

/** Abre a busca do portal (a mesma do Ctrl+K). */
export const abrirBusca = () => window.dispatchEvent(new Event(EVENTO_ABRIR_BUSCA));
