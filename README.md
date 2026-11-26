# GP Transdata

Portal interno da Transdata para gestão de projetos de implantação: cadastro, acompanhamento via
Kanban, controle de SLA, anexos, histórico de alterações, equipe e relatórios. Ver `docs/PRD.md`
para o detalhamento funcional completo.

**App em produção**: https://gerenciador-transdata.vercel.app/transdata/ (dentro do portal da Transdata, com o login único; o endereço antigo https://projetostransdata.vercel.app redireciona para lá)

## Stack

- React + Vite + TypeScript + Tailwind + shadcn/ui (Radix)
- Supabase (Postgres, Auth, Storage, Edge Functions) — projeto próprio
- Vercel (hosting/DNS)
- Anthropic Claude (assistente de IA integrado, super_admin-only)

## Desenvolvimento local

```sh
git clone <url-deste-repositório>
cd projetostransdata
npm i
cp .env.example .env   # preencher com os valores do seu projeto Supabase
npm run dev
```

Scripts úteis: `npm run build`, `npm run lint`, `npm run test`.

## Banco de dados

O schema é versionado em `supabase/migrations/`. Para aplicar num projeto Supabase:

```sh
npx supabase login
npx supabase link --project-ref <seu-project-ref>
npx supabase db push
```

As Edge Functions (`supabase/functions/`) são implantadas com
`npx supabase functions deploy <nome-da-função>` e dependem dos secrets `ANTHROPIC_API_KEY` e
`INTEGRATION_USER_PASSWORD` (configurados via `npx supabase secrets set`).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dc435e83-1e07-424d-952c-a66e45a342c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
