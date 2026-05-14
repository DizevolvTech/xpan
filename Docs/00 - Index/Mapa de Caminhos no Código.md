# Mapa de Caminhos no Código

> "Onde fica X no código?" — resposta rápida para navegação. Sempre `caminho/arquivo.ext:linha` quando possível.
>
> Esta página é alimentada pelos mapeamentos profundos (`02-modulos-catalogo`, `04-autorizacao`, `20-engine-overview` etc.) e refinada conforme o cofre evolui.

## Auth e Multi-tenant

| Assunto | Local |
|---|---|
| Middleware (auth + tenant) | `middleware.ts` |
| Autorização de API | `src/lib/api-auth.ts` |
| Cookie de tenant master | `middleware.ts` (procurar `da_master_tenant`) |
| Cliente Supabase server | `src/lib/supabase-data/` (cliente SSR) |

## Permissões

| Assunto | Local |
|---|---|
| Catálogo de 27 módulos | `src/lib/permission-modules.ts` |
| Níveis de permissão | `src/lib/permission-modules.ts` (enum) |
| Verificação por API | `src/lib/api-auth.ts` |

## Motor e Regras

| Assunto | Local |
|---|---|
| Motor de cronograma | `src/lib/factory-planning/engine.ts` |
| Helpers de cronograma | `src/lib/factory-planning/*.ts` |
| Cálculo D+2/D+3 | `src/lib/factory-planning/engine.ts` *(linha a confirmar)* |
| Lead days | `operational_settings.sale_lead_days` + `products.expedition_lead_days` |
| Drift retroativo | `product_changelog` + `production_line_types` |

## App Router

| Persona | Raiz no app |
|---|---|
| Administrador Master | `src/app/administrador-master/` |
| Administrador | `src/app/administrador/` |
| Gestor de Dados | `src/app/gestor-dados/` + `src/app/(perfil-gestor-dados)/` |
| Gestor de Fábrica | `src/app/gestor-fabrica/` + `src/app/(perfil-gestor-fabrica)/` |
| Chão de Fábrica | `src/app/chao-fabrica/` |
| Loja | `src/app/loja/` + `src/app/(perfil-loja)/` |
| Impressões | `src/app/impressao/` |
| API | `src/app/api/` |
| Login | `src/app/login/` |

## API

| Endpoint | Caminho |
|---|---|
| `/api/factory-planning` | `src/app/api/factory-planning/` |
| `/api/store-orders` | `src/app/api/store-orders/` |
| `/api/store-order-catalog` | `src/app/api/store-order-catalog/` |
| `/api/store-occurrences` | `src/app/api/store-occurrences/` |
| `/api/delivery-executions` | `src/app/api/delivery-executions/` |
| `/api/admin` | `src/app/api/admin/` |
| `/api/master` | `src/app/api/master/` |
| `/api/master-data` | `src/app/api/master-data/` |
| `/api/me` | `src/app/api/me/` |
| `/api/auth` | `src/app/api/auth/` |

## Banco

| Assunto | Local |
|---|---|
| Migrations | `supabase/migrations/*.sql` |
| Bootstrap | `supabase/bootstrap.sql` |
| Seed | `supabase/seed.sql` |
| Types gerados | `supabase/types.ts` |

## Como atualizar este mapa

Quando criar arquivo novo importante ou mover algo, atualize aqui. Linhas (`:42`) tendem a desatualizar — preferir nome de função ou marcador único quando linha for instável.
