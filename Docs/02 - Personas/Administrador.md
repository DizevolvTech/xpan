# Administrador

> **Slug:** `administrador`
> **Escopo:** Tenant inteiro
> **Definição:** `src/lib/permission-modules.ts:125-130`

## Descrição

Persona do **dono ou gerente geral da padaria cliente**. Tem visão total do ecossistema do seu tenant: governança de usuários, canal com a Xpan, e visibilidade de todos os módulos operacionais.

É efetivamente o **super-usuário do tenant** — `gerenciar` em todos os módulos não-master por padrão.

## Capacidades

Default `gerenciar` em **todos os módulos exceto `administrador-master`** (`src/lib/permission-modules.ts:453-458`).

**Grupos permitidos** (`roleAllowedGroups`): `administrador`, `gestor-dados`, `gestor-fabrica`, `chao-fabrica`, `loja` (`src/lib/permission-modules.ts:486`).

Na prática enxerga todas as áreas no menu lateral.

## Rotas próprias

| Rota | Arquivo |
|---|---|
| `/administrador` (Dashboard Executivo) | `src/app/administrador/page.tsx:223` |
| `/administrador/usuarios` | `src/app/administrador/usuarios/page.tsx:116` |
| `/administrador/ocorrencias` | `src/app/administrador/ocorrencias/page.tsx:6` |
| `/administrador/perfil` | `src/app/administrador/perfil/page.tsx:3` |

Layout: `src/app/administrador/layout.tsx`.

## Módulos próprios

| Módulo | Default | Detalhe |
|---|---|---|
| `administrador.dashboard` | `gerenciar` | Dashboard Executivo |
| `administrador.usuarios` | `gerenciar` | Usuários e Permissões |
| `administrador.ocorrencias` | `gerenciar` | Canal com a Xpan (suporte) |

## Tabelas tocadas

- `profiles`, `user_permissions`, `profile_store_access` (governança de usuários)
- `tenant_support_occurrences`, `tenant_support_occurrence_events` (canal de suporte)
- Indiretamente: tudo, porque pode operar todos os módulos

## APIs

- `/api/admin/users` + `[userId]` — gestão de usuários
- `/api/admin/support-occurrences/*` — canal de ocorrências

## Pontos de atenção

- **É super-usuário** — qualquer ajuste de regra de negócio que o impacte afeta o tenant todo. Privilegiar feature flags + permission overrides via `administrador/usuarios` ao invés de mudar default.
- **Em `administrador/usuarios`**, ao editar permissões: o `sanitizePermissionsForRole` (`src/lib/permission-modules.ts:493-507`) zera permissões fora do `roleAllowedGroups` da persona-alvo. Não confie só no UI.
- **Acesso ao painel master** está bloqueado — `administrador-master.*` retorna `sem_acesso` para esta persona.

## Jornadas envolvidas

- [[Jornada — Onboarding de Tenant]] (configuração inicial pós-master)
- [[Jornada — Ocorrências]] (lado tenant ↔ Xpan)
- Indiretamente todas as outras
