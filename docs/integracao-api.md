# API de integração

A API é uma Supabase Edge Function de leitura, autenticada com JWT de um usuário que tenha o papel `integration`. As consultas usam o token do usuário e respeitam as políticas RLS, incluindo o isolamento do tenant. A chave `service_role` nunca deve ser enviada ao projeto externo.

## Autenticação

Crie ou atribua ao usuário técnico o papel `integration` no tenant que será integrado. O projeto externo deve autenticar esse usuário no Supabase Auth e usar o `access_token` retornado como Bearer token. A chave pública `anon` é enviada no cabeçalho `apikey`; ela não substitui o token de usuário.

```http
POST https://<project-ref>.supabase.co/auth/v1/token?grant_type=password
apikey: <SUPABASE_ANON_KEY>
Content-Type: application/json

{"email":"<integration-user>","password":"<password>"}
```

Renove o token usando o `refresh_token` antes de expirar. Guarde as credenciais e os tokens em um gerenciador de segredos no sistema externo; nunca os inclua no frontend público.

## Rotas

Base URL: `https://<project-ref>.supabase.co/functions/v1/integration-api`

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/projects` | Lista projetos, mais recentemente atualizados primeiro. |
| `GET` | `/projects/{id}` | Retorna um projeto pelo UUID. |

Todas as chamadas às rotas exigem os cabeçalhos:

```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <access_token>
```

### Listar projetos

Parâmetros opcionais: `limit` (padrão `50`, máximo `100`), `offset` (padrão `0`) e `status` (`planejamento`, `execucao`, `homologacao`, `encerrado` ou `suspenso`).

```http
GET /functions/v1/integration-api/projects?limit=25&offset=0&status=execucao
```

Resposta:

```json
{
  "data": [
    {
      "id": "uuid",
      "project_code": "PRJ-001",
      "company_name": "Empresa Exemplo",
      "city": "São Paulo",
      "state": "SP",
      "status": "execucao",
      "sub_phase": null,
      "system": {
        "urbano": 12,
        "seccionado": 3
      },
      "project_manager_name": "Nome do Gerente",
      "updated_at": "2026-09-30T12:00:00+00:00"
    }
  ],
  "pagination": { "limit": 25, "offset": 0, "total": 1 }
}
```

### Consultar um projeto

```http
GET /functions/v1/integration-api/projects/<uuid>
```

A resposta contém `{ "data": { ...projeto } }`, incluindo `system.urbano`, `system.seccionado` e `project_manager_name`. Se o projeto não tiver gerente associado, `project_manager_name` será `null`. Um projeto fora do tenant do usuário não é revelado e retorna `404`.

## Códigos de resposta

`400` indica parâmetro inválido; `401`, token ausente, inválido ou expirado; `403`, usuário sem papel `integration`; `404`, rota ou projeto não encontrado; `405`, método não permitido. Respostas de erro usam `{ "error": "..." }`.

## Publicação

Implante com `supabase functions deploy integration-api`. O JWT é validado tanto pela configuração `verify_jwt` quanto pela função; mantenha a função de provisionamento de usuários fora do fluxo de chamadas da API.