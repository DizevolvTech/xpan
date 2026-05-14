# Administrador Master

> **Slug:** `administrador-master`
> **Escopo:** SaaS (global, não pertence a tenant operacional)
> **Definição:** `src/lib/permission-modules.ts:119-124`

## Descrição

Persona do dono do SaaS / equipe Xpan. Opera no **plano de controle**: gerencia clientes (tenants), faz triagem do canal de suporte com a base, e pode "entrar em modo leitura" no ecossistema de qualquer cliente para auditar.

É a única persona master, identificada por `isMasterRole` em `src/lib/tenant.ts:17-19`.

## Comportamento especial — Modo `read-only-tenant`

Quando seleciona um cliente via cookie `da_master_tenant` (`src/lib/tenant.ts:15`), entra em modo `read-only-tenant`:

- `resolveMasterAccessContext` (`src/lib/master-access-context.ts:30-46`) injeta permissões `gerenciar` em **todos os módulos não-master**.
- `canWriteInAccessMode` (`src/lib/tenant.ts:21-23`) bloqueia escrita.
- **Defesa em camadas** garante acesso às APIs próprias mesmo nesse modo:
  - `src/lib/api-permission-context.ts:22-42` — APIs do grupo `administrador-master` usam permissões reais
  - `src/lib/app-shell.ts:38-41` — mesma lógica no Server Component

> ⚠️ Implícito: o cookie precisa ser validado contra `user_role === "administrador-master"` no JWT. Adulteração por outra persona deve ser tratada. Ver [[Riscos de Segurança#R1.3]].

## Rotas

| Rota | Arquivo |
|---|---|
| `/administrador-master` (Painel SaaS) | `src/app/administrador-master/page.tsx:29` |
| `/administrador-master/clientes` | `src/app/administrador-master/clientes/page.tsx:78` |
| `/administrador-master/clientes/[tenantId]` | `src/app/administrador-master/clientes/[tenantId]/page.tsx:80` |
| `/administrador-master/perfil` | `src/app/administrador-master/perfil/page.tsx:3` |

Layout: `src/app/administrador-master/layout.tsx` → `<AreaShellLayout areaGroup="administrador-master">`.

## Módulos próprios

| Módulo | Default | Detalhe |
|---|---|---|
| `administrador-master.dashboard` | `gerenciar` | Visão SaaS |
| `administrador-master.clientes` | `gerenciar` | CRUD de tenants, suporte |

Ver [[Catálogo dos 27 Módulos]].

## Tabelas tocadas

- `tenants` (CRUD)
- `tenant_support_occurrences` + `tenant_support_occurrence_events`
- `profiles` (listar usuários do tenant via `api/master/clients/[tenantId]/users/route.ts`)

## APIs

- `/api/master/*` — protegidas por `administrador-master.clientes`
- > ⚠️ Mapear endpoints específicos quando [[APIs — Visão Geral]] for preenchido

## Pontos de atenção

- Nunca escreve em tabelas operacionais (produtos, pedidos, OPs etc.) — apenas leitura quando em `read-only-tenant`.
- Se for criar nova API master, garantir que `authorizeApiRequest` usa o módulo correto **e** que `resolveApiPermissionMap` mantém o desacoplamento da regra de defesa em camadas.
- Cookie `da_master_tenant` é o vetor mais sensível — qualquer dúvida em [[Multi-tenancy]] e [[Riscos de Segurança]].

## Jornadas envolvidas

- [[Jornada — Onboarding de Tenant]] (criar cliente)
- > Indireta: auditoria de qualquer outra jornada em modo leitura
