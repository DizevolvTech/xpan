# Multi-tenancy

## Modelo

O Xpan é **multi-tenant por linha** (single-database, single-schema, com `tenant_id` em cada tabela tenant-scoped). Isolamento garantido por **RLS** do Postgres, não pela aplicação.

## Tenant ativo na sessão

A sessão do usuário define **um e apenas um tenant** ativo:

- **Personas não-master** (`administrador`, `gestor-dados`, `gestor-fabrica`, `chao-fabrica`, `loja`): o tenant é derivado do `profiles.tenant_id` do usuário. Não pode trocar.
- **Persona `administrador-master`**: pertence a um tenant "raiz" do SaaS, mas pode **assumir leitura de outro tenant** via cookie `da_master_tenant`. Escrita é restrita ao tenant raiz (gerencia tenants e usuários master). Ver [[Administrador Master]].

> ⚠️ Implícito: a aplicação precisa setar contexto Postgres por requisição para que RLS funcione. O detalhe está em [[Autorização de API]] e [[RLS Policies]] (preenchido pelos agentes de mapeamento).

## Tabelas

### Tenant-scoped (têm `tenant_id`)

Praticamente tudo exceto plataforma:
- `profiles`, `stores`, `categories`, `subcategories`, `products`, `ingredients`
- `schedule_lines`, `schedule_line_item_snapshots`
- `store_orders`, `store_order_items`
- `workflow_production_items`, `workflow_order_releases`, `delivery_executions`
- `store_occurrences`
- `permission_modules`, `user_permissions`
- `operational_settings`
- `product_changelog`, `production_line_types`

### Plataforma (sem `tenant_id`, gerida por master)

- `tenants` — lista de clientes do SaaS
- `tenant_support_occurrences` — ocorrências do SaaS sobre o tenant
- (eventuais) tabelas auxiliares de admin master

Ver [[Catálogo de Tabelas]] para detalhe completo.

## Risco de vazamento

| Vetor | Mitigação |
|---|---|
| Query sem filtro `tenant_id` | RLS bloqueia se contexto setado |
| Contexto Postgres não setado | Master vê tudo (read-only). Outras personas: bloqueio total |
| Cookie `da_master_tenant` adulterado | Cookie deve ser httpOnly + signed; persona `administrador-master` exigida no JWT |
| FK cruza tenants | Garantir checks: produto X de tenant A não pode aparecer em pedido de tenant B |

> ⚠️ Validar: ver [[Riscos de Segurança]] após mapeamento.

## Onboarding de novo tenant

Ver [[Jornada — Onboarding de Tenant]].

## Decisões e trade-offs

- **Single-DB**: simples, barato, mas qualquer bug em RLS = vazamento. Reforçar testes.
- **Master read-only sobre dados de tenants**: master nunca escreve em `products`, `orders`, etc. Limita poder mas reduz blast radius.
- **Cookie de tenant para master**: alternativa seria um seletor explícito em todas as requisições. Cookie é mais limpo no UI mas requer atenção em CSRF.
