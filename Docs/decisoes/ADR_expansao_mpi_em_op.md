# ADR: Expansão automática de MPI em OP separada (AJ-0008)

## Status

**Fase 1 aceita em 2026-05-20** — Giuseppe aprovou os 4 defaults defendidos. **Ativada em 2026-05-20** (mesma data): flag `EXPAND_MPI_INTO_OPS` passou para **default ON**; escape hatch `=false` para rollback emergencial sem novo deploy.

**Fase 2 entregue em 2026-05-21** — dentro da iniciativa de automação A1-A8 (ver [[ADR_iniciativa_automacao_pedido_entrega]] / A4). Fechou a "Limitação conhecida" da fase 1: MPI passa a rodar na linha/setor nativos quando o cadastro define. Ver seção [[#Fase 2 — concluída 2026-05-21]] abaixo.

> **Simplificação descoberta na implementação (2026-05-20):** a `productionItemKey` do MPI já é única por construção (`${date}|${lineId}|${scheduleId}|${mpiProductId}` com `mpiProductId` distinto do produto-pai). `resolvePreparationStagesForProductionItem` (`workflow.ts:197`) extrai `productIdentifier = key.split("|").at(-1)` que vai retornar o `mpiProductId` e buscar o produto MPI normalmente. **Sufixo `mpi:` no productionItemKey não é necessário.** Ajuste em `workflow.ts:197` removido do escopo do commit 3.

Relacionado: [[Backlog de Ajustes#AJ-0008 — MPI / Ingrediente misturado deve gerar OP separada|AJ-0008]] · [[Backlog de Ajustes#AJ-0020 — Legenda/tooltip diferenciando "ingrediente" e "produto MPI"|AJ-0020]] (já concluído) · [[ADR_iniciativa_automacao_pedido_entrega]] (fase 2) · interage com [[decisoes/ADR_modelo_fabrica_abre_pedido]] (Onda 4) e com a futura fase de armazenamento ([[Backlog de Ajustes#AJ-0021 — Armazenamento / produção sob estoque (shelf life)|AJ-0021]]).

## Contexto

### O que o cliente quer (Call 2026-05-13, Bloco 4)

> Daniel: *"Cadastrei ingrediente misturado e ele não foi para a ordem de produção."*
>
> Adriano: o **pandeló** no cliente Espírito Santo é tratado dentro do bolo (errado, gera divergência). O Xpan precisa **gerar OP de MPI separada**.

Exemplo canônico: **loja pede pizza → sistema gera OP da pizza E uma OP separada da massa de pizza (MPI)**.

### O que o sistema faz hoje (auditoria E2E 2026-05-20)

O motor `buildProductionOrdersFromPlannedItems` (`src/lib/factory-planning/engine.ts:611`) gera OP **apenas** dos produtos finais pedidos pela loja, agrupados por planning key `(productionDate|sectorId|lineId|scheduleId)`. **Zero matches** de `recipe|mpi|misturado|canBeIngredient|isMpiIngredient` em `engine.ts` e `types.ts`. A sub-receita só é expandida no PDF de pré-pesagem (`src/lib/printing-documents.ts:285`) — não vira tarefa de chão-de-fábrica, não aparece no Kanban, não tem status independente.

```
loja pede pizza (10un)
   ↓
store_order_items (1 linha)
   ↓
buildFactoryInputFromDb → carrega products[] COM recipe[] ✅
   ↓
buildPlannedItems            ❌ NUNCA olha product.recipe[]
   ↓
buildProductionOrdersFromPlannedItems   ❌ idem
   ↓
1 OP de pizza no Kanban → MPI desaparece
   ↓
printing-documents.ts (só no PDF) 🟡 AQUI a recipe é lida — mas não vira OP
```

### Dupla representação no banco real

Existem dois caminhos paralelos para "MPI" no schema:

| Caminho | Tabela cabeça | Tabela filha | Flag/enum |
|---|---|---|---|
| **A — produto-MPI** | `products.is_mpi_ingredient=true` (+ `can_be_ingredient=true`) | `product_recipe_items` com `source_type='produto'` ou `'ingrediente'` | enum `recipe_source_type` |
| **B — ingrediente misturado** | `ingredients.type='misturado'` | `ingredient_components` | enum `ingredient_type = 'puro' \| 'misturado'` |

**A mesma noção pode existir nos dois caminhos** (confirmado: "MPI Base para Pudim" está como produto `MPI-001` **e** como ingrediente `IN-036904`). Decidir o caminho canônico é pré-requisito desta fase.

### Cenário no banco hoje (2026-05-20)

- 6 produtos com `is_mpi_ingredient=true` (todos com `can_be_ingredient=true` — flags redundantes na prática).
- 7 sub-receitas produto→produto existentes — **todas variações do pudim** referenciando `MPI-001`.
- 3 ingredientes `type='misturado'` (MPI Base Pudim, Massa Pizza, Mistura Neutra Bolo).
- **Não existe pizza cadastrada.** Para validar o caso da call, será necessário cadastrar a pizza + receita primeiro.

### Por que mudar

- Manter o estado atual frustra o cliente — a call foi explícita.
- Sem OP separada, o chão-de-fábrica não consegue marcar a MPI como concluída antes do produto final, não há sequenciamento, não há rastreio de "esta massa foi pra essa pizza".
- A divergência operacional descrita pelo Adriano (pandeló absorvido no bolo) é exatamente o que o Xpan deveria resolver — é diferencial de produto, não detalhe técnico.

## Decisões pendentes (defaults defendidos)

### Decisão 1 — Caminho canônico

> **Default proposto:** **caminho A (produto-MPI)** quando o item faz sentido como produto agendável/inventariável; caminho B (ingrediente misturado) **só para composição interna** que não vira OP.

**Argumento:**

- Caminho A já tem schema, UI de cadastro, e fluxo de visibilidade no catálogo. O motor pode reaproveitar `product.recipe[]` que **já está populado no input** — sem nova query.
- Caminho B (ingredientes misturado) é mais "receita de mistura" que produto agendável. Manter como informação de composição que só aparece na folha de produção / pré-pesagem.
- Cobre 100% dos casos reais hoje (7 sub-receitas pudim→MPI-001 = caminho A).
- Para o caso "massa de pizza" da call: hoje é só ingrediente; o cadastro precisa ser **migrado para produto-MPI** (ou seja, criar um produto `MPI-XXX Massa de Pizza` com `is_mpi_ingredient=true` e referenciar na receita da pizza). Tarefa de operador, não de migração de banco.

**Alternativa rejeitada:** expandir os dois caminhos. Dobra a complexidade do motor por ganho marginal — ingredientes misturado podem virar produtos-MPI quando precisarem virar OP.

### Decisão 2 — Lead time da MPI relativo ao produto final

> **Default proposto:** **0 dias** (MPI e produto final no mesmo dia de produção) na fase 1. Lead time da MPI sai como onda 2, junto com a regra de `expedition_lead_days` por MPI.

**Argumento:**

- Hoje toda produção do dia rola na mesma linha/turno; a divisão temporal não tem demanda imediata.
- Adicionar lead-time muda a planning key e força repensar agrupamento — complexidade de fase 2.
- O cliente nunca pediu lead-time específico para MPI na call — só pediu que **vire OP visível**.

**Alternativa rejeitada:** usar `expedition_lead_days` do MPI agora. Possível, mas exige decidir se a MPI tem campo próprio ou herda do produto. Adia.

### Decisão 3 — Agrupamento de demanda de MPI

> **Default proposto:** **uma OP de MPI por planning key**, somando demanda de todos os produtos-pai que a consomem nessa mesma planning key.

**Argumento:**

- 5 pedidos de pizza no mesmo dia/linha consomem massa de pizza → **uma OP de massa** somando o total, não 5 OPs minúsculas. É o que faria a padaria na vida real.
- O motor já agrupa por `(planningKey, productId)` em `buildProductionOrdersFromPlannedItems` — basta as expansões compartilharem a mesma planning key.
- Rastreio para o operador acontece via `originItemId` em memória ("esta MPI veio dos pedidos X, Y, Z item N") + lista `usedBy` na OP (já existe no PDF de pré-pesagem em `printing-documents.ts:298`, generalizar para a OP).

**Alternativa rejeitada:** uma OP de MPI por produto-pai. Polui o Kanban com mini-OPs redundantes.

### Decisão 4 — Liberação conjunta

> **Default proposto:** liberar o pedido pai (`PATCH /api/factory-planning/workflow` com `release-order`) **libera implicitamente todas as OPs derivadas** (produto final + MPIs). Sem novo endpoint.

**Argumento:**

- `releaseOrder` opera por `order_id`, não por OP. As OPs (incluindo as de MPI) são derivadas a partir de items do pedido — se o pedido foi liberado, todas as OPs derivadas estão liberadas por extensão.
- Não há demanda na call para liberar OP isolada.
- Cancelamento e reabertura também por `order_id` — mesma garantia.

**Alternativa rejeitada:** novo endpoint para liberar/cancelar OP individualmente. Complica o `workflow_order_releases` e abre porta para inconsistências (OP de MPI liberada mas pizza não). Adia.

## Plano de implementação (fase 1 mínima)

### Esforço estimado
3-4 dias úteis para Giuseppe. Zero risco de regressão enquanto a feature flag estiver desligada.

### Estrutura do PR (3 commits, todos atrás de `EXPAND_MPI_INTO_OPS=false`)

**Commit 1 — Extrair `scaleRecipeQuantity` (preparatório, sem mudança de comportamento)**

- Cria `src/lib/factory-planning/recipe-expansion.ts`.
- Move `scaleRecipeQuantity` de `src/lib/printing-documents.ts:153` para o novo módulo.
- Testes unitários da função (escala correta de `numeric`, edge cases de zero/negativo).
- `printing-documents.ts` passa a importar do novo módulo.
- **Sem mudança de comportamento.** Apenas reorganização para reuso.

**Commit 2 — Função `expandRecipeIntoItems` + testes (sem plugar no motor)**

- Em `recipe-expansion.ts`, adiciona `expandRecipeIntoItems(plannedItems, products, options)`.
- Lógica:
  - Para cada `PlannedOrderItem`, lê `product.recipe[]`.
  - Filtra `recipe[sourceType='produto' && sourceProduct.canBeIngredient]`.
  - Para cada sub-receita: cria `PlannedOrderItem` adicional com `productId = sourceProduct.id`, `requestedQuantity = scaleRecipeQuantity(...)`, mesma planning key do pai, `productionItemKey` com sufixo `|mpi:${sourceProductId}`, `originItemId = orderItem.id`.
  - Expansão recursiva com `Set<productId>` visitado e `depth máx=4`.
- 5 testes unitários:
  1. Expansão básica: produto com 1 MPI gera 1 item extra.
  2. Demanda agrupada: 5 produtos consumindo a mesma MPI → 5 itens extras com mesma planning key (motor agrupa depois).
  3. Sem `canBeIngredient`: nenhuma expansão.
  4. Ciclo (A→B→A): aborta na profundidade máxima, log de warning, segue sem quebrar.
  5. Recursão de 2 níveis: A→B→C gera A+B+C, sem duplicar.
- **Não chama nada do motor.** Função pura, isolada.

**Commit 3 — Plugar no motor (aguarda aceite das 4 decisões deste ADR)**

- Em `engine.ts:951` (`buildFactoryPlanningData`), após `buildPlannedItems`:
  ```ts
  const orderItems = buildPlannedItems(...);
  const expandedItems = process.env.EXPAND_MPI_INTO_OPS === "true"
    ? expandRecipeIntoItems(orderItems, source.products, source.ingredients)
    : orderItems;
  const { productionOrders, ... } = buildProductionOrdersFromPlannedItems(expandedItems, ...);
  ```
- `productionItemKey` do MPI = `${date}|${lineId}|${scheduleId}|${mpiProductId}` (formato padrão, productId distinto). Nenhum ajuste em `workflow.ts:197` necessário.
- 3 testes de integração em `engine.test.ts`:
  1. Pedido de pizza com receita de massa → motor gera 2 OPs (pizza, massa) com mesma planning key.
  2. 5 pedidos de pizza → 1 OP de pizza (somada) + 1 OP de massa (somada).
  3. Feature flag desligada → comportamento idêntico ao atual.
- Atualiza `Docs/11 - Ajustes/Backlog de Ajustes.md` AJ-0008: status vira **Concluído / atrás de flag**.

### Migração necessária
**Nenhuma.** `production_item_key` é string composta runtime; nova subchave é compatível com todos os índices existentes.

### Riscos e mitigações

| Risco | Mitigação |
|---|---|
| 🔴 Ciclos de receita (MPI A → MPI B → MPI A) | `Set<visitedProductIds>` + `depth máx=4` na expansão. Log de warning ao abortar. |
| 🟠 Performance em escala | Hoje 7 sub-receitas → impacto nulo. Profiling reservado para onda 2. |
| 🟠 Multi-tenancy/RLS | Expansão acontece em memória pós-`createTenantScopedSupabaseClient`. Risco zero enquanto não fizer query nova. Code review obrigatório se alguém adicionar lookup direto. |
| 🟡 Confusão de cadastro (dupla representação) | Já tem legenda do AJ-0020. Documentar em `regras-de-negocio/` que **a MPI canônica é produto-MPI**. |
| 🟡 `availableForOrdering` em MPIs | Hoje 5 dos 6 MPIs estão visíveis na loja. **Fora de escopo deste ADR** — abrir AJ separado se for problema. |
| 🟡 Cache de 10s em `planning-snapshot.ts:14` | Comportamento existente, sem regressão. Sub-receita nova demora até 10s para refletir. |

## Mapa de impacto

| Camada | Impacto |
|---|---|
| **DB** | Nenhuma migração. `production_item_key` continua string composta. |
| **API** | `PATCH /api/factory-planning/workflow` inalterado. `releaseOrder` opera por `order_id`, libera implicitamente OPs de MPI. |
| **Motor** | Novo passo `expandRecipeIntoItems` entre `buildPlannedItems` e `buildProductionOrdersFromPlannedItems`. Atrás de feature flag. |
| **Workflow** | `resolvePreparationStagesForProductionItem` precisa parsear sufixo `mpi:`. |
| **UI gestor-fábrica** | OPs de MPI aparecem na lista/Kanban com badge "MPI" e lista `usedBy: [pizza, …]` (próxima onda — fora deste ADR). |
| **UI chão-fábrica** | OPs de MPI ficam na lista do dia com badge. |
| **UI loja** | Nenhuma mudança. Loja segue pedindo produto final. |
| **PDF pré-pesagem** | Simplifica: quando MPI vira OP, deixa de aparecer como "Produto Ingrediente" no PDF do pai (cada OP tem seu PDF). Refactor de `printing-documents.ts:285-321`. Onda 2. |
| **Testes** | +5 testes em `recipe-expansion.test.ts`, +3 em `engine.test.ts`. Os 14 testes atuais do engine seguem passando. |

## Consequências

- AJ-0008 sai do limbo "investigado / a-decidir" para "implementado atrás de flag".
- O cliente Daniel ganha a OP separada que ele esperava na call.
- O caminho B (ingrediente misturado) **continua sem virar OP** — documentar isso explicitamente em [[Regra — Pedido da Loja]] para evitar nova reclamação.
- Operadores precisam re-cadastrar "Massa de Pizza" como produto-MPI (não como ingrediente misturado) para o caso da call funcionar — Giuseppe pode fazer isso direto no banco dev como parte do PR.
- A fase 1 não cobre lead-time de MPI nem armazenamento (`allows_storage`) — fica para [[Backlog de Ajustes#AJ-0021]] / fase 2.
- Feature flag fica como contrato com o cliente: **ativada só após Daniel testar e validar**.

## Próximos passos

1. Giuseppe aprova (ou ajusta) os 4 defaults defendidos neste ADR.
2. PR de spike abre — commits 1 e 2 vão direto (não dependem das decisões).
3. Após aprovação, commit 3 plugando no motor + 3 testes de integração.
4. Demo pro Daniel com `EXPAND_MPI_INTO_OPS=true` em ambiente dev.
5. Se Daniel aprovar, atualizar AJ-0008 e ligar a flag em produção.
6. Onda 2 (fora deste ADR): UI da OP de MPI com badge, simplificar PDF, ingrediente-misturado, lead-time, performance/profiling.

## Fase 2 — concluída 2026-05-21

Entregue dentro da iniciativa de automação A1-A8 (frente A4) — ver
[[ADR_iniciativa_automacao_pedido_entrega]].

### O que mudou

A fase 1 tinha como **limitação consciente** rodar a OP do MPI na mesma
planning key do pai — o `lineId` e `scheduleId` eram herdados. Isso bloqueava
o caso real onde a fábrica tem **linha dedicada para MPI** (ex: massa de
pizza produzida em outra linha que o produto final).

A fase 2 ativa resolução de linha nativa do MPI:

```ts
// recipe-expansion.ts:169 (resumido)
const nativeLineId = mpiProduct.operationalLineId ?? mpiProduct.lineId ?? null;
```

Comportamento:

- **Cadastro novo (linha nativa preenchida):** se `nativeLineId` difere da
  linha do pai, MPI vai pra essa linha. O `scheduleId` do pai é
  **descartado** (vira `null`) — schedule pertence à linha do pai e não pode
  ser reaproveitado em outra linha. O motor resolve o schedule da linha nova
  por padrão.
- **Cadastro fase 1 (sem linha nativa):** comportamento idêntico ao da fase 1
  — MPI roda na linha do pai, schedule herdado. Zero regressão.

### Por que descartar o schedule do pai

A invariante "schedule pertence à linha" é load-bearing — o motor agrupa OPs
por `(date|lineId|scheduleId)`. Reaproveitar o `scheduleId` do pai quando a
linha muda geraria planning key com schedule de outra linha, o que quebra:

- Filtro por linha no kanban (OP apareceria com schedule "estranho").
- Resolução de `defaultProductPreparationStages` (que pode depender da
  linha).
- Consistência do snapshot — duas OPs com mesma planning key parcial mas
  schedule de linhas diferentes.

### Testes adicionados

3 testes em `recipe-expansion.test.ts`:

1. **MPI com linha nativa diferente** → expansão grava `lineId` do MPI e
   descarta `scheduleId`.
2. **MPI com mesma linha do pai** → herda schedule (mesmo da fase 1).
3. **MPI sem `operationalLineId`/`lineId`** → fallback para linha do pai
   (compatibilidade fase 1).

Soma com a cobertura da fase 1 → 5 testes da função pura + 3 testes de
integração no motor.

### Consequência para AJ-0008

Pode ser marcado como **100% concluído** (fase 1 + fase 2). A "Limitação
conhecida" registrada no histórico da Onda 2 está fechada. O cliente que
quiser MPI em linha dedicada já consegue cadastrar — basta preencher
`operationalLineId` ou `lineId` no produto-MPI.

### O que **continua** fora de escopo

- **Lead-time da MPI** (produzir a MPI no dia D-1 do produto final). Continua
  na onda 3 — quando entrar [[Backlog de Ajustes#AJ-0021 — Armazenamento / produção sob estoque (shelf life)|AJ-0021]].
- **Caminho B (`ingredients.type='misturado'`)** continua sem virar OP.
  Composição interna na folha de pré-pesagem, conforme decidido na fase 1.
