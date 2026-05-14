# Matriz Persona × Módulo × Nível

Fonte: `src/lib/permission-modules.ts:449-481` (`buildDefaultPermissions`) e `src/lib/permission-modules.ts:484-491` (`roleAllowedGroups`).

**Importante.** A tabela mostra o **nível default** que `buildDefaultPermissions` retorna para um usuário recém-criado em cada persona. Permissões podem ser depois customizadas por usuário em `administrador/usuarios` e ficam armazenadas em `public.user_permissions`. O `sanitizePermissionsForRole` (`src/lib/permission-modules.ts:493-507`) reseta para `sem_acesso` qualquer módulo cujo grupo não esteja em `roleAllowedGroups` da persona — ou seja: mesmo que o admin tente conceder, valores fora do grupo permitido são zerados.

**Legenda.**
- `sem_acesso` (rank 0) — não vê na navegação, APIs respondem 403.
- `visualizar` (rank 1) — pode ler.
- `operar` (rank 2) — pode operar (mudar status, registrar execução).
- `gerenciar` (rank 3) — pode criar/editar/excluir (gestão).

Ranks em `src/lib/permission-modules.ts:164-169`.

---

## Matriz completa (24 módulos × 6 personas)

| Módulo | adm-master | administrador | gestor-dados | gestor-fabrica | chao-fabrica | loja |
|---|---|---|---|---|---|---|
| `administrador-master.dashboard` | gerenciar | sem_acesso | sem_acesso | sem_acesso | sem_acesso | sem_acesso |
| `administrador-master.clientes` | gerenciar | sem_acesso | sem_acesso | sem_acesso | sem_acesso | sem_acesso |
| `administrador.dashboard` | sem_acesso* | gerenciar | sem_acesso | sem_acesso | sem_acesso | sem_acesso |
| `administrador.usuarios` | sem_acesso* | gerenciar | sem_acesso | sem_acesso | sem_acesso | sem_acesso |
| `administrador.ocorrencias` | sem_acesso* | gerenciar | sem_acesso | sem_acesso | sem_acesso | sem_acesso |
| `gestor-dados.dashboard` | sem_acesso* | gerenciar | gerenciar | sem_acesso | sem_acesso | sem_acesso |
| `gestor-dados.ingredientes` | sem_acesso* | gerenciar | gerenciar | sem_acesso | sem_acesso | sem_acesso |
| `gestor-dados.produtos` | sem_acesso* | gerenciar | gerenciar | sem_acesso | sem_acesso | sem_acesso |
| `gestor-dados.setores` | sem_acesso* | gerenciar | gerenciar | sem_acesso | sem_acesso | sem_acesso |
| `gestor-dados.linhas` | sem_acesso* | gerenciar | gerenciar | sem_acesso | sem_acesso | sem_acesso |
| `gestor-dados.lojas` | sem_acesso* | gerenciar | gerenciar | sem_acesso | sem_acesso | sem_acesso |
| `gestor-fabrica.dashboard` | sem_acesso* | gerenciar | sem_acesso | gerenciar | sem_acesso | sem_acesso |
| `gestor-fabrica.sublinhas` | sem_acesso* | gerenciar | sem_acesso | gerenciar | sem_acesso | sem_acesso |
| `gestor-fabrica.pedidos` | sem_acesso* | gerenciar | sem_acesso | gerenciar | sem_acesso | sem_acesso |
| `gestor-fabrica.ops` | sem_acesso* | gerenciar | sem_acesso | gerenciar | sem_acesso | sem_acesso |
| `gestor-fabrica.expedicao` | sem_acesso* | gerenciar | sem_acesso | gerenciar | sem_acesso | sem_acesso |
| `gestor-fabrica.ocorrencias` | sem_acesso* | gerenciar | sem_acesso | gerenciar | sem_acesso | sem_acesso |
| `chao-fabrica.dashboard` | sem_acesso* | gerenciar | sem_acesso | visualizar | operar | sem_acesso |
| `chao-fabrica.ops` | sem_acesso* | gerenciar | sem_acesso | visualizar | operar | sem_acesso |
| `chao-fabrica.expedicao` | sem_acesso* | gerenciar | sem_acesso | visualizar | operar | sem_acesso |
| `chao-fabrica.entregas` | sem_acesso* | gerenciar | sem_acesso | visualizar | operar | sem_acesso |
| `loja.dashboard` | sem_acesso* | gerenciar | sem_acesso | sem_acesso | sem_acesso | operar |
| `loja.pedidos` | sem_acesso* | gerenciar | sem_acesso | sem_acesso | sem_acesso | operar |
| `loja.ocorrencias` | sem_acesso* | gerenciar | sem_acesso | sem_acesso | sem_acesso | operar |

\* Para `administrador-master`: quando entra em modo `read-only-tenant` via cookie `da_master_tenant`, o `buildMasterTenantReadOnlyPermissions` (`src/lib/master-access-context.ts:18-28`) substitui `sem_acesso` por `gerenciar` em todos os módulos **não-master** — mas o write é bloqueado por `canWriteInAccessMode` (`src/lib/tenant.ts:21-23`). Resultado prático: vê tudo, não modifica nada.

---

## Resumo por grupo

| Persona | Grupos permitidos (`roleAllowedGroups`) | Padrão geral |
|---|---|---|
| `administrador-master` | `administrador-master` | `gerenciar` no próprio grupo |
| `administrador` | `administrador`, `gestor-dados`, `gestor-fabrica`, `chao-fabrica`, `loja` | `gerenciar` em **todos os módulos não-master** |
| `gestor-dados` | `gestor-dados` | `gerenciar` no próprio grupo |
| `gestor-fabrica` | `gestor-fabrica`, `chao-fabrica` | `gerenciar` em `gestor-fabrica.*` + `visualizar` em `chao-fabrica.*` |
| `chao-fabrica` | `chao-fabrica` | `operar` (não `gerenciar`) |
| `loja` | `loja` | `operar` + filtro por `storeIds` |

---

## Cruzamentos especiais em APIs (`anyOfPermissions`)

Casos em que um endpoint aceita usuários de mais de uma persona:

| Endpoint | Permissões aceitas |
|---|---|
| `src/app/api/factory-planning/route.ts:16` | `gestor-fabrica.dashboard` OR `chao-fabrica.dashboard` |
| `src/app/api/factory-planning/workflow/route.ts:89` | `gestor-fabrica.ops` OR `chao-fabrica.ops` |
| `src/app/api/delivery-executions/route.ts:24,57` | `gestor-fabrica.expedicao` OR `chao-fabrica.expedicao` |
| `src/app/api/store-occurrences/route.ts:41` | `loja.ocorrencias` OR `gestor-fabrica.ocorrencias` |
| `src/app/api/store-occurrences/[occurrenceId]/route.ts:43,77` | `loja.ocorrencias` OR `gestor-fabrica.ocorrencias` |
| `src/app/api/store-occurrences/[occurrenceId]/events/route.ts:28` | `loja.ocorrencias` OR `gestor-fabrica.ocorrencias` |
| `src/app/api/store-orders/aggregated-quantities/route.ts:10` | `loja.pedidos` OR `gestor-fabrica.pedidos` |

Lógica em `src/lib/authorization-decision.ts:64-76` (`canAccessAnyPermission` em `src/lib/permission-modules.ts:524-532`).
