# Stack e Arquitetura

## Stack

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework web | **Next.js 16** (App Router) | RSC ativo, route groups por persona |
| UI runtime | **React 19** | Server Components + Client Components |
| Tipagem | **TypeScript strict** | `strict: true` no `tsconfig.json` |
| Estilo | **Tailwind CSS 4** | + `shadcn/ui` (`components.json`) |
| Backend | **Supabase** | PostgreSQL + Auth + Storage |
| Auth/SSR | **@supabase/ssr** | Cookies para sessão server-side |
| Lint | **ESLint flat config** (`eslint.config.mjs`) | — |

## Estrutura de pastas

```
daniel-augusto-v2-new/
├── src/
│   ├── app/                       ← App Router
│   │   ├── login/                 ← entrada
│   │   ├── administrador-master/  ← persona SaaS
│   │   ├── administrador/         ← persona tenant admin
│   │   ├── gestor-dados/          ← persona dados mestres
│   │   ├── gestor-fabrica/        ← persona fábrica
│   │   ├── chao-fabrica/          ← persona execução
│   │   ├── loja/                  ← persona PDV
│   │   ├── (perfil-loja)/         ← route group: telas multi-persona
│   │   ├── (perfil-gestor-dados)/
│   │   ├── (perfil-gestor-fabrica)/
│   │   ├── impressao/             ← layouts de impressão (pré-pesagem, prod, exp, pedido)
│   │   └── api/                   ← rotas REST
│   ├── components/                ← UI compartilhada (shadcn + locais)
│   └── lib/
│       ├── factory-planning/      ← motor de cronograma (engine.ts)
│       ├── supabase-data/         ← acesso a dados
│       ├── api-auth.ts            ← authorizeApiRequest
│       └── permission-modules.ts  ← 27 módulos
├── supabase/
│   ├── migrations/                ← migrations SQL versionadas
│   ├── bootstrap.sql              ← seed inicial de schema (se aplicável)
│   ├── seed.sql                   ← seed de dados
│   └── types.ts                   ← types gerados (DB → TS)
├── middleware.ts                  ← Next middleware: auth + tenant
├── components.json                ← shadcn config
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── tailwind config (inline ou tailwind.config)
└── tsconfig.json
```

## Padrões

### Server-first
- **Server Components por padrão**. Componente vira `"use client"` apenas quando precisa de estado/efeito.
- **Server Actions** (provavelmente — confirmar com mapeamento) para mutações simples; **API routes** para fluxos com múltiplas operações ou validação centralizada.

### Acesso a dados
- Client → API route OU Server Action → `src/lib/supabase-data/` → Supabase.
- `src/lib/supabase-data/` é a camada que conhece o schema.
- Cliente nunca chama Supabase diretamente em operações sensíveis (auth + RLS na origem).

### Autorização
- Toda API route passa por `authorizeApiRequest` (ou similar) de `src/lib/api-auth.ts`.
- Resolve: usuário → persona → tenant → permissão por módulo.
- Ver [[Autorização de API]].

### Multi-tenant
- `tenant_id` em quase toda tabela.
- RLS no Postgres é a barreira final.
- Master usa cookie `da_master_tenant` para "visitar" tenants. Ver [[Multi-tenancy]].

### Route groups
- `(perfil-X)` agrupa telas compartilhadas entre personas (ex: Loja e Gestor de Fábrica veem a mesma tela de pedidos com permissões diferentes).
- O fato de existir uma pasta `loja/pedidos` e `(perfil-loja)/pedidos` é um padrão a investigar — pode indicar dupla rota ou layout compartilhado.
- > ⚠️ Verificar: por que existem `gestor-dados/produtos` e `(perfil-gestor-dados)/produtos`?

### Impressões
- `src/app/impressao/{pre-pesagem,producao,expedicao,pedido-loja}` — layouts otimizados para impressão (provavelmente A4 sem chrome do app).

## Build e dev

- `npm run dev` — Next dev server.
- > ⚠️ Confirmar scripts em `package.json` durante mapeamento.

## O que NÃO está na stack

- Sem testes automatizados visíveis (não há `__tests__`, `*.test.ts`, `vitest.config`).
- Sem CI configurado no repo.
- Sem Storybook.

> ⚠️ Esses gaps estão registrados em [[Dívida Técnica]].
