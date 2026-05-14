# Modelo 4 Níveis × 24 Módulos

> ⚠️ O título histórico fala em "27 módulos" mas a contagem real do array `permissionModules` em `src/lib/permission-modules.ts:171-425` é **24 entradas**. A diferença pode ser cadastro de `/perfil` por persona não-master ou refatoração inacabada. Ver [[Catálogo dos 27 Módulos|Catálogo de Módulos]] (mantém o nome histórico para SEO/familiaridade).

## Os 4 níveis de permissão

Enum `permission_level` em `src/lib/permission-modules.ts:164-169`:

| Rank | Slug | O que faz |
|---|---|---|
| 0 | `sem_acesso` | Não vê na navegação. APIs respondem 403. |
| 1 | `visualizar` | Pode ler (GET). |
| 2 | `operar` | Pode mudar status, executar (PATCH/POST com lifecycle). |
| 3 | `gerenciar` | Pode criar/editar/excluir (CRUD completo). |

**Hierarquia monotônica**: `gerenciar > operar > visualizar > sem_acesso`. Quem tem nível N tem implicitamente todos os abaixo.

## Os 24 módulos por grupo

| Grupo | Quantidade | Módulos |
|---|---|---|
| `administrador-master` | 2 | `dashboard`, `clientes` |
| `administrador` | 3 | `dashboard`, `usuarios`, `ocorrencias` |
| `gestor-dados` | 6 | `dashboard`, `ingredientes`, `produtos`, `setores` (label "Categorias"), `linhas`, `lojas` |
| `gestor-fabrica` | 6 | `dashboard`, `sublinhas`, `pedidos`, `ops`, `expedicao`, `ocorrencias` |
| `chao-fabrica` | 4 | `dashboard`, `ops`, `expedicao`, `entregas` |
| `loja` | 3 | `dashboard`, `pedidos`, `ocorrencias` |
| **Total** | **24** | |

Ver [[Catálogo dos 27 Módulos]] para detalhe de cada um (rotas, APIs, tabelas).

## Defaults por persona

Vem de `buildDefaultPermissions` em `src/lib/permission-modules.ts:449-481`:

| Persona | Default nos módulos próprios | Outros módulos |
|---|---|---|
| `administrador-master` | `gerenciar` em `administrador-master.*` | `sem_acesso` (exceto em modo `read-only-tenant`) |
| `administrador` | `gerenciar` em tudo não-master | `sem_acesso` em `administrador-master.*` |
| `gestor-dados` | `gerenciar` em `gestor-dados.*` | `sem_acesso` |
| `gestor-fabrica` | `gerenciar` em `gestor-fabrica.*` | `visualizar` em `chao-fabrica.*` · `sem_acesso` no resto |
| `chao-fabrica` | `operar` em `chao-fabrica.*` | `sem_acesso` |
| `loja` | `operar` em `loja.*` | `sem_acesso` + filtro extra por `storeIds` |

Ver [[Matriz Persona × Módulo]] para a tabela completa 24×6.

## Como permissões são determinadas

1. **Default**: persona → `buildDefaultPermissions` → mapa inicial.
2. **Override**: admin do tenant pode customizar em `/administrador/usuarios`. Persistido em `public.user_permissions`.
3. **Saneamento**: `sanitizePermissionsForRole` (`src/lib/permission-modules.ts:493-507`) zera permissões fora do `roleAllowedGroups` da persona-alvo — mesmo que o admin tente conceder.
4. **Carregamento por sessão**: `findManagedUserByAuthUserId` carrega `permissions` direto de `user_permissions`.

## Avaliação em runtime

```ts
hasPermissionAtLevel(map, moduleId, minimumLevel)
  // true se permissionRank(map[moduleId]) >= permissionRank(minimumLevel)
```

Implementado em `src/lib/permission-modules.ts` (`canAccessPermission`, `canAccessAnyPermission`). Usado por `authorizeApiRequest` (ver [[Autorização de API]]) e por `AreaShellLayout` (ver [[Autenticação e Sessão]]).

## Caso especial — `administrador-master` em `read-only-tenant`

Quando master seleciona cliente via cookie `da_master_tenant`:

- `buildMasterTenantReadOnlyPermissions` (`src/lib/master-access-context.ts:18-28`) substitui `sem_acesso` por `gerenciar` em **todos os módulos não-master**.
- `canWriteInAccessMode` (`src/lib/tenant.ts:21-23`) bloqueia escrita: APIs com `requireWritableTenant: true` retornam 403.
- **Defesa em camadas**: `api-permission-context.ts:22-42` e `app-shell.ts:38-41` garantem que master ainda tem acesso às suas APIs próprias (módulos do grupo `administrador-master`).

> ⚠️ Implícito: quando você ver "tem acesso mas não pode escrever", verifique se a persona é `administrador-master` em modo cliente. Ver [[Administrador Master]].

## Pontos de atenção

- **Permission UI ≠ permission API**: validar sempre no servidor. Esconder botão não é segurança. Ver [[Riscos de Segurança#R2.2]].
- **Mudar default**: requer reflexão. Usuários existentes mantêm permissions persistidas; apenas usuários novos pegam o default novo.
- **`sanitizePermissionsForRole`** é a única defesa contra concessão fora do grupo permitido — não tirar.

## Links

- [[Catálogo dos 27 Módulos]] — detalhe por módulo
- [[Matriz Persona × Módulo]] — tabela completa
- [[Autorização de API]] — como APIs avaliam
- [[Autenticação e Sessão]] — como Layout avalia
- [[RLS Policies]] — defesa final no banco
