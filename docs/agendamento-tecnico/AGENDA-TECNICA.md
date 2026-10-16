# Agenda técnica (redesenho de out/2026)

Aplicação do mockup "Agenda Técnica GP Transdata" (Claude Design) sobre o módulo de
Implantação que já existia. **Não houve mudança no banco**: tudo usa as tabelas e funções
atuais (`implantation_requests`, técnicos, feriados e as RPCs de aprovação).

## O que mudou

| Tela do mockup | Onde ficou |
|---|---|
| Por técnico (visão padrão) | Implantação › **Agenda técnica** (`/implantacao/calendario`), visão "Por técnico" |
| Calendário do mês | Mesma tela, visão "Calendário" |
| Detalhe ao passar o mouse | Resumo ao passar o mouse em qualquer visita (computador) |
| Aprovar e atribuir solicitação | Painel lateral usado na Agenda técnica e na Aprovação de agenda |
| App do técnico | Área do Implantador: "Minha agenda" no celular e cartões no topo no computador |

- O item de menu "Calendário" passou a se chamar **Agenda técnica** (mesma rota).
- Linha do tempo de **1, 2 ou 4 semanas** (fim de semana mais estreito), com filtros de técnico,
  tipo de visita, status e UF, e busca por cliente, cidade, código ou GP.
- **Cor por tipo de visita**, derivado do objetivo: ITS/Frotas, Bilhetagem, AtlasMob, Reciclagem,
  Rede de Vendas, Projeto Executivo e Outros. O número da visita ("1ª", "2ª"…) também vem do objetivo.
- **Linha "A atribuir"**: solicitações pendentes aparecem tracejadas, sempre separadas da agenda
  confirmada. Para quem aprova, aparece também a **sugestão** do técnico recomendado na linha dele.
- **Deslocamento em km (linha reta)** entre visitas seguidas, pelas coordenadas dos municípios do IBGE
  (`src/data/municipiosBr.ts`, carregado sob demanda).
- **Resumo no topo**: visitas de hoje, dias livres da equipe, solicitações aguardando e alertas.
- **Alertas da agenda** (calculados na tela):
  - viagem longa (≥ 300 km) sem um dia livre entre duas visitas;
  - técnico sem nenhum dia útil livre até o fim do período (com sugestão de quem pode assumir);
  - visita que ocupa fim de semana ou feriado;
  - conflito de horário (o banco já bloqueia; o alerta é uma garantia extra).
- **Painel de aprovação**: disponibilidade de cada técnico no período, carga de dias úteis no mês,
  última visita e distância até o local, técnico **recomendado** (livre, com menos carga e mais
  perto), verificações antes de aprovar, ajuste de período, cadastro rápido de técnico e "Recusar"
  (com justificativa obrigatória, como antes).

## Regras de cálculo

- **Dia útil**: segunda a sexta, sem feriado nacional (pontos facultativos contam como úteis) nem
  feriado da empresa. Feriados estaduais e municipais valem para a visita no local deles.
- **Dias livres**: dias úteis sem visita aprovada, de hoje até o último dia útil do período exibido.
- **Recomendação**: entre os livres no período pedido, menor carga no mês; desempate por não ter visita
  no dia anterior e pela menor distância da última visita até o local.

## Fica para uma próxima etapa (precisa de mudança no banco)

- "Pedir ajuste" ao solicitante (novo status da solicitação).
- "Mensagem ao solicitante" na aprovação.
- "Avisar o técnico pelo app" (notificação).
- "Registrar saída do dia" e relatório pelo app do técnico.
- Barra inferior do app (Agenda, Relatórios, Avisos, Perfil).

## Arquivos

- `src/lib/agendaTecnica.ts`: tipos de visita, dias úteis, carga, km, alertas e recomendação (com testes em `agendaTecnica.test.ts`).
- `src/components/agendamento/`: `TechnicianTimeline`, `MonthGrid`, `AgendaPanels`, `VisitHoverCard`, `AssignSheet`, `NewVisitDialog`, `MinhaAgenda`.
- `src/pages/CalendarioImplantacao.tsx`, `AreaImplantador.tsx` e `SolicitacaoAgenda.tsx` usam os componentes acima.
