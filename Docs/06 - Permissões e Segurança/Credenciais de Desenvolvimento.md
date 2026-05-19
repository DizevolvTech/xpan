# Credenciais de Desenvolvimento

> Logins das 6 personas para **desenvolvimento local**. Definidos em `src/lib/demo-credentials.ts:2-43`, semeados em `supabase/seed.sql:125-131`. Para o fluxo de login/sessão, ver [[Autenticação e Sessão]]; para autorização, ver [[Autorização de API]].

> [!warning] Apenas dev
> Senhas no padrão `Persona@123` são fracas e estão hardcoded no repositório — uso exclusivo em ambiente local. **Nunca** replicar esse esquema em staging ou produção.

> [!note] Chaves do Supabase não ficam aqui
> As chaves do projeto Supabase (`ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY`, `ACCESS_TOKEN`, etc.) vivem **somente** em `.env.local` (gitignored por `.env*`). Não são documentadas no cofre para não entrarem no histórico do git.

## Logins das 6 personas

| Persona | Email | Senha | Role | Tenant |
|---|---|---|---|---|
| Administrador Master (SaaS) | `master@danielaugusto.com` | `Master@123` | `administrador-master` | — (global) |
| Administrador (tenant) | `admin@danielaugusto.com` | `Admin@123` | `administrador` | `tenant-seed` |
| Gestor de Dados | `engenharia@danielaugusto.com` | `Engenharia@123` | `gestor-dados` | `tenant-seed` |
| Gestor de Fábrica | `fabrica@danielaugusto.com` | `Fabrica@123` | `gestor-fabrica` | `tenant-seed` |
| Chão de Fábrica | `chao@danielaugusto.com` | `Chao@123` | `chao-fabrica` | `tenant-seed` |
| Loja / PDV | `loja@danielaugusto.com` | `Loja@123` | `loja` | `tenant-seed` |

Detalhe de cada persona: [[Administrador Master]] · [[Administrador]] · [[Gestor de Dados]] · [[Gestor de Fábrica]] · [[Chão de Fábrica]] · [[Loja]].

## Seeding no Supabase

> [!important] Só `loja@` vem seeded por padrão
> No Supabase dev, apenas `loja@danielaugusto.com` está pré-criado na `auth.users`. As outras 5 personas precisam ser provisionadas pelo script de bootstrap antes do primeiro login.

```bash
# Confere o que seria feito (não escreve nada)
npx ts-node scripts/supabase/bootstrap-auth-users.ts --dry-run

# Cria/atualiza os usuários auth no Supabase
npx ts-node scripts/supabase/bootstrap-auth-users.ts

# Exporta as credenciais emitidas para JSON
npx ts-node scripts/supabase/bootstrap-auth-users.ts --export=./creds.json
```

O script (`scripts/supabase/bootstrap-auth-users.ts`):

1. Cria ou atualiza registros em `auth.users` no Supabase.
2. Define a senha a partir de `src/lib/demo-credentials.ts`.
3. Vincula `public.profiles.auth_user_id` ao usuário auth correspondente.

Os profiles correspondentes são inseridos por `supabase/seed.sql:125-131` com `tenant_id`, `role` (enum `user_role`) e `status = 'ativo'` (Master tem `tenant_id = null`).

## Senha temporária (fallback)

Quando não há senha pré-definida para um usuário, `src/lib/auth-credentials.ts:4-8` gera uma temporária no padrão:

```
xpan@<prefixo-email><prefixo-role>9
```

Exemplo — `test@example.com` com role `loja` → `xpan@testloja9`.
