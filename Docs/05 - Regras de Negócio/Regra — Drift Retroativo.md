# Drift retroativo — `product_changelog`, `production_line_types`, cronograma pendente

## Cenário-base

Um produto vive em uma **linha de produção** (`subcategory`) e tem uma **linha operacional** (`operational_subcategory`). O cronograma ativo é por linha operacional. Quando algo muda (produto, dias, linha), o cronograma ativo pode ficar inconsistente com o cadastro — daí o termo "drift".

## Onde mora

### 1. `product_changelog` — versionamento manual
Migration: `supabase/migrations/20260505210000_xpan_register_drift_tables.sql:61-72`.

Schema:
```sql
create table public.product_changelog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  version_number integer not null,
  change_description text not null,
  changed_by_profile_id uuid,
  changed_by_name text not null default '',
  snapshot_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (product_id, version_number)
);
```

**Quem grava**: `updateProduct` em `src/lib/supabase-data/master-data-admin.ts:1194-1218`.

```ts
// Record changelog entry if a change description was provided
if (input.changeDescription?.trim()) {
  const versionResult = await supabase
    .from("product_changelog")
    .select("version_number")
    .eq("product_id", productId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((versionResult.data as ...)?.version_number ?? 0) + 1;
  ...
  await supabase.from("product_changelog").insert({
    tenant_id: row.tenant_id,
    product_id: productId,
    version_number: nextVersion,
    change_description: input.changeDescription.trim(),
    ...
    snapshot_data: { name: input.name, description: input.description },
  });
}
```

> ⚠️ Frágil: o changelog **só grava se `changeDescription` vier preenchida**. Sem descrição → mudança fica fora do histórico. Qualquer caller que esqueça de passar `changeDescription` cria um silêncio invisível na auditoria.

> ⚠️ Frágil: `snapshot_data` só guarda `{ name, description }` — não captura `productionDays`, `expeditionLeadDays`, `breakStage`, `minimumProductionKg`, `unit profiles`, ou linha. Quem auditar o histórico **não consegue reconstruir o estado anterior do produto** para esses campos. O nome do arquivo de migration ("drift_tables") promete mais do que entrega.

API de leitura: `src/app/api/master-data/products/[productId]/changelog/route.ts:40-44` — devolve `version_number, change_description, changed_by_name, created_at` (não devolve `snapshot_data`).

### 2. `production_line_types` — catálogo de tipos de linha
Migration: `supabase/migrations/20260505210000_xpan_register_drift_tables.sql:14-23`.

```sql
create table public.production_line_types (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  status record_status not null default 'ativo',
  sort_order integer not null default 0,
  unique (tenant_id, name)
);
```

Conectado a `subcategories.line_type_id` (mesma migration, linhas 44-55).

> ⚠️ Implícito: a tabela existe, tem RLS, tem índice em FK, mas **nenhum código TS importa `production_line_types`** (grep retornou só a migration). Isso é uma estrutura aplicada direto no banco pelo cliente; a aplicação ainda não usa. Risco: alguém ajustar tipos no DB esperando efeito na UI/motor e nada acontecer.

### 3. Cronograma pendente reconstruído ("schedule revision")

`rebuildPendingScheduleRevisionForSubcategoryDbId` (`master-data-admin.ts:859-1020`):

Disparada em:
- `assignProductToOperationalSubcategory` (linha 1081)
- `removeProductFromOperationalSubcategory` (linha 1117)
- `updateProduct` (linha 1229) — após qualquer edição que mexa em `operational_subcategory_id`.

O que faz:
1. Carrega cronograma ativo + cronogramas pendentes existentes da subcategoria
2. **DELETA todos os pendentes** (linha 946-955)
3. Cria UM novo pendente com items espelhando os produtos atuais
4. Tenta preservar `day_priorities` do pendente anterior (ou do ativo, se não havia pendente). Cai em `buildDefaultScheduleDayPriorities` se nada match.
5. Marca o ativo como `inativo` (linha 1012-1019).

> ⚠️ Frágil: o passo 5 desativa o cronograma ativo antigo, mas a nova versão fica `pendente` — precisa ser auditada para virar ativa. Janela onde a linha fica **sem cronograma ativo**: pedidos novos para produtos dessa linha caem em `available: false` com motivo `"Linha de produção sem cronograma ativo."` (`store-order-catalog.ts:144`). Isso pode aparecer como "sumiu o produto do catálogo" sem o usuário saber por quê.

> ⚠️ Frágil: o delete dos pendentes (linha 946-955) faz `delete().in("id", pendingSchedules.map(...))`. **Apaga rascunhos de revisão que ainda não foram auditados**, sem aviso. Se o gestor estava trabalhando numa revisão e alguém só mudou o `productionDays` de um produto, a revisão é reconstruída do zero perdendo ajustes manuais que não estejam refletidos no cadastro (exceto `day_priorities` que é preservado).

## Drift na mudança de linha

Se um produto é editado e muda de `subcategory_id` (linha mestre):

`updateProduct` (`master-data-admin.ts:1170-1172`):
```ts
if (currentSubcategoryId !== subcategoryId) {
  nextOperationalSubcategoryId = operationalSubcategoryId ? subcategoryId : null;
}
```

- Se o produto **estava na carteira operacional**: `operational_subcategory_id` migra automaticamente para a nova linha.
- Se **não estava**: cai para `null` (sai da carteira operacional).
- Ambas as linhas afetadas (antiga e nova `operational_subcategory_id`) têm cronograma pendente reconstruído (linha 1228-1233).

> ⚠️ Frágil: pedidos já criados e ainda não liberados **continuam apontando para a linha antiga** via `engine.ts:519-523` (que resolve `line = product.operationalLineId`). Se a linha foi migrada e o produto perdeu vínculo, o pedido em aberto vira `canPlan: false` na próxima reconstrução do motor. Sem aviso.

## Conexões entre as três peças

```
EDITAR PRODUTO
   │
   ├─→ product_changelog.insert (se changeDescription preenchida)
   │
   ├─→ products.subcategory_id mudou? → reaviva operational_subcategory_id
   │
   └─→ rebuildPendingScheduleRevisionForSubcategoryDbId(antiga + nova)
            │
            ├─→ DELETE schedule_lines pendentes da subcategoria
            ├─→ INSERT 1 schedule_lines pendente novo
            ├─→ INSERT schedule_line_item_snapshots (snapshot dos produtos)
            └─→ UPDATE active schedule → status = 'inativo'
                  (linha fica sem cronograma ativo até auditoria)
```

> ⚠️ Implícito: a tabela `production_line_types` está completamente desligada desse fluxo. A migration `20260505210000` parece preparar terreno para reorganizar linhas por tipo, mas o código ainda não usa.
