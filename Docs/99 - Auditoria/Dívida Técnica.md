# Dívida Técnica

> Backlog vivo. Severidade: 🔴 alta · 🟡 média · 🟢 baixa. Ao resolver, mover para "Histórico de resoluções".
>
> **Consolidado em 2026-05-13** a partir do mapeamento profundo dos 4 agentes.

---

## 🔴 Alta

### [ ] D01 — `production_line_types` e `product_changelog` sem filtro de role no RLS
RLS é `for all using(tenant_id=current_tenant_id())` — **sem filtro de role**. Qualquer authenticated do tenant pode CRUD livre. `supabase/migrations/20260505210000_xpan_register_drift_tables.sql:32-38,85-91`.

**Risco:** loja ou chão-fábrica podem mutar catálogo de linhas e poluir changelog. Auditoria forjada.

**Onde dói:** [[RLS Policies#production_line_types]], [[Riscos de Segurança#R1.1]].

---

### [ ] D02 — `list_profile_labels()` cross-tenant leak
Função `security definer` sem filtro de tenant em `supabase/migrations/20260309193000_profile_public_labels.sql:1-12`. Lista nomes de perfis de **qualquer** tenant.

**Risco:** PII (nomes de funcionários) vaza entre clientes. Possível incidente LGPD.

**Onde dói:** [[Funções e Triggers]], [[Riscos de Segurança]].

**Mitigação:** adicionar `where tenant_id = current_tenant_id()`.

---

### [ ] D03 — Duplicidade de pedido sem `UNIQUE` no banco
Check de duplicidade só em código (`src/lib/supabase-data/store-orders.ts:365`). Sem `UNIQUE (tenant_id, store_id, delivery_date)` na tabela.

**Risco:** clique duplo ou race condition cria pedido duplicado → fábrica produz dobrado.

**Onde dói:** [[Regra — Pedido da Loja]], [[Jornada — Pedido da Loja]].

**Mitigação:** criar migration com unique index parcial (`management_status='ativo'`).

---

### [ ] D04 — Chão pode mexer em produção de pedido cancelado
`updateProductionItemStatus` valida ±1 estágio mas **não exige** `workflow_order_releases` para o pedido. `src/lib/factory-planning/workflow.ts`.

**Risco:** operador avança produção de pedido já cancelado — desperdício real.

**Onde dói:** [[Jornada — Produção do Dia]], [[Integrações entre Jornadas]] (handoff #3).

---

### [ ] D05 — Engine → `aguardando_expedicao` derivado, não persistido
Promoção do pedido para "aguardando expedição" é calculada em runtime (`src/lib/factory-planning/engine.ts:740-747`), nunca persistida em `store_orders`. Loja **não recebe evento** quando a produção fecha.

**Risco:** loja consulta status e vê inconsistência; sem audit trail desse momento crucial.

**Onde dói:** [[Integrações entre Jornadas]] (handoff #4), [[Jornada — Pedido da Loja]].

---

### [ ] D06 — Sem testes automatizados
Nenhum `*.test.ts`, `vitest.config`, `jest.config`. Motor de cronograma é o ponto mais crítico — qualquer regressão em D+2/D+3, lead days ou drift escapa silenciosamente.

**Onde dói:** [[Engine — Visão Geral]], [[Regra — D+2 e D+3]], [[Regra — Lead Days]].

**Mitigação proposta:** testes de unidade do motor com snapshots determinísticos.

---

## 🟡 Média

### [ ] D07 — `productionItemKey` compartilhado entre pedidos
`workflow.ts:86-106` — fan-out implícito: avançar status afeta N pedidos sem possibilidade de desagregar.

**Onde dói:** [[Integrações entre Jornadas]] (handoff #3), [[Jornada — Produção do Dia]].

---

### [ ] D08 — `normalizeSaleLeadDays` força mínimo 1 mesmo quando tenant cadastra 0
`src/lib/factory-planning/engine.ts:188`. Tenant configura 0 em `operational_settings.sale_lead_days`, motor ignora e usa 1.

**Onde dói:** [[Regra — Lead Days]].

**Mitigação:** ou respeitar 0, ou bloquear configuração de 0 no UI com mensagem clara.

---

### [ ] D09 — Lote mínimo só validado por `window.confirm`
`src/app/loja/pedidos/page.tsx:633` — validação só no front. API aceita qualquer quantidade.

**Risco:** bypass via fetch direto. Frente de loja resolve, mas API deve validar também.

**Onde dói:** [[Regra — Lote Mínimo e Múltiplos]], [[Riscos de Segurança#R2.2]].

---

### [ ] D10 — `breakPercent` ignorado pelo motor
`src/lib/factory-planning/engine.ts:542` — motor calcula capacidade nominal sem descontar `breakPercent`. Produção real ≠ capacidade planejada.

**Onde dói:** [[Regra — Drop antes e depois do forno]], [[Engine — Visão Geral]].

---

### [ ] D11 — Código `OP-YYMMDD-NNN` re-gerado a cada execução
`src/lib/factory-planning/engine.ts:736` — código da OP não é estável entre runs do motor. Impressões anteriores ficam dessincronizadas.

**Onde dói:** [[Jornada — Produção do Dia]], impressões em `/impressao/producao`.

---

### [ ] D12 — Auditoria sistemática de RLS
RLS é barreira final. Tabelas novas precisam ter políticas revisadas. Checklist após cada migration que cria tabela.

**Onde dói:** [[RLS Policies]], [[Multi-tenancy]].

---

### [ ] D13 — Lead days — três fontes potencialmente conflitantes
`operational_settings.sale_lead_days` (global), `products.sale_lead_days` (produto), `products.expedition_lead_days` (produto), `store_orders.expedition_lead_days_snapshot` (snapshot). Precedência implícita.

**Onde dói:** [[Regra — Lead Days]].

---

### [ ] D14 — Reconstrução de cronograma deleta pendentes sem aviso
`src/lib/supabase-data/master-data-admin.ts:946` — sem confirmação.

**Onde dói:** [[Jornada — Cronograma da Semana]], [[Engine — Visão Geral]].

---

### [ ] D15 — Checklist de expedição depende de `expedition_unit` estável
`src/lib/factory-planning/delivery.ts:93-107` — mudar unidade do produto invalida `checklistState` antigo; pedido trava em `aguardando_expedicao` sem mensagem clara.

**Onde dói:** [[Jornada — Expedição e Entrega]], [[Integrações entre Jornadas]] (handoff #5).

---

### [ ] D16 — Status visto pela loja com cache de 10s + composição
`resolveStoreVisibleOrderStatus` combina `orderStatus` + `executionStatus` com cache de 10s entre nós — loja pode ver "em rota" antes da produção tecnicamente fechar.

**Onde dói:** [[Integrações entre Jornadas]] (handoff #5).

---

### [ ] D17 — `/impressao` fora de `appAreaPath`
Acesso anônimo teoricamente possível: 4 páginas (`pre-pesagem`, `producao`, `expedicao`, `pedido-loja`) não disparam `isProtectedAppPath`. Depende de guarda individual nos `page.tsx`. Auditar.

**Onde dói:** [[Autenticação e Sessão]], [[Riscos de Segurança#R2.1]].

---

### [ ] D18 — `moveToNextAllowedWeekday` fail-open com `allowedDays=[]`
`src/lib/factory-planning/engine.ts:131` — pode entrar em loop ou retornar valor inesperado.

**Onde dói:** [[Regra — Disponibilidade de Produto]].

---

### [ ] D19 — `chao-fabrica.entregas` sem `matchSubRoutes`
Único módulo do grupo sem o flag. Se ganhar sub-rotas, matching falha silenciosamente.

**Onde dói:** [[Catálogo dos 27 Módulos#chao-fabrica.entregas]].

---

### [ ] D20 — `product_changelog.snapshot_data` só guarda `name+description`
`src/lib/supabase-data/master-data-admin.ts:1216` — changelog é pobre; outros campos não rastreados.

**Once dói:** [[Regra — Drift Retroativo]], [[Catálogo de Tabelas#product_changelog]].

---

### [ ] D21 — `sale_lead_days` não é snapshotado no pedido
`expedition_lead_days_snapshot` existe; `sale_lead_days_snapshot` não. Mudança em `operational_settings.sale_lead_days` afeta cálculos sobre pedidos antigos? `src/lib/supabase-data/store-orders.ts:393`.

**Onde dói:** [[Regra — Lead Days]].

---

### [ ] D22 — `updated_at` sem trigger em 2 tabelas
`delivery_executions.updated_at` e `workflow_production_items.updated_at` dependem do app gravar. Esquecer = timestamp obsoleto sem aviso.

**Onde dói:** [[Funções e Triggers]].

---

### [ ] D23 — Sem observabilidade
Sem logs estruturados, sem APM, sem alertas. Bugs em produção descobertos por usuário.

---

### [ ] D24 — `tenants_select_master_only` esconde nome da própria padaria
Gestor/admin do tenant **não** vê a própria linha em `tenants`. Banner/header com nome da padaria precisa vir de outra fonte.

**Onde dói:** [[RLS Policies#tenants]].

---

### [ ] D25 — Rotas duplicadas `(perfil-X)/` vs `{persona}/`
Route groups `(perfil-loja)`, `(perfil-gestor-dados)`, `(perfil-gestor-fabrica)` existem com subpastas mas **sem `page.tsx`**. Refatoração inacabada.

**Onde dói:** [[Rotas por Persona#8. Route groups vazios]].

**Mitigação:** decidir (a) preencher e migrar, ou (b) deletar pastas.

---

### [ ] D26 — Vestígio "setores" vs "Categorias"
Slug/rota é `setores`, label é "Categorias". `src/lib/permission-modules.ts:255-265`.

**Onde dói:** [[Catálogo dos 27 Módulos#gestor-dados.setores]].

---

## 🟢 Baixa

### [ ] D27 — Sem Storybook
UI cresce com componentes shadcn customizados. Storybook acelera revisão.

### [ ] D28 — Sem CI
Build e lint não rodam automaticamente em PR.

### [ ] D29 — `permissionModules` declara 24 entradas, não 27
Documentação histórica fala em 27, código tem 24. Reconciliar narrativa.

**Onde dói:** [[Catálogo dos 27 Módulos]] (nome do arquivo é histórico).

---

## Histórico de resoluções

- **2026-05-05** — Lead days, drift e drop antes/depois forno modelados em 4 migrations (`e552f46`).
- **2026-04** — Refino de expedição (KG, marcar tudo, motor).

---

## Como adicionar item

```markdown
### [ ] D## — <título curto>
<descrição em 2-4 linhas>

**Onde dói:** [[Página]]

**Mitigação proposta:** ...
```

Severidade: alta = quebra produção / risco de segurança / regulatório · média = atrito persistente · baixa = nice-to-have.
