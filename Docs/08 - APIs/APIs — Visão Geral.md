# APIs — Visão Geral

> Todas as APIs vivem em `src/app/api/*` e passam por `authorizeApiRequest` (ver [[Autorização de API]]). Esta página é um mapa de superfície — para fluxo completo, ver [[Jornadas — Visão Geral]].

## Catálogo

### Autenticação (`/api/auth/`)
- `POST /api/auth/login` — login (proxy para Supabase Auth)
- `POST /api/auth/logout` — logout

### Identidade (`/api/me/`)
- `GET /api/me/profile` — dados do usuário logado

### Admin do tenant (`/api/admin/`)
Protegidas por `administrador.usuarios` / `administrador.ocorrencias`.

- `GET / POST /api/admin/users`
- `GET / PATCH / DELETE /api/admin/users/[userId]`
- `GET / POST /api/admin/support-occurrences` + sub-rotas

### Admin master (`/api/master/`)
Protegidas por `administrador-master.clientes`.

- `GET / POST /api/master/clients`
- `GET / PATCH /api/master/clients/[tenantId]`
- `GET /api/master/clients/[tenantId]/users`

### Master Data (`/api/master-data/`)
Protegidas por `gestor-dados.*`. Usadas pela persona [[Gestor de Dados]].

- `/api/master-data/ingredients` + `[ingredientId]`
- `/api/master-data/products` + `[productId]` + `clone` + `changelog`
- `/api/master-data/categories`
- `/api/master-data/subcategories`
- `/api/master-data/operational-products`
- `/api/master-data/schedules/[scheduleId]`
- `/api/master-data/line-types`
- `/api/master-data/stores` + `[storeId]` + `store-users`
- `/api/master-data/operational-settings`

### Planejamento de Fábrica (`/api/factory-planning/`)
Coração do motor. `anyOfPermissions` entre `gestor-fabrica` e `chao-fabrica`.

- `GET /api/factory-planning` — snapshot
- `GET / POST /api/factory-planning/workflow` — atualiza status de produção

### Pedidos (`/api/store-orders/`)
- `GET / POST /api/store-orders` — `loja.pedidos`
- `GET / PATCH /api/store-orders/[orderId]` — `loja.pedidos`
- `GET /api/store-orders/aggregated-quantities` — `anyOfPermissions: loja.pedidos | gestor-fabrica.pedidos`

### Catálogo para Pedido (`/api/store-order-catalog/`)
- `GET /api/store-order-catalog` — `loja.pedidos`, retorna catálogo filtrado por loja/dia

### Ocorrências (`/api/store-occurrences/`)
`anyOfPermissions: loja.ocorrencias | gestor-fabrica.ocorrencias`.

- `GET / POST /api/store-occurrences`
- `GET / PATCH /api/store-occurrences/[occurrenceId]`
- `GET / POST /api/store-occurrences/[occurrenceId]/events`

### Expedição/Entrega (`/api/delivery-executions/`)
`anyOfPermissions: gestor-fabrica.expedicao | chao-fabrica.expedicao`.

- `GET / PATCH /api/delivery-executions`

## Padrão de implementação

Toda rota segue o esqueleto:

```ts
export async function POST(req: NextRequest) {
  const access = await authorizeApiRequest({
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });
  if ("response" in access) return access.response;

  // handler usa access.effectiveTenantId, access.user, etc.
  const data = await req.json();
  // ... validação ...
  // ... mutação via src/lib/supabase-data/ ...
  // ... revalidate/cache ...

  return NextResponse.json({ ok: true });
}
```

Ver [[Autorização de API]] para o detalhe de cada flag.

## Para ir além

- Listagem completa por persona em [[Rotas por Persona#9. APIs]]
- Cross-persona via `anyOfPermissions` em [[Autorização de API#Cross-persona]]
- Fluxo de cada API dentro da jornada correspondente em [[Jornadas — Visão Geral]]

> ⚠️ A escrever: 1 página por endpoint quando a complexidade justificar (ex.: `/api/factory-planning` merece uma página dedicada).
