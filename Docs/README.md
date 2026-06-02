# Xpan — Cofre de Conhecimento

> **Daniel Augusto v2** — ERP SaaS multi-tenant para padaria/confeitaria.
> Stack: Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui + Supabase (Postgres + Auth + RLS).
> Vault vive dentro do repo em `Docs/` — versionado junto ao código. Abrir Obsidian apontando para esta pasta.

Este cofre é a **fonte única de verdade** sobre o Xpan. Quando algo no código mudar, a página correspondente aqui também muda. Quando você for ajustar algo, abra primeiro a página da regra de negócio para não perder o contexto.

---

## Como navegar

- **Não sabe por onde começar?** → [[Visão Geral]] · [[Saúde do Sistema]]
- **Vai mexer numa tela?** → identifique a [[Personas — Visão Geral|persona]] → o [[Catálogo dos 27 Módulos|módulo]] → a [[Jornadas — Visão Geral|jornada]]
- **Vai mexer numa regra?** → [[Regras — Visão Geral]] (D+2/D+3, lead days, drift, lote mínimo, domingo)
- **Vai mexer no banco?** → [[Banco — Visão Geral]] (schema, RLS, migrations)
- **Algo escapou de novo?** → registre em [[10 - Changelog Vivo/2026-05|Changelog 2026-05]]

---

## Map of Content

### 00 — Index
- [[Map of Content]] — índice mestre de tudo
- [[Glossário]] — D+X, snapshot, OP, drift, lote mínimo, ...
- [[Mapa de Caminhos no Código]] — `arquivo:linha` por assunto

### 01 — Visão do Sistema
- [[Visão Geral]] — o que é o Xpan, para quem
- [[Stack e Arquitetura]] — bibliotecas, pastas, padrões
- [[Multi-tenancy]] — `tenant_id`, cookie `da_master_tenant`, isolamento

### 02 — Personas
- [[Personas — Visão Geral]] — as 6 personas comparadas
- [[Administrador Master]] · [[Administrador]] · [[Gestor de Dados]] · [[Gestor de Fábrica]] · [[Chão de Fábrica]] · [[Loja]]
- [[Matriz Persona × Módulo]] — quem vê o quê, em que nível

### 03 — Módulos (27)
- [[Catálogo dos 27 Módulos]] — tabela mestre
- 1 página por módulo (criadas conforme cada módulo é tocado)

### 04 — Jornadas End-to-End
- [[Jornadas — Visão Geral]]
- [[Jornada — Pedido da Loja]] · [[Jornada — Cronograma da Semana]] · [[Jornada — Produção do Dia]]
- [[Jornada — Expedição e Entrega]] · [[Jornada — Ocorrências]] · [[Jornada — Onboarding de Tenant]]
- [[Integrações entre Jornadas]] — handoffs e contratos

### 05 — Regras de Negócio
- [[Regras — Visão Geral]]
- [[Regra — D+2 e D+3]] · [[Regra — Lead Days]] · [[Regra — Drift Retroativo]]
- [[Regra — Lote Mínimo e Múltiplos]] · [[Regra — Disponibilidade de Produto]]
- [[Regra — Domingo e Feriados]] · [[Regra — Drop antes e depois do forno]]
- [[Regra — Pedido da Loja]] (duplicidade, edição, agregação)

### 06 — Permissões e Segurança
- [[Modelo 4 Níveis × 27 Módulos]] — `sem_acesso` → `visualizar` → `operar` → `gerenciar`
- [[Autenticação e Sessão]] — login, middleware, cookie de tenant
- [[Autorização de API]] — `authorizeApiRequest`, contratos
- [[RLS Policies]] — políticas por tabela
- [[Riscos de Segurança]]
- [[Credenciais de Desenvolvimento]] — logins das 6 personas (dev local)

### 07 — Banco de Dados
- [[Banco — Visão Geral]]
- [[Schema ER (Mermaid)]] · [[Catálogo de Tabelas]] · [[ENUMs]]
- [[Funções e Triggers]] · [[Migrations (cronologia)]]

### 08 — APIs
- [[APIs — Visão Geral]] — rotas em `src/app/api/*`

### 09 — Engine de Cronograma
- [[Engine — Visão Geral]] (`src/lib/factory-planning/engine.ts`)
- [[Engine — Disponibilidade]] · [[Engine — Snapshot]] · [[Engine — Drift]]

### 10 — Changelog Vivo
- [[10 - Changelog Vivo/2026-05|2026-05]] — mês corrente
- [[Template — Entrada de Changelog]]

### 11 — Ajustes
- [[Backlog de Ajustes]] — lista numerada com status
- [[Runbook A1-A8]] — operação do fluxo automatizado (cron, override, falhas, métricas, rotas)
- [[Call 2026-05-13 — Daniel + Adriano + Leonora]] — registro da call
- [[Call 2026-05-13 — Plano de Ataque]] — 4 ondas de execução

### Decisões (ADR)
- [[decisoes/ADR_iniciativa_automacao_pedido_entrega]] — automação fim a fim do fluxo pedido → entrega (A1-A8 · 2026-05-21)
- [[decisoes/ADR_expansao_mpi_em_op]] — MPI/produto-MPI gera OP separada (AJ-0008 · fase 1 + fase 2)
- [[decisoes/ADR_modelo_fabrica_abre_pedido]] — modelo "fábrica abre pedido" (AJ-0009 · Aceito 2026-05-30, **parqueado** atrás da flag `NEXT_PUBLIC_FACTORY_OPENS_ORDERS` OFF — a loja cria)
- [[decisoes/ADR_navegacao_orientada_por_permissoes]] — navegação derivada das permissões (legado pré-vault, conteúdo absorvido)

### 99 — Auditoria
- [[Saúde do Sistema]] — semáforo geral
- [[Dívida Técnica]] — backlog vivo
- [[Riscos de Segurança]]

### Material pré-vault (legado)
Mantidos por valor histórico — conteúdo já absorvido no vault.
- [decisoes/ADR_navegacao_orientada_por_permissoes.md](decisoes/ADR_navegacao_orientada_por_permissoes.md) — ADR coberto em [[Autenticação e Sessão]] e [[Autorização de API]]
- [regras-de-negocio/Regras_Pedido_Loja_DMaisX.md](regras-de-negocio/Regras_Pedido_Loja_DMaisX.md) — spec absorvida em [[Regra — D+2 e D+3]], [[Regra — Lead Days]] e [[Regra — Pedido da Loja]]

---

## Convenções deste cofre

- **PT-BR** em todo conteúdo.
- **Datas absolutas** sempre (ex: `2026-05-13`, nunca "ontem").
- **Caminhos de código** em `arquivo:linha` (ex: `src/lib/factory-planning/engine.ts:142`).
- **Diagramas** em Mermaid.
- **Wikilinks** `[[Nome]]` para navegação. Links quebrados (vermelhos) marcam coisas a escrever.
- **Atualização**: ao tocar uma área do código, atualize a página correspondente **no mesmo PR/commit**. Registre a mudança em [[10 - Changelog Vivo/2026-05|Changelog]].
- **Alertas**: regras frágeis levam `> ⚠️ Frágil:` ou `> ⚠️ Implícito:` no corpo.

## Workflow ao fazer um ajuste

1. Abrir página da regra/jornada/módulo afetado → ler antes de tocar.
2. Fazer o ajuste no código.
3. Atualizar página(s) tocadas com `arquivo:linha` novo.
4. Adicionar entrada em [[10 - Changelog Vivo/2026-05|Changelog do mês]].
5. Se descobriu regra escondida no caminho, anotar em [[Dívida Técnica]] ou criar página em `05 - Regras`.

## Por que o vault vive em `Docs/`

- **Versionado com o código** — `git log Docs/` rastreia evolução da documentação. PR pode mudar código + doc no mesmo commit.
- **`arquivo:linha` continua válido** entre branches/checkouts.
- **Sem sincronização manual** entre máquinas — `git pull` traz código e doc juntos.

### Ressalva sobre Obsidian
- `.obsidian/` é versionado (settings úteis do vault).
- Plugins que escrevem em `.obsidian/workspace.json` a cada sessão geram ruído em `git status`. Se virar problema, considerar:
  ```gitignore
  Docs/.obsidian/workspace.json
  Docs/.obsidian/cache
  ```
