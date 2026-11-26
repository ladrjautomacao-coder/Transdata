# PRD — Sistema de Gestão de Projetos Transdata

**Versão:** 1.0  
**Data:** 13/06/2026  
**Status:** Documento vivo (atualizar a cada feature relevante)  
**Stack:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Supabase próprio (Postgres, Auth, Storage, Edge Functions) + Vercel (hosting)

---

## 1. Visão Geral

### 1.1 Propósito
Plataforma interna da Transdata para gestão ponta-a-ponta de projetos de implantação de soluções de transporte: cadastro, acompanhamento via Kanban, controle de SLA, anexos, histórico de mudanças, equipe e relatórios.

### 1.2 Problema que resolve
- Centraliza informações de projetos hoje espalhadas em planilhas/e-mails.
- Dá visibilidade em tempo real do estágio de cada implantação.
- Alerta sobre projetos parados ou em risco de atraso (SLA).
- Garante rastreabilidade de mudanças (audit log).

### 1.3 Personas
| Persona | Acesso | Atividade principal |
|---|---|---|
| **Admin** (`luiz.junior@itstransdata.com`) | Irrestrito | Configura sistema, gere usuários/entidades, move qualquer card |
| **Gerente de Projetos** | Vinculado a si | Move/edita apenas seus projetos no Kanban; visualiza demais |
| **Usuário** | Leitura | Visualiza projetos, dashboards e acervo |

---

## 2. Identidade Visual & UX

- **Cores:** Deep Purple `hsl(273 70% 32%)` (primária), Orange `hsl(17 89% 54%)` (accent), sidebar deep purple.
- **Tipografia:** Rajdhani (títulos), Space Grotesk (corpo).
- **Estilo:** Glassmorphism, gradientes sutis, animações no login.
- **PWA:** Otimizado para mobile, estratégias de cache.
- **Tema escuro:** Padronizado.

---

## 3. Módulos Funcionais

### 3.1 Autenticação
- Login por e-mail/senha (Supabase Auth), feito só na tela de acesso do Gerenciador Transdata (login único com Transmobile e Roadmap; o CS Flow abre em `/transdata/` no endereço do portal).
- Recuperação de senha e cadastro também na tela de acesso do portal; `/login`, `/cadastro`, `/forgot-password` e `/reset-password` daqui só encaminham para lá.
- **Sem cadastro público** — usuários criados via Gestão de Usuários.
- Vínculo `auth.users.email ↔ team_members.email` define identidade de gerente.
- Roles em tabela separada `user_roles` (enum `app_role`), checadas via função `SECURITY DEFINER` `has_role()`.

### 3.2 Dashboard (`/`)
- KPIs: total de projetos, em andamento, concluídos, atrasados.
- Distribuição por frota e por status.
- Persistência de filtros de status.
- Gráficos responsivos.

### 3.3 Projetos
- **Listagem** (`/projetos`) — tabela filtrável, busca, ordenação.
- **Novo** (`/projetos/novo`) — formulário multi-seção.
- **Detalhe** (`/projetos/:id`) — visão completa, abas (Geral, Frota, Anexos, Histórico, Acompanhamento).
- **Gestão / Kanban** (`/projetos/gestao`) — board por gerente.
- Seções principais: identificação, frota (modelos/quantidades), solução contratada, datas-chave, gerente vinculado, status, prioridade.

### 3.4 Kanban (`/projetos/gestao`)
- Colunas por fase + sub-fases.
- **Heat map de SLA** com cores por tempo na coluna.
- Filtro por gerente — muda visibilidade, **não** muda permissão.
- **Regra de movimentação** (crítica):
  - Admin → move qualquer card.
  - Gerente → move apenas cards onde `projects.manager_id` corresponde ao seu `team_member.id` (match por e-mail).
  - Demais → somente leitura, sem arrastar.
- Feedback visual em cards bloqueados (cursor padrão, ícone de cadeado).
- Defesa em profundidade na RLS de `projects` (UPDATE).

### 3.5 Acompanhamento (Follow-up Log)
- Append-only, sem limite de caracteres.
- Cada nota registra autor + timestamp.
- Não editável após criação (auditabilidade).

### 3.6 Anexos
- Storage no Supabase (projeto próprio).
- INSERT exige `uploaded_by = auth.uid()`.
- DELETE só pelo autor ou admin.

### 3.7 Histórico / Audit Log
- Triggers automáticas em `projects` populam `project_history`.
- INSERT bloqueado para clientes — só `service_role`/triggers.
- Mostra campo, valor antigo, valor novo, autor e data.

### 3.8 Alertas (Notification Center)
- Sino no header global.
- Sinaliza projetos parados em uma fase além do SLA, ou em estado crítico.

### 3.9 Command Palette (Ctrl+K)
- Busca global e navegação rápida entre projetos, páginas e entidades.

### 3.10 Entidades Gerenciadas
- **Gerentes**, **Soluções**, **Integrações**, **Produtos** — CRUD admin-only.
- **Equipe** (`/equipe`) — `team_members` com nome, e-mail, papel.
  - Coluna `email` revogada de `anon`/`authenticated`; admin acessa via RPC `admin_get_team_emails()`.

### 3.11 Acervo Técnico (`/acervo`)
- Documentação técnica consultável.

### 3.12 Manual do Sistema (`/manual`)
- Guia de uso interno.

### 3.13 Gestão de Usuários (`/usuarios`) — Admin
- Criar/editar usuários, atribuir roles.

---

## 4. Modelo de Dados (resumo)

| Tabela | Finalidade |
|---|---|
| `projects` | Projeto e todos os atributos de gestão |
| `project_attachments` | Anexos (storage) |
| `project_history` | Audit log append-only |
| `project_followup` | Notas de acompanhamento |
| `team_members` | Pessoas (gerentes, equipe) |
| `user_roles` | Vínculo `user_id ↔ app_role` |
| `solutions` / `integrations` / `products` | Catálogos |

**Padrões obrigatórios:**
- Toda tabela `public` com `GRANT` explícito por papel.
- RLS habilitada; políticas escritas via `has_role()`.
- Roles **nunca** em `profiles`/`users`.

---

## 5. Regras de Segurança (RLS atual)

- `projects`: SELECT autenticado; UPDATE = admin OU gerente vinculado; DELETE = admin.
- `project_attachments`: DELETE = autor OU admin; INSERT exige `uploaded_by = auth.uid()`.
- `project_history`: INSERT bloqueado (apenas triggers/service_role).
- `solutions` / `integrations` / `products`: mutação admin-only.
- `team_members.email`: oculta para não-admin.
- Funções `SECURITY DEFINER` com `EXECUTE` revogado de público.

---

## 6. Requisitos Não-Funcionais

- **Performance:** lazy-loading de rotas pesadas; consultas indexadas.
- **PWA:** instalável, cache offline básico.
- **Acessibilidade:** componentes shadcn (Radix) já cobrem ARIA base.
- **Mobile:** layout responsivo prioritário (gerentes em campo).
- **i18n:** Português-BR.

---

## 7. Fora de Escopo (atual)

- Permissão granular na página de detalhe (somente Kanban hoje).
- Notificações por e-mail/push externas.
- Integração com ERPs externos.
- App nativo (PWA atende).

---

## 8. Roadmap (sugerido, não comprometido)

1. Permissão de edição também na página de detalhe (espelhar Kanban).
2. Notificações por e-mail em alertas críticos.
3. Relatórios exportáveis (PDF/Excel).
4. Dashboard executivo (visão consolidada por cliente).

---

## 9. Glossário

- **SLA** — Tempo máximo esperado em cada fase do Kanban.
- **Gerente vinculado** — `team_members` com `role = 'gerente_projetos'` cujo e-mail bate com `auth.users.email`.
- **Append-only** — Registros não podem ser editados nem deletados após criados.
