---
name: transdata-ui
description: Padrão de interface do portal Transdata (React + Tailwind + shadcn/ui, multi-tenant). Use SEMPRE que for criar ou alterar telas, componentes, cards, KPIs, filtros, diálogos, tabelas, calendários ou estados (vazio/carregando/erro) em src/pages ou src/components — inclusive ajustes visuais pequenos — para manter a consistência com Visão Comercial e Agenda de Implantação.
---

# Padrão de interface — portal Transdata

Telas de referência (leia uma delas antes de criar algo novo):
- `src/pages/VisaoComercial.tsx` — header, KPIs com "i", filtros à esquerda, cards de projeto, grade/lista.
- `src/pages/SolicitacaoAgenda.tsx` + `src/components/agendamento/*` — fluxo com perfis, fila agrupada por status, diálogos, Sheet de detalhe, estados.
- `src/pages/CalendarioImplantacao.tsx` — linha do tempo, mês, lista, navegação de período.

## 1. Regras de ouro

1. **Multi-tenant: nunca fixe a cor da marca.** `--primary`, fontes e sidebar mudam por tenant (`TenantBrandingContext`, `:root[data-tenant="transdata"]` em `src/index.css`). Use **tokens**: `bg-primary`, `text-primary`, `bg-primary/10`, `border-primary/30`, `ring-primary`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`. O roxo `#4b1768` só aparece na sidebar (já existente) — não copie para telas.
2. **Dark mode sempre.** Nada de `bg-white`/`text-black`/`text-slate-*` em telas: use os tokens acima. Cores semânticas com opacidade + variante dark: `bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`.
3. **Reutilize antes de criar.** shadcn em `src/components/ui/*` (dialog, sheet, alert-dialog, select, popover, tooltip, tabs, switch, skeleton, table, badge…), ícones `lucide-react`, toasts `sonner` (`toast.success/error/warning/info`), `formatLocation()` de `src/lib/location.ts`, `statusLabels`/`subPhasesByStatus` de `src/pages/ProjectManagement.tsx`, `teamRoleLabels` de `src/lib/teamRoleLabels.ts`.
4. **Textos em português do Brasil**, curtos e orientados à ação ("Solicitar agenda", "Aprovar e publicar no calendário"). Labels vindos de configuração do tenant (status, papéis) nunca são fixos no código.
5. **Não altere telas existentes** fora do escopo pedido; módulo novo entra como adição.

## 2. Estrutura de página

```tsx
<div className="flex flex-col gap-5">
  {/* Header */}
  <div className="flex flex-wrap items-end gap-4">
    <div>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Módulo</span>
      <h1 className="text-2xl font-bold tracking-tight">Título da tela</h1>
      <p className="text-sm text-muted-foreground">Uma frase dizendo para que serve.</p>
    </div>
    <div className="ml-auto flex flex-wrap items-center gap-2">{/* ações: Exportar, Atualizar, primária */}</div>
  </div>
  {/* KPIs → toolbar (busca/filtros/visão) → conteúdo */}
</div>
```

## 3. Componentes-padrão

- **KPI**: use `Kpi` de `src/components/agendamento/AgendaShared.tsx` (ícone em quadrado colorido `rounded-lg`, rótulo UPPERCASE 11px, número `text-2xl font-bold`, legenda 11px, botão **"i"** com Popover explicando a regra). KPI clicável = filtra a lista. Grade: `grid grid-cols-2 gap-3 lg:grid-cols-4` (até `2xl:grid-cols-7`).
- **Card/seção**: `rounded-xl border border-border/60 bg-card shadow-sm`; cabeçalho da seção `border-b px-4 py-3` com ícone `text-primary` + título `text-sm font-semibold`.
- **Linha de lista clicável**: `<li role="button" tabIndex={0}>` com `hover:bg-muted/50`, borda esquerda colorida por status (`border-l-[3px]`), ações à direita com `stopPropagation`. Ver `RequestRow`.
- **Status**: pílula `rounded-full px-2.5 py-0.5 text-[11px] font-semibold` + ponto colorido (`StatusPill`). Âmbar = pendente/atenção, esmeralda = ok/aprovado, vermelho = erro/reprovado/atrasado, cinza = cancelado/inativo.
- **Botões**: primário `<Button>` (usa `--primary`); aprovar/confirmar positivo `bg-emerald-600 text-white hover:bg-emerald-500`; destrutivo `variant="destructive"` ou `variant="outline"` com `border-destructive/40 text-destructive`. Ícone `h-4 w-4 mr-1.5` antes do texto. Em linhas: `size="sm" className="h-8 text-xs"`.
- **Filtros**: painel à esquerda (`KanbanFilters`) ou toolbar `rounded-xl border bg-card p-3` com busca (ícone `Search` absoluto + `pl-9`), `Select` e botão "Limpar" quando há filtro ativo.
- **Alternância de visão** (grade/lista, semana/mês): grupo `rounded-lg border p-0.5` com item ativo `bg-primary text-primary-foreground` (ou `bg-card shadow-sm text-primary` em fundo muted). Persistir a escolha em `localStorage` por usuário (com try/catch).
- **Detalhe**: `Sheet` lateral (`sm:max-w-md`) com cabeçalho (overline + título + status), `<dl>` de dados, bloco de histórico em timeline (`border-l-2` + bolinhas) e ações no rodapé.
- **Formulários em Dialog**: `Label` `text-xs`, campos `mt-1.5`, erro por campo em `text-[11px] text-destructive`, dica em `text-[11px] text-muted-foreground`, caixa informativa `rounded-lg bg-sky-500/10 text-sky-800 dark:text-sky-200`. Botão de envio desabilitado + `Loader2 animate-spin` enquanto salva.
- **Confirmação destrutiva**: `AlertDialog` (cancelar, excluir). Justificativa obrigatória quando a regra pedir.

## 4. Estados obrigatórios em toda tela com dados

- **Carregando**: `Skeleton` no formato do conteúdo (KPIs `h-[88px] rounded-xl`, linhas `h-16`).
- **Vazio**: `EmptyBlock` (ícone em quadrado `bg-primary/10`, título, texto explicando *o que fazer*, ação opcional). Diferencie "não há dados" de "nada com estes filtros" (com botão Limpar).
- **Erro**: bloco `border-destructive/30 bg-destructive/5` com mensagem amigável (`errorMessage()`) e "Tentar novamente".
- **Feedback de ação**: toast em toda ação concluída ou com erro (mensagem do banco no `description`).

## 5. Dados, regras e segurança

- Regra de negócio importante vale **no banco também** (trigger/RPC/RLS), não só na tela; a tela antecipa o erro com aviso amigável e botão desabilitado.
- Tabelas fora de `types.ts`: client `as any` concentrado em um `src/lib/<modulo>.ts` com tipos e funções de acesso (ver `src/lib/implantationScheduling.ts`).
- Super admin cross-tenant: filtre por `profile.tenant_id` ao listar dados do tenant.
- Módulo em desenvolvimento: menu condicional a `isSuperAdmin` em `AppSidebar.tsx`, rota com `SuperAdminRoute`, RLS com `has_role(auth.uid(),'super_admin')`, e selo "Em desenvolvimento · só Super Admin" no header.
- Datas exibidas `dd/MM` / `dd/MM HH:mm` (helpers `formatPeriod`); inputs `datetime-local` via `toLocalInput()`.

## 6. Responsividade e acessibilidade

- Funciona de 360px a desktop largo: grids `grid-cols-1 → sm/lg/xl`, toolbars `flex-wrap`, tabelas e timelines em `overflow-x-auto` com `min-w`.
- Botões só com ícone têm `aria-label`/`title`; elementos clicáveis não-botão têm `role="button"`, `tabIndex={0}` e Enter.
- Animações discretas: `transition`, `hover:-translate-y-0.5 hover:shadow-md` em cards clicáveis.

## 7. Antes de entregar

1. `npx tsc --noEmit -p tsconfig.app.json` e `npx eslint <arquivos alterados>` sem erros novos.
2. `npx vite build` passa.
3. Conferir: tokens (sem cor fixa), dark mode, os 3 estados, textos em PT-BR, "i" explicativo nos KPIs novos.
4. Deploy = push na `main` (Vercel). Verificar com `npx vercel ls projetostransdata --scope luiz-junior1` e buscar um texto novo no bundle publicado.
