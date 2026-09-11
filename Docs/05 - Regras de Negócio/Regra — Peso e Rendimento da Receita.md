# Peso da unidade e rendimento da receita (MPI)

Receita, custo e ficha técnica usam o **peso/rendimento cadastrado** da unidade. Nunca assumir 1 kg quando a receita pede 1 Un (ou outra unidade discreta) de uma MP/MPI.

## Resumo

1. Se a receita pede **1 Un** de um produto (MPI) ou ingrediente, o motor busca o peso padrão daquela unidade (ex.: 0,170 kg) e converte para kg.
2. MPI pode declarar **Rendimento da Receita (kg)** — o peso real da batelada. Quando a MPI entra em outra receita, quantidades e custo são proporcionais a esse rendimento, não a 1 kg fixo.
3. Sem peso/rendimento cadastrado, o fallback legado (tratar a quantidade como kg) permanece — por isso o campo existe no cadastro.

## Caso Chama (bug silencioso)

Produto: Bolo Confeitado Chama Bento Cake Ninho CP kg.

- Pão de ló na receita: **1 Un**, peso cadastrado **170 g**.
- Demais insumos: **0,221 kg**.
- Peso correto: **0,391 kg**.
- Peso errado (antes): **1,221 kg** = 0,391 − 0,170 + 1,000.

O perfil MPI default `{ unit: "Kg", weightKg: 1 }` sombreava o peso real. A 1ª correção só lia venda em Un — se a MPI continua vendida em Kg e o 170 g está no peso da **embalagem/unidade**, 1 Un ainda virava 1 kg. A unidade da linha da receita também estava travada na venda, impedindo selecionar Un.

## Onde está no código

| Papel | Arquivo |
|---|---|
| Conversão de linha de receita → kg | `src/lib/production-data-utils.ts` — `getRecipeReferenceWeightKgFromData`, `resolveProductDiscreteUnitWeightKg`, `resolveProductRecipeYieldKg` |
| Expansão de MPI na OP | `src/lib/factory-planning/recipe-expansion.ts` — `scaleRecipeQuantity` usa o rendimento declarado |
| Ficha / pré-pesagem | `src/lib/printing-documents.ts` — `convertRecipeRowToKg` |
| Persistência ingrediente | `ingredients.weight_kg`, `ingredients.recipe_yield_kg` (`supabase/migrations/20260824180000_ingredient_unit_weight_and_recipe_yield.sql`) |
| Persistência MPI (produto) | `products.ingredient_profile.recipeYieldKg` (JSONB) |
| UI | `ingredient-form-dialog.tsx`, aba MPI de `product-form-dialog.tsx`, `ingredient-profile-fields.tsx` |

## Algoritmo

Para uma linha de receita em unidade discreta (Un, Dz, …) cujo `sourceType` é produto:

1. Peso de venda/embalagem/perfil/produção/expedição **na mesma unidade discreta**, ignorando o default `1` herdado de Kg.
2. Peso da unidade preenchido no perfil MPI mesmo quando o consumo da MPI é Kg (campo "Peso padrão da unidade").
3. `recipeYieldKg` só se nenhum peso de unidade discreta existir.
4. Nunca usar o `weightKg: 1` travado da venda/perfil em Kg como peso de 1 Un.

A unidade da linha da receita é editável (Kg, L, Un). Ao selecionar Un, o motor busca o peso cadastrado — não copia a venda em Kg.

Para ingrediente em Un: `quantity × weightKg` (ou `recipeYieldKg` se misturado).

Para MPI usada por kg: `scaleRecipeQuantity` divide pelo rendimento declarado (`recipeYieldKg`) quando houver; senão pelo `outputAfterBreakKg` calculado da sub-receita.

## Interações

- Quebra (`breakPercent`) continua aplicada depois da soma em kg (`getProductRecipeTotalsFromData`).
- Fator compra → consumo (ovos Dz → Un) continua em `convertIngredientQuantityToConsumptionUnit`.
- Código ERP obrigatório no cadastro de ingrediente é regra de cadastro, não desta conversão — ver changelog de 2026-08-24.

## Pontos frágeis

> ⚠️ Frágil: ingredientes/MPIs já cadastrados sem `weightKg` / `recipeYieldKg` ainda caem no fallback de 1 kg por unidade desconhecida. O campo no cadastro precisa ser preenchido para o cálculo ficar correto.

> ⚠️ Implícito: rendimento vazio na MPI usa o peso calculado da receita atual (`outputAfterBreakKg`). Se a receita da MPI estiver incompleta, o rendimento implícito também estará.

## Histórico

- 2026-08-25 — checklist Chama 2ª rodada (P0 peso MPI por Un). Ver [[10 - Changelog Vivo/2026-08]].
- 2026-08-24 — checklist Chama 12/08 (itens 4 e 5). Ver [[10 - Changelog Vivo/2026-08]].
