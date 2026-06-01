# Produção por batidas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular automaticamente em quantas "batidas" uma linha precisa produzir um produto (capacidade por batida) e gerir a execução uma de cada vez no chão.

**Architecture:** Capacidade por batida é um campo opcional do produto (na unidade de venda). O *plano* de batidas é derivado no motor a partir do `totalKg` consolidado da OP + capacidade (não armazenado). O *rastreamento* é um contador de batidas concluídas por produto (`workflow_production_batches`), no mesmo padrão de `workflow_production_starts`. Para produto batido, o status/coluna do board é **derivado** do contador (0=não iniciado, parcial=produção, completo=expedição). Controle uma-a-uma na pré-pesagem.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres + RLS multi-tenant), TypeScript, testes com `tsx --test` (node:test). Spec: `Docs/superpowers/specs/2026-06-01-producao-por-batidas-design.md`.

**Convenções do repo (importante):**
- Testes rodam com `npm test` (`tsx --test "src/**/*.test.ts"`). Typecheck: `npx tsc --noEmit -p tsconfig.json`. Lint: `npx eslint <arquivos>`.
- Cliente Supabase é **não tipado** (`createClient` sem `<Database>`), então `.from("nova_tabela")` compila sem regenerar tipos.
- Wrapper `createTenantScopedSupabaseClient` injeta `tenant_id` em payload + `onConflict`.
- Mensagens de commit: conventional, **sem acentos no subject** (≤50 bytes), **sem co-autoria de IA** (hook bloqueia). Corpo ≤72 col.
- Branch atual: `feat/producao-por-batidas`.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `supabase/migrations/<ts>_workflow_production_batches.sql` | Coluna `capacity_per_batch` em `products` + tabela `workflow_production_batches` | Criar |
| `src/lib/production-batches.ts` | Helper puro `planBatches()` (cálculo do plano) | Criar |
| `src/lib/production-batches.test.ts` | Testes do helper | Criar |
| `src/lib/production-planning.ts` | `capacityPerBatch` em `ProductionProduct` | Modificar |
| `src/lib/supabase-data/master-data.ts` | Mapear `capacity_per_batch` → `capacityPerBatch` | Modificar |
| `src/lib/supabase-data/master-data-admin.ts` | Persistir `capacity_per_batch` (normalize + diff) | Modificar |
| `src/lib/factory-planning/types.ts` | Campos de batida em `PlannedOrderItem` e `ProductionOrderItem` | Modificar |
| `src/lib/factory-planning/engine.ts` | Carregar capacidade no item planejado; calcular plano + status/progresso efetivo por batida | Modificar |
| `src/lib/factory-planning/recipe-expansion.ts` | Propagar campos de batida em itens expandidos (MPI) | Modificar |
| `src/lib/factory-workflow-logic.ts` | Aplicar `batchesDone` ao item | Modificar |
| `src/lib/supabase-data/workflow.ts` | Ler `workflow_production_batches`; `completeProductionBatch`/`undoProductionBatch` | Modificar |
| `src/lib/supabase-data/planning-snapshot.ts` | Prover `resolveBatchesDone` | Modificar |
| `src/app/api/factory-planning/workflow/route.ts` | Actions `complete-production-batch`/`undo-production-batch` | Modificar |
| `src/components/production/product-form-dialog.tsx` | Input de capacidade por batida | Modificar |
| `src/app/impressao/pre-pesagem/[opId]/page.tsx` | Controle batida-a-batida + receita escalada por batida | Modificar |
| `src/app/chao-fabrica/page.tsx` | Badge "batidas X/N" no card | Modificar |
| `src/app/gestor-fabrica/ordens-producao/[opId]/page.tsx` e `src/app/chao-fabrica/ordens-producao/[opId]/page.tsx` | Exibir plano de batidas no detalhe | Modificar |
| Vários `*.test.ts` (engine, factory-workflow-logic, operational-date-scope, recipe-expansion) | Fixtures ganham os campos novos | Modificar |

---

## Task 1: Migration — coluna + tabela de batidas

**Files:**
- Create: `supabase/migrations/20260601130000_workflow_production_batches.sql`

- [ ] **Step 1: Escrever a migration**

Criar o arquivo com este conteúdo (espelha `workflow_production_starts` + adiciona a coluna do produto):

```sql
-- AJ: produção por batidas.
-- (1) capacidade por batida por produto (na unidade de venda; null = sem batida).
-- (2) contador de batidas concluídas por item de OP (production_item_key canônica).
alter table public.products
  add column if not exists capacity_per_batch numeric(12, 3);

create table if not exists public.workflow_production_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  production_item_key text not null,
  batches_done integer not null default 0 check (batches_done >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_workflow_production_batches_tenant_key_unique
on public.workflow_production_batches (tenant_id, production_item_key);

create index if not exists idx_workflow_production_batches_tenant
on public.workflow_production_batches (tenant_id);

drop trigger if exists set_workflow_production_batches_updated_at on public.workflow_production_batches;
create trigger set_workflow_production_batches_updated_at
  before update on public.workflow_production_batches
  for each row execute function public.set_updated_at();

alter table public.workflow_production_batches enable row level security;

drop policy if exists workflow_production_batches_select_factory_scope on public.workflow_production_batches;
create policy workflow_production_batches_select_factory_scope
on public.workflow_production_batches
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists workflow_production_batches_manage_factory_scope on public.workflow_production_batches;
create policy workflow_production_batches_manage_factory_scope
on public.workflow_production_batches
for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);
```

- [ ] **Step 2: Aplicar no remoto**

Aplicar via MCP Supabase (projeto `daniel-augusto`): tool `apply_migration` com `name: "workflow_production_batches"` e o `query` = conteúdo SQL acima (sem o comentário de cabeçalho é ok).

- [ ] **Step 3: Verificar**

Via MCP `list_tables` (schema public): confirmar `public.workflow_production_batches` com `rls_enabled: true`. Confirmar coluna `capacity_per_batch` (MCP `list_tables` verbose ou `execute_sql`: `select column_name from information_schema.columns where table_name='products' and column_name='capacity_per_batch';`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601130000_workflow_production_batches.sql
git commit -m "feat(fabrica): schema de producao por batidas"
```

---

## Task 2: Helper puro `planBatches` (TDD)

Calcula o plano de batidas. Pura, sem I/O, totalmente testável.

**Files:**
- Create: `src/lib/production-batches.ts`
- Test: `src/lib/production-batches.test.ts`

- [ ] **Step 1: Escrever os testes (falham)**

`src/lib/production-batches.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { planBatches, deriveBatchStatus } from "@/lib/production-batches";

test("planBatches — enche e sobra na ultima (456 un, cap 100)", () => {
  const plan = planBatches({ totalKg: 50.16, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 5);
  assert.deepEqual(plan.batchSizes, [100, 100, 100, 100, 56]);
  assert.equal(plan.unitLabel, "Un");
});

test("planBatches — divisao exata (300 un, cap 100)", () => {
  const plan = planBatches({ totalKg: 33, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 3);
  assert.deepEqual(plan.batchSizes, [100, 100, 100]);
});

test("planBatches — demanda abaixo da capacidade = 1 batida", () => {
  const plan = planBatches({ totalKg: 6.6, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 1);
  assert.deepEqual(plan.batchSizes, [60]);
});

test("planBatches — sem capacidade = 1 batida com o total", () => {
  const plan = planBatches({ totalKg: 50.16, capacityPerBatch: null, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 1);
  assert.deepEqual(plan.batchSizes, [456]);
});

test("planBatches — produto em kg (fator 1)", () => {
  const plan = planBatches({ totalKg: 250, capacityPerBatch: 100, salesToKgFactor: 1, salesUnit: "Kg" });
  assert.equal(plan.batchCount, 3);
  assert.deepEqual(plan.batchSizes, [100, 100, 50]);
  assert.equal(plan.unitLabel, "Kg");
});

test("deriveBatchStatus — 0/parcial/completo", () => {
  assert.equal(deriveBatchStatus(0, 5), "nao_iniciado");
  assert.equal(deriveBatchStatus(2, 5), "em_producao");
  assert.equal(deriveBatchStatus(5, 5), "concluido");
  assert.equal(deriveBatchStatus(7, 5), "concluido"); // clamp
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test src/lib/production-batches.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o helper**

`src/lib/production-batches.ts`:

```ts
import type { ProductionItemStatus } from "@/lib/order-planning";

export interface BatchPlan {
  batchCount: number;
  /** Tamanho de cada batida na unidade de venda (enche + sobra na última). */
  batchSizes: number[];
  /** Rótulo da unidade de venda (ex.: "Un", "Kg"). */
  unitLabel: string;
}

export interface PlanBatchesInput {
  totalKg: number;
  capacityPerBatch: number | null;
  salesToKgFactor: number;
  salesUnit: string;
}

/**
 * Calcula o plano de batidas de um item de OP.
 * - Converte o total (kg) para a unidade de venda via salesToKgFactor.
 * - Sem capacidade (null/<=0) → 1 batida com o total.
 * - Com capacidade → enche cada batida até o máximo; a última leva a sobra.
 */
export function planBatches(input: PlanBatchesInput): BatchPlan {
  const { totalKg, capacityPerBatch, salesToKgFactor, salesUnit } = input;
  const factor = salesToKgFactor > 0 ? salesToKgFactor : 1;
  const totalUnits = Math.max(0, Math.round(totalKg / factor));

  if (!capacityPerBatch || capacityPerBatch <= 0) {
    return { batchCount: 1, batchSizes: [totalUnits], unitLabel: salesUnit };
  }

  const cap = Math.floor(capacityPerBatch);
  const batchCount = Math.max(1, Math.ceil(totalUnits / cap));
  const batchSizes: number[] = [];
  let remaining = totalUnits;
  for (let i = 0; i < batchCount; i += 1) {
    const size = Math.min(cap, remaining);
    batchSizes.push(size);
    remaining -= size;
  }
  return { batchCount, batchSizes, unitLabel: salesUnit };
}

/** Status efetivo de um produto batido a partir do nº de batidas concluídas. */
export function deriveBatchStatus(batchesDone: number, batchCount: number): ProductionItemStatus {
  if (batchesDone <= 0) return "nao_iniciado";
  if (batchesDone >= batchCount) return "concluido";
  return "em_producao";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/production-batches.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/production-batches.ts src/lib/production-batches.test.ts
git commit -m "feat(fabrica): helper planBatches + status por batida"
```

---

## Task 3: `capacityPerBatch` no produto (tipo + leitura + persistência)

**Files:**
- Modify: `src/lib/production-planning.ts` (interface `ProductionProduct`, após `expedition_to_kg_factor`/`isMpiIngredient`, ~linha 177)
- Modify: `src/lib/supabase-data/master-data.ts` (mapa de produto, ~linha 341; e diff/select ~linha 1354)
- Modify: `src/lib/supabase-data/master-data-admin.ts` (`normalizeProductPayload` ~linha 845; `diffProductFields` select ~1354)

- [ ] **Step 1: Adicionar o campo na interface**

`src/lib/production-planning.ts`, dentro de `interface ProductionProduct` (após `isMpiIngredient: boolean;`, linha 177):

```ts
  isMpiIngredient: boolean;
  /** Capacidade por batida na unidade de venda. null = sem batida (1 corrida). */
  capacityPerBatch: number | null;
```

- [ ] **Step 2: Mapear na leitura do banco**

`src/lib/supabase-data/master-data.ts`, no `.map((row) => ({ ... }))` de produtos, junto aos numéricos (após `economicProductionKg: Number(row.economic_production_kg),`, linha 341):

```ts
    economicProductionKg: Number(row.economic_production_kg),
    capacityPerBatch:
      row.capacity_per_batch === null || row.capacity_per_batch === undefined
        ? null
        : Number(row.capacity_per_batch),
```

(O `select("*")` na linha 132 já traz a coluna nova — não mexer na query.)

- [ ] **Step 3: Persistir no normalize**

`src/lib/supabase-data/master-data-admin.ts`, em `normalizeProductPayload` (após `economic_production_kg: input.economicProductionKg,`, linha 845):

```ts
    economic_production_kg: input.economicProductionKg,
    capacity_per_batch: input.capacityPerBatch ?? null,
```

- [ ] **Step 4: Incluir no diff de auditoria**

`src/lib/supabase-data/master-data-admin.ts`, no `select(...)` usado pelo `diffProductFields` (linha ~1354, que lista `minimum_production_kg, economic_production_kg`): adicionar `capacity_per_batch` à lista de colunas selecionadas e ao objeto comparado logo abaixo (espelhar exatamente como `economic_production_kg` aparece nas duas pontas). Ler o trecho 1340-1360 antes de editar e seguir o padrão linha-a-linha.

- [ ] **Step 5: Verificar compilação**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: pode falhar SÓ em fixtures de teste e no `product-form-dialog` (ProductFormState = ProductionProduct exige o campo). Esses são resolvidos nas Tasks 4 e 8/“fixtures”. Se houver erro em código de produção fora desses, corrigir antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add src/lib/production-planning.ts src/lib/supabase-data/master-data.ts src/lib/supabase-data/master-data-admin.ts
git commit -m "feat(fabrica): capacidade por batida no produto (leitura+persistencia)"
```

---

## Task 4: Input de capacidade no cadastro de produto

**Files:**
- Modify: `src/components/production/product-form-dialog.tsx` (seção de bases de produção, junto a `minimumProductionKg`/`economicProductionKg`, ~linhas 1710-1735; e onde o estado inicial do form é montado a partir de um produto novo/existente)

- [ ] **Step 1: Garantir default no estado do form**

Ler como o `formState` inicial é montado (procurar onde `minimumProductionKg`/`economicProductionKg` recebem default ao criar produto novo — provavelmente um objeto base). Garantir `capacityPerBatch: product?.capacityPerBatch ?? null` no estado inicial (espelhar `economicProductionKg`). Sem isso, `ProductFormState` (= `ProductionProduct`) fica incompleto.

- [ ] **Step 2: Adicionar o input**

`src/components/production/product-form-dialog.tsx`, logo após o bloco de `economicProductionKg` (linhas 1723-1735), no mesmo grid:

```tsx
<div className="grid gap-2">
  <Label>Capacidade por batida (un de venda; vazio = sem batida)</Label>
  <Input
    type="number"
    min={0}
    value={formState.capacityPerBatch ?? ""}
    onChange={(event) =>
      setFormState((current) => ({
        ...current,
        capacityPerBatch:
          event.target.value === "" ? null : Number(event.target.value),
      }))
    }
  />
</div>
```

- [ ] **Step 3: Verificar compilação + lint**

Run: `npx tsc --noEmit -p tsconfig.json` (não pode haver erro em `product-form-dialog.tsx`).
Run: `npx eslint src/components/production/product-form-dialog.tsx`
Expected: exit 0 nos dois.

- [ ] **Step 4: Verificação manual (anotar, não bloquear)**

Abrir o cadastro de produto, conferir que o campo aparece, salva e relê (o valor persiste). Anotar resultado.

- [ ] **Step 5: Commit**

```bash
git add src/components/production/product-form-dialog.tsx
git commit -m "feat(fabrica): campo capacidade por batida no cadastro de produto"
```

---

## Task 5: Campos de batida nos tipos do motor

**Files:**
- Modify: `src/lib/factory-planning/types.ts` (`PlannedOrderItem` ~linha 83; `ProductionOrderItem` ~linha 127)

- [ ] **Step 1: `PlannedOrderItem`**

Em `interface PlannedOrderItem`, após `productionStarted: boolean;` (linha 83-ish), adicionar:

```ts
  productionStarted: boolean;
  // Batidas: capacidade + fator/unidade p/ derivar o plano após consolidar o totalKg.
  capacityPerBatch: number | null;
  salesToKgFactor: number;
  salesUnit: OrderUnit;
  batchesDone: number;
```

(`OrderUnit` já é importado/usado no arquivo — `requestedUnit: OrderUnit`.)

- [ ] **Step 2: `ProductionOrderItem`**

Em `interface ProductionOrderItem`, após `status: ProductionItemStatus;` (linha 124), adicionar:

```ts
  status: ProductionItemStatus;
  // Plano de batidas derivado (planBatches) + progresso.
  batchCount: number;
  batchSizes: number[];
  batchUnitLabel: string;
  batchesDone: number;
```

- [ ] **Step 3: Verificar (vai falhar em vários lugares)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: erros em `engine.ts`, `recipe-expansion.ts`, `factory-workflow-logic.ts` e fixtures de teste por falta dos campos. Resolvidos nas Tasks 6-8. NÃO commitar ainda (tipos sozinhos não compilam). Seguir para Task 6.

---

## Task 6: Motor — carregar capacidade + derivar plano/status por batida

**Files:**
- Modify: `src/lib/factory-planning/engine.ts` (item planejado base ~linha 644; criação do `ProductionOrderItem` ~linha 722-738; map final dos `productionOrders` ~linha 787-849)
- Modify: `src/lib/factory-planning/recipe-expansion.ts` (itens expandidos ~linhas 256, 333)
- Test: `src/lib/factory-planning/engine.test.ts` (ajustar fixtures + 1 teste novo)

- [ ] **Step 1: Importar o helper no engine**

Topo de `src/lib/factory-planning/engine.ts`, junto aos imports de libs:

```ts
import { planBatches, deriveBatchStatus } from "@/lib/production-batches";
```

- [ ] **Step 2: Preencher os campos no item planejado base**

`engine.ts`, no objeto do item planejado (onde está `releasedToProduction: false, productionStarted: false,`, ~linha 644). O `product` está em escopo (é de onde vêm `salesToKgFactor` etc.):

```ts
          releasedToProduction: false,
          productionStarted: false,
          capacityPerBatch: product.capacityPerBatch,
          salesToKgFactor: product.salesToKgFactor,
          salesUnit: product.salesUnit,
          batchesDone: 0,
```

- [ ] **Step 3: Carregar os campos no `ProductionOrderItem` ao criar o grupo**

`engine.ts`, na criação do item do grupo (`group.items.set(item.productId, { ... })`, ~linha 723-738), adicionar os campos (valores temporários do plano serão recalculados no map final; `batchesDone` vem do item planejado):

```ts
          status: item.productionItemStatus ?? "nao_iniciado",
          preparationStages: item.preparationStages,
          sourceItemsCount: 0,
          batchCount: 1,
          batchSizes: [],
          batchUnitLabel: item.salesUnit,
          batchesDone: item.batchesDone,
          // temporários p/ recomputar o plano após somar o totalKg consolidado:
          capacityPerBatch: item.capacityPerBatch,
          salesToKgFactor: item.salesToKgFactor,
```

Para os dois temporários (`capacityPerBatch`, `salesToKgFactor`) compilarem, declarar o Map do grupo com um tipo aumentado. Trocar a assinatura do Map (`items: Map<string, ProductionOrderItem>;` na definição do `opGroupMap`, ~linha 681 e ~linha 709) por:

```ts
      items: Map<string, ProductionOrderItem & { capacityPerBatch: number | null; salesToKgFactor: number }>;
```

- [ ] **Step 4: Recalcular plano + status/progresso efetivo no map final**

`engine.ts`, no `productionOrders.map((group, index) => { ... })` (~linha 787). Hoje calcula `progress` por `getAverageProgress(group.sourceItems)` e depois monta `items`. Reescrever para: (a) montar os itens com plano + status/progresso efetivo primeiro, (b) derivar o progresso/status da OP a partir dos itens.

Substituir o trecho que vai de `const progress = getAverageProgress(group.sourceItems);` até o fechamento do objeto retornado (linhas ~791-848) por:

```ts
    // Monta os itens já com plano de batidas + status/progresso efetivo.
    const builtItems = Array.from(group.items.values())
      .map((opItem) => {
        const plan = planBatches({
          totalKg: opItem.totalKg,
          capacityPerBatch: opItem.capacityPerBatch,
          salesToKgFactor: opItem.salesToKgFactor,
          salesUnit: opItem.batchUnitLabel,
        });
        const isBatched = opItem.capacityPerBatch != null && opItem.capacityPerBatch > 0;
        const batchesDone = Math.min(opItem.batchesDone, plan.batchCount);
        // Produto batido: status/progresso derivam do contador de batidas.
        const status = isBatched ? deriveBatchStatus(batchesDone, plan.batchCount) : opItem.status;
        const progress = isBatched
          ? Math.round((batchesDone / plan.batchCount) * 100)
          : opItem.progress;
        return {
          ...opItem,
          belowMinimum: opItem.minimumProductionKg > 0 && opItem.totalKg < opItem.minimumProductionKg,
          batchCount: plan.batchCount,
          batchSizes: plan.batchSizes,
          batchUnitLabel: plan.unitLabel,
          batchesDone,
          status,
          progress,
        };
      })
      .sort((a, b) => {
        const bySequence =
          (a.productionSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.productionSequence ?? Number.MAX_SAFE_INTEGER);
        if (bySequence !== 0) {
          return bySequence;
        }
        return a.productCode.localeCompare(b.productCode);
      });

    // Progresso da OP = média dos itens (cobre etapas E batidas, conforme o item).
    const progress =
      builtItems.length === 0
        ? 0
        : Number(
            (builtItems.reduce((sum, it) => sum + it.progress, 0) / builtItems.length).toFixed(1),
          );
    const status: OrderStatus =
      progress >= 100
        ? "aguardando_expedicao"
        : progress > 0
          ? "em_producao"
          : compareDateKeys(group.productionDate, referenceDate) >= 0
            ? "agendado"
            : "em_espera";

    return {
      id: `op-${index + 1}`,
      code,
      productionDate: group.productionDate,
      productionDateLabel: formatDateBr(group.productionDate),
      sectorId: group.sectorId,
      sectorName: group.sectorName,
      lineId: group.lineId,
      lineName: group.lineName,
      scheduleId: group.scheduleId,
      scheduleCode: group.scheduleCode,
      scheduleName: group.scheduleName,
      itemsCount: group.sourceItems.length,
      ordersCount: group.orderIds.size,
      totalKg: round2(group.totalKg),
      releasedToProduction: group.releasedToProduction,
      productionStarted: group.productionStarted,
      progress,
      status,
      orderCodes: Array.from(group.orderCodes).sort((a, b) => a.localeCompare(b)),
      items: builtItems.map(({ capacityPerBatch, salesToKgFactor, ...rest }) => rest),
      sourceItems: group.sourceItems.sort((a, b) => {
        const bySequence =
          (a.productionSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.productionSequence ?? Number.MAX_SAFE_INTEGER);
        if (bySequence !== 0) {
          return bySequence;
        }
        const byOrder = a.orderCode.localeCompare(b.orderCode);
        if (byOrder !== 0) {
          return byOrder;
        }
        return a.productCode.localeCompare(b.productCode);
      }),
    };
```

(O `items.map(({ capacityPerBatch, salesToKgFactor, ...rest }) => rest)` descarta os dois campos temporários, devolvendo `ProductionOrderItem` puro.)

- [ ] **Step 5: Propagar os campos nos itens expandidos (MPI)**

`src/lib/factory-planning/recipe-expansion.ts`, nos dois objetos que espelham o pai (após `productionStarted: parent.productionStarted,`, linhas ~256 e ~333):

```ts
    productionStarted: parent.productionStarted,
    capacityPerBatch: mpiProduct.capacityPerBatch, // no 1º bloco (produto); no bloco de ingrediente misturado: null
    salesToKgFactor: parent.salesToKgFactor,
    salesUnit: parent.salesUnit,
    batchesDone: parent.batchesDone,
```

Atenção: no bloco do **ingrediente misturado** (~linha 333) não há `mpiProduct`; usar `capacityPerBatch: null` (ingrediente não tem capacidade de batida própria) e manter `salesToKgFactor`/`salesUnit` do `parent`. Ler 240-340 e ajustar conforme o que está em escopo em cada bloco.

- [ ] **Step 6: Ajustar fixtures e adicionar teste no engine**

Em `src/lib/factory-planning/engine.test.ts`: o mock do workflow (`isReleased: () => true`, ~linha 1003) não muda. Se houver fixtures `PlannedOrderItem`/`ProductionOrderItem` literais, adicionar os campos novos (`capacityPerBatch`, `salesToKgFactor`, `salesUnit`, `batchesDone` nos planejados; `batchCount`/`batchSizes`/`batchUnitLabel`/`batchesDone` nos de OP). Rodar o tsc para achar cada um.

Adicionar um teste do plano no nível do motor (ajustar para a fábrica/fixture builder existente no arquivo; o essencial é asserir o split):

```ts
test("OP de produto batido fatia em batidas (cap 100, 456 un)", () => {
  // Usar o builder/fixture do arquivo para um produto com capacityPerBatch=100,
  // salesToKgFactor=0.11 e demanda consolidada ~50.16kg (=456 un).
  // Asserir: op.items[0].batchCount === 5 e batchSizes === [100,100,100,100,56].
});
```

(Se o arquivo não tiver um builder reutilizável simples, preferir cobrir esse caso no teste unitário do `planBatches` — Task 2 — e asserir aqui apenas que `op.items[0].batchCount` existe e é >= 1.)

- [ ] **Step 7: Rodar testes do motor**

Run: `npx tsx --test src/lib/factory-planning/engine.test.ts`
Expected: PASS.

⚠️ **Atenção (regressão possível):** o Step 4 troca o cálculo do `progress` da OP
de `getAverageProgress(group.sourceItems)` (média por item de origem) para a
média do `progress` dos `builtItems` (média por produto). Para OPs com 1 produto
o número não muda; para multi-produto pode mudar levemente, alterando também o
`status` derivado. Se algum teste existente (engine, operational-date-scope)
asseriar um `progress`/`status` específico de OP multi-produto e quebrar,
**atualizar o valor esperado** (o novo cálculo por produto é o pretendido) — não
reverter a fórmula. Confirmar que `getAverageProgress` continua usada em outros
pontos (ex.: nível de pedido) antes de removê-la do import, se ficar órfã.

- [ ] **Step 8: Commit**

```bash
git add src/lib/factory-planning/engine.ts src/lib/factory-planning/recipe-expansion.ts src/lib/factory-planning/engine.test.ts
git commit -m "feat(fabrica): motor calcula batidas e deriva status do item"
```

---

## Task 7: Workflow state — ler contador de batidas

**Files:**
- Modify: `src/lib/supabase-data/workflow.ts` (`PersistedWorkflowState` ~linha 27; `getPersistedWorkflowState` ~linha 88-120; callers de `applyFactoryWorkflowState` ~219 e ~630)
- Modify: `src/lib/factory-workflow-logic.ts` (param `workflow` + branches que setam o item)
- Modify: `src/lib/supabase-data/planning-snapshot.ts` (prover `resolveBatchesDone`)
- Test: `src/lib/factory-workflow-logic.test.ts`

- [ ] **Step 1: Estender `PersistedWorkflowState`**

`workflow.ts`, em `interface PersistedWorkflowState` (após `productionStartedKeys: string[];`):

```ts
  productionStartedKeys: string[];
  /** Mapa production_item_key canônica → nº de batidas concluídas. */
  productionBatchesDone: Record<string, number>;
```

- [ ] **Step 2: Ler a tabela em `getPersistedWorkflowState`**

`workflow.ts`, adicionar a query ao `Promise.all` (junto a `workflow_production_starts`):

```ts
    supabase.from("workflow_production_starts").select("production_item_key"),
    supabase.from("workflow_production_batches").select("production_item_key, batches_done"),
```

(Atribuir a um novo nome no destructuring, ex.: `startsResult, batchesResult, ordersResult`.) Depois, junto ao tratamento de `startRows`:

```ts
  const batchRows = isSupabaseMissingSchemaError(batchesResult.error, ["workflow_production_batches"])
    ? []
    : assertSupabaseResult(batchesResult, "Failed to load workflow production batches");
```

E no objeto retornado, após `productionStartedKeys`:

```ts
    productionBatchesDone: batchRows.reduce<Record<string, number>>((acc, row) => {
      const key = canonicalProductionItemKey(row.production_item_key);
      acc[key] = Math.max(acc[key] ?? 0, Number(row.batches_done) || 0);
      return acc;
    }, {}),
```

- [ ] **Step 3: Aplicar `batchesDone` no item (factory-workflow-logic)**

`src/lib/factory-workflow-logic.ts`: no tipo do param `workflow`, adicionar (opcional, p/ compat dos callers/testes):

```ts
    isProductionStarted?: (itemKey: string | null) => boolean;
    resolveBatchesDone?: (itemKey: string | null) => number;
```

No corpo, junto a `const isProductionStarted = workflow.isProductionStarted ?? (() => false);`:

```ts
  const resolveBatchesDone = workflow.resolveBatchesDone ?? (() => 0);
```

Em CADA um dos 4 branches do `.map` que retornam o item, setar `batchesDone`:
- cancelado / `!canPlan` / não liberado → `batchesDone: 0,`
- liberado → `batchesDone: resolveBatchesDone(item.productionItemKey),`

(Espelhar exatamente onde `productionStarted`/`productionItemStatus` são setados em cada branch.)

- [ ] **Step 4: Prover `resolveBatchesDone` em planning-snapshot**

`src/lib/supabase-data/planning-snapshot.ts`, no objeto passado a `applyFactoryWorkflowState`, após `isProductionStarted`:

```ts
      isProductionStarted(itemKey) {
        return itemKey ? startedKeys.has(itemKey) : false;
      },
      resolveBatchesDone(itemKey) {
        return itemKey ? workflowState.productionBatchesDone[itemKey] ?? 0 : 0;
      },
```

- [ ] **Step 5: Prover nos 2 callers em workflow.ts**

`src/lib/supabase-data/workflow.ts`, nos dois `applyFactoryWorkflowState(...)` (linha ~219 e ~630), após a linha `isProductionStarted: (itemKey) => ...`:

```ts
    resolveBatchesDone: (itemKey) =>
      itemKey ? workflowState.productionBatchesDone[canonicalProductionItemKey(itemKey)] ?? 0 : 0,
```

- [ ] **Step 6: Ajustar fixtures + teste**

`factory-workflow-logic.test.ts`: os literais `PlannedOrderItem` (3, ancorados por `productionItemKey`) ganham `capacityPerBatch: null, salesToKgFactor: <fator>, salesUnit: "Kg", batchesDone: 0` (mesma técnica da feature anterior). Adicionar um teste:

```ts
test("produto batido: status derivado de batchesDone", () => {
  // Reusar o buildPlanning() do arquivo com 1 item de produto.
  // Definir no item planejado: capacityPerBatch=100, salesToKgFactor=0.11,
  // salesUnit="Un", totalKg ~50.16 (456 un) e liberado.
  // Caso A: resolveBatchesDone=()=>0  → op.items[0].status === "nao_iniciado".
  // Caso B: resolveBatchesDone=()=>2  → op.items[0].status === "em_producao".
  // Caso C: resolveBatchesDone=()=>5  → op.items[0].status === "concluido".
});
```

(O `totalKg` consolidado vem do `internalKg` do item planejado — ajustar o fixture para somar ~50.16.)

- [ ] **Step 7: Rodar testes**

Run: `npm test`
Expected: PASS (todos, incluindo os novos).

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase-data/workflow.ts src/lib/factory-workflow-logic.ts src/lib/supabase-data/planning-snapshot.ts src/lib/factory-workflow-logic.test.ts src/lib/operational-date-scope.test.ts
git commit -m "feat(fabrica): aplica contador de batidas no estado de workflow"
```

(Incluir `operational-date-scope.test.ts` se o tsc acusar fixtures lá.)

---

## Task 8: Backend — concluir/desfazer batida

**Files:**
- Modify: `src/lib/supabase-data/workflow.ts` (novas funções, após `startProductionItem`)
- Modify: `src/app/api/factory-planning/workflow/route.ts` (novas actions)

- [ ] **Step 1: Funções no workflow.ts**

Após `startProductionItem` (~linha 500), adicionar:

```ts
/**
 * Conclui UMA batida do item (incrementa batches_done). `batchCount` é o teto
 * (do plano derivado, enviado pela UI) — idempotente: não passa do total.
 */
export async function completeProductionBatch(
  productionItemKey: string,
  batchCount: number,
  updatedByProfileId?: string | null,
  tenantId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const updatedBy = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const canonicalKey = canonicalProductionItemKey(productionItemKey);
  const currentResult = await supabase
    .from("workflow_production_batches")
    .select("batches_done")
    .eq("production_item_key", canonicalKey)
    .maybeSingle();
  if (
    currentResult.error &&
    !isSupabaseMissingSchemaError(currentResult.error, ["workflow_production_batches"])
  ) {
    throw new Error(`Failed to load production batches: ${currentResult.error.message}`);
  }
  const current = Number(currentResult.data?.batches_done ?? 0);
  const cap = Math.max(1, Math.floor(batchCount));
  const next = Math.min(cap, current + 1);
  if (next === current) return; // já no máximo

  const upsertResult = await supabase.from("workflow_production_batches").upsert(
    {
      production_item_key: canonicalKey,
      batches_done: next,
      updated_at: new Date().toISOString(),
      updated_by_profile_id: updatedBy,
    },
    { onConflict: "production_item_key" },
  );
  if (upsertResult.error) {
    throw new Error(`Failed to complete production batch: ${upsertResult.error.message}`);
  }
}

/** Desfaz uma batida (decrementa, piso 0). Para corrigir engano. */
export async function undoProductionBatch(
  productionItemKey: string,
  updatedByProfileId?: string | null,
  tenantId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const updatedBy = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const canonicalKey = canonicalProductionItemKey(productionItemKey);
  const currentResult = await supabase
    .from("workflow_production_batches")
    .select("batches_done")
    .eq("production_item_key", canonicalKey)
    .maybeSingle();
  if (
    currentResult.error &&
    !isSupabaseMissingSchemaError(currentResult.error, ["workflow_production_batches"])
  ) {
    throw new Error(`Failed to load production batches: ${currentResult.error.message}`);
  }
  const current = Number(currentResult.data?.batches_done ?? 0);
  const next = Math.max(0, current - 1);
  if (next === current) return;

  const upsertResult = await supabase.from("workflow_production_batches").upsert(
    {
      production_item_key: canonicalKey,
      batches_done: next,
      updated_at: new Date().toISOString(),
      updated_by_profile_id: updatedBy,
    },
    { onConflict: "production_item_key" },
  );
  if (upsertResult.error) {
    throw new Error(`Failed to undo production batch: ${upsertResult.error.message}`);
  }
}
```

- [ ] **Step 2: Actions na rota**

`src/app/api/factory-planning/workflow/route.ts`:
- No import de `@/lib/supabase-data/workflow`: adicionar `completeProductionBatch, undoProductionBatch`.
- No tipo `body` (union), adicionar:

```ts
      | {
          action: "complete-production-batch";
          productionItemKey: string;
          batchCount: number;
        }
      | {
          action: "undo-production-batch";
          productionItemKey: string;
        };
```

- Após o bloco `if (body.action === "start-production-item") { ... }`, adicionar (mesmo padrão de auth — permitir `chao-fabrica.ops`, que opera a pré-pesagem):

```ts
    if (body.action === "complete-production-batch" || body.action === "undo-production-batch") {
      const authorization = await authorizeApiRequest({
        contextLabel: `PATCH /api/factory-planning/workflow ${body.action}`,
        anyOfPermissions: ["gestor-fabrica.ops", "chao-fabrica.ops"],
        minimumLevel: "operar",
        requireTenantContext: true,
        requireWritableTenant: true,
      });
      if ("response" in authorization) {
        return authorization.response;
      }
      const supabase = createTenantScopedSupabaseClient(
        authorization.effectiveTenantId,
        createSupabaseAdminClient(),
      );
      if (body.action === "complete-production-batch") {
        await completeProductionBatch(
          body.productionItemKey,
          body.batchCount,
          authorization.user.id,
          authorization.effectiveTenantId,
          supabase,
        );
      } else {
        await undoProductionBatch(
          body.productionItemKey,
          authorization.user.id,
          authorization.effectiveTenantId,
          supabase,
        );
      }
      invalidatePlanningCaches(authorization.effectiveTenantId);
      return NextResponse.json({ ok: true });
    }
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Run: `npx eslint src/lib/supabase-data/workflow.ts src/app/api/factory-planning/workflow/route.ts` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase-data/workflow.ts src/app/api/factory-planning/workflow/route.ts
git commit -m "feat(fabrica): actions concluir/desfazer batida"
```

---

## Task 9: Pré-pesagem — controle batida a batida

**Files:**
- Modify: `src/app/impressao/pre-pesagem/[opId]/page.tsx`

Pré-requisito: ler o arquivo inteiro antes de editar (estrutura confirmada: usa `useFactoryPlanningSnapshot(referenceDate)` para `op`, `useMasterDataSnapshot()` para produtos, e `buildPreWeighingDocument(op, {...})` para o documento; render por produto em `document.productSections.map(...)`).

- [ ] **Step 1: Função de chamada das actions**

No componente, adicionar um handler (espelhar o padrão de fetch já usado no gestor):

```tsx
const [pendingKey, setPendingKey] = useState<string | null>(null);
const refresh = /* usar o refetch do useFactoryPlanningSnapshot, se exposto; senão router.refresh() */;

const sendBatch = useCallback(
  async (productionItemKey: string, action: "complete-production-batch" | "undo-production-batch", batchCount: number) => {
    setPendingKey(productionItemKey);
    try {
      const res = await fetch("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "complete-production-batch"
            ? { action, productionItemKey, batchCount }
            : { action, productionItemKey },
        ),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Falha na batida.");
    } finally {
      setPendingKey(null);
    }
  },
  [],
);
```

(Verificar como `useFactoryPlanningSnapshot` expõe refetch — reusar o mesmo mecanismo do gestor `refreshPlanning`. Se não houver, importar `useRouter` e chamar `router.refresh()` após sucesso.)

- [ ] **Step 2: Cruzar a seção do documento com o item da OP (que tem o plano)**

`document.productSections` não tem o plano de batidas; o `op.items` tem. Antes do render, montar um índice por `productId`:

```tsx
const itemByProduct = useMemo(() => {
  const map = new Map<string, (typeof op.items)[number]>();
  op?.items.forEach((it) => map.set(it.productId, it));
  return map;
}, [op]);
```

- [ ] **Step 3: Render do bloco de batidas por produto**

Dentro do `document.productSections.map((section) => (...))`, após o `<header>` do produto, inserir (só quando há mais de 1 batida OU capacidade definida):

```tsx
{(() => {
  const opItem = itemByProduct.get(section.productId);
  if (!opItem || opItem.batchCount <= 1) return null;
  const done = opItem.batchesDone;
  const currentIdx = Math.min(done, opItem.batchCount - 1);
  const currentSize = opItem.batchSizes[currentIdx] ?? 0;
  const product = snapshot.products.find((p) => p.id === section.productId);
  const currentKg = product ? currentSize * product.salesToKgFactor : 0;
  const isDone = done >= opItem.batchCount;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-400 bg-stone-100 px-3 py-2 print:hidden">
      <div className="text-sm font-semibold text-stone-900">
        {isDone ? `Todas as ${opItem.batchCount} batidas concluídas` : `Batida ${done + 1} de ${opItem.batchCount}`}
        {!isDone && (
          <span className="ml-2 font-normal text-stone-600">
            {currentSize} {opItem.batchUnitLabel} · {currentKg.toFixed(3)} kg
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {done > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pendingKey === opItem.productionItemKey}
            onClick={() => void sendBatch(opItem.productionItemKey, "undo-production-batch", opItem.batchCount).then(refresh)}
          >
            Desfazer
          </Button>
        )}
        {!isDone && (
          <Button
            type="button"
            size="sm"
            disabled={pendingKey === opItem.productionItemKey}
            onClick={() => void sendBatch(opItem.productionItemKey, "complete-production-batch", opItem.batchCount).then(refresh)}
          >
            Concluir batida {done + 1}
          </Button>
        )}
      </div>
    </div>
  );
})()}
```

(Importar `Button` de `@/components/ui/button` e `useState`/`useMemo`/`useCallback` se ainda não importados. O bloco é `print:hidden` — não sai no papel.)

- [ ] **Step 4: Escalar a receita pela batida atual (opcional v1 — confirmar com PO)**

A receita hoje é escalada por `item.totalKg` (documento inteiro). Para escalar pela batida atual, `buildPreWeighingDocument` precisaria receber o kg da batida. **Decisão de escopo:** se o objetivo da pré-pesagem é pesar 1 batida por vez, passar `currentKg` ao builder. Implementação mínima sem quebrar os outros documentos: adicionar parâmetro opcional `batchKgByProductId?: Record<string, number>` em `buildPreWeighingDocument` e, dentro, usar `batchKgByProductId[item.productId] ?? item.totalKg` no lugar de `item.totalKg` na chamada de `buildScaledRecipeRowsForProduct` (linha 256) e em `plannedKg` (linha 247). Se o PO preferir manter a receita no total do dia e só contar batidas, PULAR este step. Registrar a decisão no commit.

- [ ] **Step 5: Verificar compilação + lint**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Run: `npx eslint src/app/impressao/pre-pesagem/[opId]/page.tsx` → exit 0.

- [ ] **Step 6: Verificação manual (anotar)**

Com um produto batido liberado + iniciado: abrir a pré-pesagem, ver "Batida 1 de N", clicar "Concluir batida", confirmar que o contador avança e (após refresh) o board do chão move a OP de "Não iniciado" → "Produção" → "Expedição" ao concluir todas.

- [ ] **Step 7: Commit**

```bash
git add src/app/impressao/pre-pesagem/[opId]/page.tsx src/lib/printing-documents.ts
git commit -m "feat(fabrica): pre-pesagem controla batidas uma a uma"
```

---

## Task 10: Board do chão — badge de batidas

**Files:**
- Modify: `src/app/chao-fabrica/page.tsx` (componente `ChaoOpCard`)

- [ ] **Step 1: Calcular o agregado de batidas no card**

Em `ChaoOpCard` (após o cálculo de `pendingItems`/`nextStepLabel`), adicionar:

```tsx
// Agregado de batidas da OP (soma dos produtos batidos). Glanceable; detalhe vive na pré-pesagem.
const batched = op.items.filter((it) => it.batchCount > 1);
const totalBatches = batched.reduce((s, it) => s + it.batchCount, 0);
const doneBatches = batched.reduce((s, it) => s + it.batchesDone, 0);
const hasBatches = batched.length > 0;
```

- [ ] **Step 2: Renderizar o badge**

No card, junto à linha de kg/pedidos (`<p>... kg · ... pedidos ...</p>`), adicionar abaixo:

```tsx
{hasBatches ? (
  <p className="text-sm font-semibold text-foreground">
    Batidas: <span className="tabular-nums">{doneBatches}/{totalBatches}</span>
  </p>
) : null}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Run: `npx eslint src/app/chao-fabrica/page.tsx` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/chao-fabrica/page.tsx
git commit -m "feat(fabrica): badge de batidas no card do chao"
```

---

## Task 11: Detalhe da OP — exibir plano de batidas (read-only)

**Files:**
- Modify: `src/app/chao-fabrica/ordens-producao/[opId]/page.tsx` e `src/app/gestor-fabrica/ordens-producao/[opId]/page.tsx`

Pré-requisito: ler como cada página lista `op.items` (procurar onde renderiza nome/kg/status por produto).

- [ ] **Step 1: Mostrar plano por produto**

Onde cada `op.items[]` é renderizado, quando `item.batchCount > 1`, adicionar uma linha:

```tsx
{item.batchCount > 1 ? (
  <p className="text-sm text-muted-foreground tabular-nums">
    {item.batchesDone}/{item.batchCount} batidas · {item.batchSizes.join(" + ")} {item.batchUnitLabel}
  </p>
) : null}
```

(Adaptar classes ao componente local. Sem ação — controle é na pré-pesagem.)

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Run: `npx eslint src/app/chao-fabrica/ordens-producao/[opId]/page.tsx src/app/gestor-fabrica/ordens-producao/[opId]/page.tsx` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/chao-fabrica/ordens-producao/[opId]/page.tsx src/app/gestor-fabrica/ordens-producao/[opId]/page.tsx
git commit -m "feat(fabrica): plano de batidas no detalhe da OP"
```

---

## Task 12: Verificação final

- [ ] **Step 1: Typecheck + lint + testes**

Run: `npx tsc --noEmit -p tsconfig.json` → `TSC_EXIT=0`
Run: `npx eslint src` (ou os arquivos tocados) → exit 0
Run: `npm test` → todos PASS (≥ 207 + novos, 0 fail)

- [ ] **Step 2: Smoke manual do fluxo completo (anotar evidências)**

1. Cadastrar capacidade por batida num produto (ex.: 100).
2. Loja faz pedido com demanda > capacidade (ex.: 456) → gestor "Liberar" → "Iniciar produção do dia".
3. Chão: OP aparece em "Não iniciado" com "Batidas: 0/5".
4. Pré-pesagem: "Batida 1 de 5" → concluir → board vai p/ "Produção", "Batidas: 1/5".
5. Concluir as 5 → board vai p/ "Expedição".

- [ ] **Step 3: Push + (opcional) PR**

Apenas quando o usuário pedir. Branch `feat/producao-por-batidas` → PR para `develop`.

---

## Notas de risco / decisões em aberto

- **Receita por batida (Task 9 Step 4):** confirmar com o PO se a pré-pesagem deve escalar a receita por batida ou manter o total do dia + contagem de batidas. Default do plano: oferecer escala por batida, mas pular se o PO preferir manter o total.
- **Produto com capacidade mas demanda < capacidade:** `batchCount = 1`. Status passa a ser dirigido por batidas (0→não iniciado, 1→concluído), pulando o fluxo de etapas. Confirmar que isso é aceitável para produtos batidos de baixa demanda (decisão da spec: produto batido sempre usa progresso por batidas).
- **OPs multi-produto:** o badge do card soma batidas de todos os produtos batidos da OP; o detalhe por produto fica no detalhe da OP + pré-pesagem.
