// Sistema de Pedidos: ponto único de integração do portal. Hoje não há API, então `integrado`
// é falso e as consultas do módulo 04 são registradas à mão (número do pedido, status, data da
// consulta e evidência ou observação). Quando a API existir, basta implementar `consultar` aqui:
// o módulo 04 passa a buscar o status, a última movimentação e a confirmação da entrega sozinho.

export interface ResultadoPedido {
  numero: string;
  /** Status como o Sistema de Pedidos mostra. */
  status: string;
  /** Última movimentação do pedido (ISO). */
  ultimaMovimentacao: string | null;
  /** Data da entrega confirmada, quando houver (AAAA-MM-DD). */
  entregueEm: string | null;
  /** Despacho dos equipamentos, quando houver. */
  despachadoEm?: string | null;
  transportadora?: string | null;
  rastreio?: string | null;
  previsaoEntrega?: string | null;
}

export interface SistemaPedidos {
  /** Há integração por API: o botão consulta sozinho e atualiza a etapa. */
  integrado: boolean;
  /** Consulta o pedido pelo número; null se não encontrar. */
  consultar(numero: string): Promise<ResultadoPedido | null>;
}

export const SISTEMA_PEDIDOS: SistemaPedidos = {
  integrado: false,
  async consultar() {
    return null;
  },
};
