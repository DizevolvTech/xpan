# xpan — Handover técnico

> Daniel Augusto v2 · branch `develop` · HEAD `794c780` · gerado 2026-08-13  
> Espelho markdown de `Docs/HANDOVER.html`. Itens incertos: *a confirmar*.

## 1. Em uma frase

**xpan** (projeto *Daniel Augusto v2*) é um ERP SaaS multi-tenant para redes de padaria/confeitaria com **uma fábrica central + N lojas**: pedidos D+X, cronograma de produção, execução no chão, expedição/entrega e ocorrências — sem PDV fiscal nem financeiro.

## 2. Stack e estrutura do repo

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework | Next.js 16.1.6 (App Router) | RSC; route groups por persona |
| Runtime UI | React 19.2.3 | Server + Client Components |
| Tipagem | TypeScript | `strict` no tsconfig |
| Estilo | Tailwind CSS 4 + shadcn/ui | tokens OKLCH em `src/app/globals.css` |
| Fontes | Sora / Plus Jakarta Sans / JetBrains Mono | `src/app/layout.tsx` |
| Backend | Supabase (PostgreSQL + Auth + RLS) | `@supabase/ssr` |
| Package manager | npm (`package-lock.json`) | não é monorepo |
| Testes | `tsx --test` | 439 passando em 2026-08-13 |
| Node | v24.14.0 (máquina local) | `engines` *a confirmar* (não declarado) |
| CI | — | sem `.github/workflows` |

```
daniel-augusto-v2-new/
├── src/app/{login,administrador-master,administrador,
│            gestor-dados,gestor-fabrica,chao-fabrica,loja}/
├── src/app/(perfil-*)/          # telas multi-persona
├── src/app/impressao/
├── src/app/api/
├── src/lib/factory-planning/
├── src/lib/supabase-data/
├── supabase/migrations/         # 45 arquivos
├── netlify/functions/           # crons reais
├── Docs/                        # vault Obsidian
├── e2e/
├── vercel.json                  # crons LEGADOS (Netlify ignora)
└── middleware.ts
```

README raiz ainda é template create-next-app — **não** usar como guia.

## 3. Arquitetura runtime

```
  [Browser]
      │  Next App Router (Netlify)
      ▼
  middleware.ts ──► Auth cookie + tenant (master: da_master_tenant)
      │
      ├─ UI por persona
      ├─ API routes (authorizeApiRequest → supabase-data)
      └─ Cron HTTP /api/cron/{auto-release,divergence-alerts}
              ▲
              │ Bearer CRON_SECRET
   Netlify Scheduled Functions
              ▼
         Supabase (PG + Auth + RLS)
```

- **Deploy confirmado:** Netlify (changelog 2026-07-24).
- **Filas:** não há broker.
- **Storage:** Supabase Storage (logos etc.) — cobertura completa *a confirmar*.

## 4. Como rodar local + envs

```bash
cp .env.local.example .env.local
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm test
npm run lint
```

Scripts Supabase: `supabase:gen-types`, `supabase:seed:*`, `supabase:auth:bootstrap`, `supabase:master:bootstrap`, `supabase:remote:status`.

| Nome | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon |
| `CRON_SECRET` | Bearer para `/api/cron/*` e backfill; sem ela → **503** |
| `NEXT_PUBLIC_FACTORY_OPENS_ORDERS` | Modelo “fábrica abre pedido”. Código: default **ON** (`!== "false"`). Vault antigo ainda cita OFF — *a confirmar no ambiente* |
| `EXPAND_MPI_INTO_OPS` | Expansão MPI → OP |
| `EXPAND_MIXED_INGREDIENT_INTO_OPS` | Ingrediente misturado → OP |
| `SUPABASE_PROJECT_REF` | Geração de types |
| `URL` | Injetada pela Netlify nas Scheduled Functions |

Service role / secrets ficam só em `.env.local` (gitignored).

## 5. Domínio de produto

### Personas

| Persona | Papel | Área |
|---|---|---|
| Administrador Master | SaaS / tenants | `/administrador-master` |
| Administrador | Governança no tenant | `/administrador` |
| Gestor de Dados | Catálogo | `/gestor-dados` |
| Gestor de Fábrica | Pedidos, cronograma, OPs | `/gestor-fabrica` |
| Chão de Fábrica | Execução, expedição, entregas | `/chao-fabrica` |
| Loja | Pedido D+X + ocorrências (não é caixa) | `/loja` |

### Golden path

```
Loja pediu (D+X)
  → Cronograma / motor
  → Liberação (manual ou auto-release 18:00 BRT)
  → OP no chão
  → Expedição
  → Entrega
  ↔ Ocorrências
```

~26 módulos em `permission-modules.ts`. Níveis: `sem_acesso` → `visualizar` → `operar` → `gerenciar`.

## 6. Dados / domínio analítico crítico

- Motor: `src/lib/factory-planning/engine.ts`
- Snapshots de pedido/receita na liberação
- Códigos de negócio em BRT (`America/Sao_Paulo`)
- Receita por etapa; batida limitada pelo maior recipiente
- Métricas: lead time, OTIF, ocupação, falhas
- Dívida aberta relevante: D01 (RLS), D02 (leak labels), D03 (unique pedido)

## 7. Estado atual do trabalho

**Feito (recente):** checklist call 24/07, receita por etapa, sobras reais, crons Netlify, auto-release 18:00 BRT, folha OP, sequenciamento de preparo.

**WIP / branches:** `feat/cnpj-alfanumerico`; remotes `feat/pre-pesagem-extra`, `feat/trava-data-futura`.

**Bloqueio externo (2026-07-30):** `CRON_SECRET` no painel mas runtime 503 até Trigger deploy — **revalidar agora**.

| Item | Status |
|---|---|
| A1–A8 automação | ok |
| Crons Netlify @ 18:00 BRT | código ok |
| `CRON_SECRET` runtime prod | a confirmar |
| `FACTORY_OPENS_ORDERS` | código ON / docs OFF |
| CI / observabilidade | ausente |
| Dívida D01–D06 | aberta |

Últimos commits: `794c780` (PR #10 cron BRT) ← checklist ajustes ← folha OP ← receita por etapa ← porta crons Netlify.

## 8. Remotes e branches úteis

| Remote | URL |
|---|---|
| `origin` | `git@github.com:giuseppedangelis/daniel-augusto.git` |
| `dizevolv` | `git@github.com:DizevolvTech/daniel-augusto.git` |

- Branch atual: `develop` (up to date com `origin/develop`)
- Locais: `main`, `feat/cnpj-alfanumerico`, `feat/xpan-checklist-ajustes` (merged)
- Untracked: `repomix-2026-08-10.xml` (não é código de produto)

## 9. Ops / deploy / backup

- Host: **Netlify**. `netlify.toml` sem `[build]` de propósito.
- Crons: `cron-auto-release` `0 21 * * *` UTC (= 18:00 BRT); `cron-divergence-alerts` horário.
- Sonda: token inválido → 401 se secret ok; **503** se secret ausente.
- Runbook: `Docs/11 - Ajustes/Runbook A1-A8.md` (partes ainda citam Vercel 17:00 — preferir changelog jul/2026).
- Backups DB / staging vs prod: *a confirmar*.

## 10. Convenções para quem assume

- Vault `Docs/` = fonte de verdade; atualizar no mesmo PR; changelog mensal.
- PT-BR; datas absolutas; `arquivo:linha`; Mermaid.
- Server Components por padrão; API + `authorizeApiRequest`; RLS final.
- Fuso operacional: `America/Sao_Paulo`.
- Não alterar `FACTORY_OPENS_ORDERS` sem alinhar com cliente.
- Sem `CONVENTIONS.md` / `AGENTS.md` na raiz do produto.

## 11. Contatos / contexto de negócio

Nomes no vault: **Daniel, Adriano, Leonora**. Org: `DizevolvTech/daniel-augusto`.

### Credenciais de desenvolvimento (já no repo)

Fonte: `Docs/06 - Permissões e Segurança/Credenciais de Desenvolvimento.md` — **só local**.

| Persona | Email | Senha |
|---|---|---|
| Master | `master@danielaugusto.com` | `Master@123` |
| Admin | `admin@danielaugusto.com` | `Admin@123` |
| Gestor Dados | `engenharia@danielaugusto.com` | `Engenharia@123` |
| Gestor Fábrica | `fabrica@danielaugusto.com` | `Fabrica@123` |
| Chão | `chao@danielaugusto.com` | `Chao@123` |
| Loja | `loja@danielaugusto.com` | `Loja@123` |

Bootstrap: `npm run supabase:auth:bootstrap` (só `loja@` costuma vir seeded).

## 12. Checklist do próximo engineer

- [ ] `npm install` + `.env.local` + `npm run dev`; login loja + gestor
- [ ] Ler Visão Geral + Stack + jornadas (`Docs/01`, `Docs/04`)
- [ ] Netlify: `CRON_SECRET` + sonda cron → **401** (não 503)
- [ ] Confirmar `NEXT_PUBLIC_FACTORY_OPENS_ORDERS` em prod
- [ ] `npm test` (baseline ~439) e olhar `engine.test.ts`
- [ ] Priorizar D01–D03 com o time
- [ ] Runbook A1-A8 + ADR automação antes de mexer em liberação
- [ ] Mapear `feat/pre-pesagem-extra` e `feat/trava-data-futura`
- [ ] Atualizar vault/changelog no mesmo PR

## 13. Índice de docs críticos

| Doc | Por quê |
|---|---|
| `Docs/README.md` | Map of Content |
| `Docs/01 - Visão do Sistema/*` | Produto, stack, multi-tenancy |
| `Docs/02 - Personas/*` | Roles e rotas |
| `Docs/04 - Jornadas End-to-End/*` | Golden path |
| `Docs/05 - Regras de Negócio/*` | D+X, lead, drift, receita |
| `Docs/06 - Permissões e Segurança/*` | Auth, API, RLS, credenciais |
| `Docs/07 - Banco de Dados/*` | Schema, migrations |
| `Docs/09 - Engine de Cronograma/*` | Motor |
| `Docs/10 - Changelog Vivo/2026-07.md` | Ops recente |
| `Docs/11 - Ajustes/Runbook A1-A8.md` | Operação automação |
| `Docs/decisoes/ADR_*.md` | Decisões |
| `Docs/99 - Auditoria/*` | Saúde, dívida, riscos |
| `.env.local.example` | Envs mínimas |
| `netlify.toml` + `netlify/functions/` | Crons reais |
