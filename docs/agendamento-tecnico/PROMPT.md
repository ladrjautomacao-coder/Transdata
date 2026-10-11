# Prompt — Implantação: Solicitação de agenda + Calendário

> Cole este documento inteiro na IA que vai implementar. O mockup de referência está em `docs/agendamento-tecnico/mockup.html` (abra no navegador).

---

Atue como **arquiteto de software, product designer e engenheiro de software sênior**. Analise o sistema existente antes de propor ou implementar alterações.

## Contexto

O sistema já gerencia projetos. Queremos criar um fluxo para que **Gerentes de Projeto (GPs)** solicitem agendamentos de **visitas técnicas** relacionadas aos projetos.

Hoje o GP solicita a agenda ao **Aprovador**. O Aprovador avalia a solicitação, alinha a visita com os técnicos e decide se aprova ou reprova. **Somente os agendamentos aprovados devem aparecer no calendário de implantação.**

## Objetivo

Criar, dentro do módulo **"Implantação"**, duas opções novas:

1. **"Solicitação de agenda"**
2. **"Calendário"**

Antes de desenvolver, analise a arquitetura, as telas, os componentes, os padrões visuais e as entidades existentes. Reutilize o que já existe sempre que for adequado. Não crie estruturas duplicadas sem necessidade.

## Restrição desta fase (obrigatória)

O módulo está **em desenvolvimento** e só pode ser visto por usuários com papel **`super_admin`** (hoje, 2 pessoas). Aplique a restrição em 3 camadas:

- **Menu:** os dois itens novos só aparecem se `isSuperAdmin`.
- **Rotas:** guard `SuperAdminRoute`, copiado de `src/components/AdminRoute.tsx` trocando `isAdmin` por `isSuperAdmin`.
- **Banco:** RLS das tabelas novas exige `public.has_role(auth.uid(),'super_admin')`, além do isolamento por tenant.

Durante esta fase, o super admin consegue atuar **como GP e como Aprovador**, para testar o fluxo completo. Deixe as regras de perfil (item "Perfis") prontas para, ao liberar o módulo, trocar a checagem de super admin pelas permissões normais **sem reescrever o fluxo**.

**Não alterar nada existente:**
- o item "Implantação" atual, que é um iframe do portal externo PSM Agendamento (`src/pages/Implantacao.tsx`), continua igual;
- o item "Report IMP" continua igual.

As opções novas são **adicionadas** ao mesmo grupo do menu.

---

## Fatos do sistema atual (verifique e reutilize)

### Stack
- React 18 + Vite + TypeScript + Tailwind + **shadcn/ui** (`src/components/ui/*`).
- Supabase: client em `src/integrations/supabase/client.ts`, tipos em `src/integrations/supabase/types.ts`.
- `lucide-react`, `date-fns` (locale `ptBR`), toasts com `sonner`.
- Deploy: push na `main` gera o deploy na Vercel.

### Menu e rotas
- Menu lateral: `src/components/AppSidebar.tsx`. O grupo "Implantação" tem hoje os itens "Implantação" (`/implantacao`) e "Report IMP" (`/implantacao/report-imp`).
- Sidebar recolhida abre os grupos em menu flutuante: `src/components/sidebar/SidebarNav.tsx`.
- Rotas: `src/App.tsx`. Sugestão: `/implantacao/solicitacoes` e `/implantacao/calendario`.

### Autenticação e perfis
- `useAuth()` (`src/contexts/AuthContext.tsx`) expõe `user`, `isAdmin` e `isSuperAdmin`.
- Permissões por módulo: `usePermissions()` (`src/hooks/usePermissions.ts`) e `MODULES` (`src/lib/permissions.ts`), que já contém o módulo `implantacao`.
- Papéis de usuário (`app_role`) incluem `implantacao`, `projetos`, `admin` e `super_admin`.

### Projetos e GP
- Tabela `projects`: `id, tenant_id, company_name` (o cliente), `project_code, city, state, country_code, status, sub_phase, manager_id, executive_id, fleet_size, implemented_fleet, d_zero_date, handover_date`.
- **O GP do projeto** é `projects.manager_id` → `team_members.id`.
- **O usuário logado é ligado ao GP pelo e-mail:** `team_members.email = auth user email`. Ver o `currentManagerId` e o `canEditProject` em `src/pages/ProjectManagement.tsx`. Use a mesma regra para listar "os projetos do GP".
- Status e sub-fases: `statusLabels` (`src/lib/statusLabels.ts`) e `subPhasesByStatus` (`src/pages/ProjectManagement.tsx`).
  - **Elegibilidade sugerida:** projetos em `planejamento` ou `implantacao`.
  - Destaque os que estão na sub-fase `cronograma_visita` ("Cronograma de Visita Técnica").

### Equipe e técnicos
- Tabela `team_members` (`id, tenant_id, full_name, role, email, active`). O campo `role` é texto livre.
- **Hoje não existem técnicos cadastrados:** só há `gerente_projetos` e `executivo_vendas`.
- Crie o papel de equipe **`tecnico_implantacao`**, cadastrável em Administração > Equipe (`src/pages/TeamMembers.tsx`). Opcionalmente, crie também `aprovador_implantacao`.

### Modelos a seguir
- **Migration-modelo** (tabela filha de projeto, RLS, policy RESTRICTIVE `tenant_guard`, índice, trigger `update_updated_at`): `supabase/migrations/20260925180000_project_activities.sql`.
- Função de isolamento por tenant: `public.tenant_guard(tenant_id)`, em `supabase/migrations/20260924100300_enforce_tenant_isolation.sql`.
- **Padrão visual:** `src/pages/VisaoComercial.tsx`:
  - header com overline + título + subtítulo;
  - cards de KPI com ícone e botão **"i"** explicativo (`KpiInfo`);
  - painel de filtros à esquerda;
  - busca e alternância de visualização;
  - cards `rounded-xl`;
  - dark mode por tokens (`bg-card`, `text-muted-foreground`).
  - Cor da marca: roxo `#4b1768`.
- **CRUD com dialog**, lista de projetos e lista de equipe: `src/components/comercial/CronogramaTab.tsx`.
- Formatação de local: `formatLocation()` em `src/lib/location.ts`.

---

## Fluxo esperado

### 1. Solicitação pelo Gerente de Projeto
- O GP acessa **Implantação > Solicitação de agenda**.
- A tela apresenta **os projetos que o GP pode solicitar**, respeitando as regras de acesso e elegibilidade (item anterior).
- O GP seleciona um projeto e preenche:
  - **objetivo da visita** (obrigatório): campo de seleção com as opções pré-definidas abaixo **e** a opção "Outro", que libera um campo de texto livre. O GP **não é obrigado** a usar as opções pré-definidas.
    - Projeto Executivo
    - 1ª Visita - Bilhetagem
    - 2ª Visita - Bilhetagem
    - 3ª Visita - Bilhetagem
    - 1ª Visita - ITS / Gestão de Frotas
    - 2ª Visita - ITS / Gestão de Frotas
    - 3ª Visita - ITS / Gestão de Frotas
  - **período desejado** (data/hora de início e de fim);
  - local (pré-preenchido com a cidade/UF do projeto);
  - observações.
- Mantenha as opções pré-definidas numa constante única, por exemplo `VISIT_PURPOSE_PRESETS` em `src/lib/visitPurposes.ts`, fácil de editar. Se for simples, torne-as configuráveis por tenant no futuro, como `status_labels`.
- **O GP não indica técnicos.** Ele apenas solicita a visita. A definição dos técnicos é exclusiva do Aprovador, na aprovação.
- A solicitação fica **pendente** de avaliação do Aprovador.
- O GP acompanha as próprias solicitações (Pendente, Aprovada, Reprovada, Cancelada) e pode **cancelar** uma solicitação enquanto ela estiver pendente.
- A solicitação **não aparece no calendário** enquanto estiver pendente.

### 2. Avaliação pelo Aprovador
- O Aprovador vê a **fila de solicitações recebidas**, com filtros (status, GP, projeto, período) e busca, e consulta os detalhes de cada uma.
- **Aprovar:**
  - o Aprovador define os **técnicos alocados** (obrigatório, pelo menos 1) e o **período final**, que pode ajustar em relação ao pedido;
  - o sistema **bloqueia conflito**: um técnico não pode ter dois agendamentos aprovados com períodos sobrepostos.
- **Reprovar:** a **justificativa é obrigatória**.
- Registre status, responsáveis e datas para manter o histórico:
  - quem solicitou e quando;
  - quem avaliou e quando;
  - a justificativa;
  - alterações de período.
- O GP vê o resultado: o status muda e a justificativa aparece.

### 3. Calendário de implantação
- **Implantação > Calendário** exibe **somente agendamentos aprovados**.
- Para cada agendamento, mostra no mínimo: **projeto, cliente, técnico(s) e período**.
- **Visão principal: linha do tempo por técnico** (uma linha por técnico, dias nas colunas, barras de início a fim no cliente). Deve deixar claro **de quando até quando cada técnico estará alocado em cada cliente**.
- Visões secundárias: **mês** e **lista**.
- Filtros por técnico, cliente/projeto e GP; navegação por período; clique na barra abre o detalhe.
- Solicitações pendentes ou reprovadas **nunca** aparecem como confirmadas.

---

## Modelo de dados sugerido (valide contra o existente antes)

**`implantation_requests`** — a solicitação e o seu ciclo de vida:

| Coluna | Observação |
|---|---|
| `id` | |
| `tenant_id` | |
| `project_id` | → `projects` |
| `requested_by` | `auth.uid()` |
| `requester_team_member_id` | → `team_members`, o GP |
| `visit_purpose` | texto NOT NULL: o nome da opção pré-definida escolhida ou o texto livre digitado |
| `visit_purpose_is_custom` | boolean: `true` quando o GP digitou um nome livre ("Outro") |
| `requested_start`, `requested_end` | timestamptz |
| `location` | |
| `notes` | |
| `status` | `pendente \| aprovada \| reprovada \| cancelada` |
| `approved_start`, `approved_end` | |
| `reviewed_by`, `reviewed_at` | |
| `rejection_reason` | **obrigatória quando `status = 'reprovada'`**, via CHECK |
| `created_at`, `updated_at` | |

**`implantation_request_members`** — os técnicos alocados na aprovação:

| Coluna | Observação |
|---|---|
| `request_id` | |
| `team_member_id` | |
| PK | (`request_id`, `team_member_id`) |

**`implantation_request_history`** — histórico de eventos:

| Coluna | Observação |
|---|---|
| `id` | |
| `request_id` | |
| `action` | `criada \| aprovada \| reprovada \| cancelada \| periodo_alterado` |
| `actor_id` | |
| `details` | jsonb |
| `created_at` | |

Regras no banco:
- O calendário lê **apenas** `status = 'aprovada'`; pode ser uma view `implantation_calendar`.
- Trigger ou função bloqueia **conflito de técnico** entre aprovadas com períodos sobrepostos.
- RLS por tenant + super admin nesta fase.

---

## Perfis (preparar para depois da fase restrita)

| Perfil | Pode |
|---|---|
| **GP** (`team_members.role = 'gerente_projetos'`, ligado por e-mail) | Ver os próprios projetos elegíveis, criar e cancelar as próprias solicitações, ver o status delas, ver o calendário |
| **Aprovador** (papel `implantacao` ou team role `aprovador_implantacao`) | Ver todas as solicitações, aprovar ou reprovar, alocar técnicos, ver o calendário |
| **Admin / Super admin** | Tudo |

Nesta fase, todos os acessos acima são concedidos **somente a `super_admin`**.

---

## Experiência e interface

- Interface clara, moderna e eficiente, inspirada em boas práticas de ferramentas como o **Monday.com**, sem copiar sua identidade visual.
- Use os recursos que funcionam nessas ferramentas: status em "pílulas" coloridas, linhas agrupadas por status, timeline por pessoa, contadores no topo.
- **Visão do GP:**
  - lista de "Meus projetos" com o botão **Solicitar agenda**;
  - lista de "Minhas solicitações" com status e justificativa.
- **Visão do Aprovador:**
  - KPIs: Pendentes, Aprovadas na semana, Reprovadas no mês, Técnicos alocados hoje;
  - fila de pendentes no topo e ações rápidas **Aprovar / Reprovar** na própria linha;
  - painel lateral (Sheet) com os detalhes e o histórico.
- **Estados obrigatórios:**
  - **vazio:** sem projetos elegíveis, sem solicitações, sem agendamentos no período;
  - **carregamento:** skeletons;
  - **erro:** com a opção de tentar de novo;
  - **confirmações:** antes de reprovar ou cancelar;
  - **validações:** objetivo obrigatório (texto livre não pode ficar vazio quando "Outro" for escolhido), fim depois do início, justificativa obrigatória, pelo menos 1 técnico na aprovação, aviso de conflito em tempo real.
- Filtros, busca e detalhe no padrão da Visão Comercial (painel à esquerda, busca no topo, Sheet lateral).
- Responsivo (desktop e celular) e com dark mode.

---

## Processo de trabalho

1. **Inspecione o projeto** e confirme:
   - tecnologias e arquitetura;
   - módulos e telas relacionados (Implantação, Visão Comercial, Gestão de Projetos/Kanban, Cronograma, Equipe);
   - entidades de projetos, clientes (`projects.company_name`), técnicos (`team_members`) e implantação;
   - autenticação, perfis e permissões (`AuthContext`, `usePermissions`, `user_roles`, RLS existentes).
2. **Proponha o plano** antes de codar: modelo de dados, telas, componentes reutilizados e pontos de alteração. Liste o que **não** será alterado.
3. **Implemente em etapas pequenas e verificáveis:**
   1. migration (tabelas, RLS, triggers, view);
   2. guard e menu;
   3. Solicitação (GP);
   4. Avaliação (Aprovador);
   5. Calendário.
4. **Valide:**
   - `npx tsc --noEmit -p tsconfig.app.json` e `npx vite build` sem erros;
   - teste do fluxo completo: solicitar → aprovar → aparece no calendário; solicitar → reprovar com justificativa → não aparece;
   - teste com um usuário **sem** super admin: não vê o menu, a rota redireciona e a API retorna vazio.
5. **Entregue:**
   - resumo do que mudou;
   - arquivos criados e alterados;
   - como aplicar a migration (`npx supabase db push --linked`);
   - pendências para liberar o módulo aos perfis reais.

## Critérios de aceite
1. Somente `super_admin` vê e usa o módulo nesta fase, nas 3 camadas.
2. O GP só solicita para projetos elegíveis dele, escolhendo um objetivo pré-definido ou digitando um livre, **sem indicar técnicos**. A solicitação nasce **pendente** e não aparece no calendário.
3. O Aprovador aprova (com técnicos e período) ou reprova (com justificativa obrigatória). O histórico registra quem e quando.
4. O calendário mostra apenas aprovadas, com projeto, cliente, técnico(s) e período claros na linha do tempo por técnico.
5. Conflito de técnico bloqueado no front e no banco.
6. Isolamento por tenant preservado.
7. Nada existente alterado, além das adições ao menu e às rotas.
8. Type-check e build sem erros.
