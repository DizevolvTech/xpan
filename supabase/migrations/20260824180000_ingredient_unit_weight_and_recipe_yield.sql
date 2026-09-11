-- Checklist 12/08/2026 itens 4 e 5: peso/rendimento real da unidade e da MPI.
--
-- Ingredientes em Un/Dz/etc. não tinham peso cadastrado — o motor tratava 1 Un como 1 kg.
-- Ingredientes misturados também não tinham rendimento declarado da batelada.
--
-- Produto MPI guarda o rendimento em `ingredient_profile.recipeYieldKg` (JSONB, sem coluna).

alter table public.ingredients
  add column if not exists weight_kg numeric(12, 6);

alter table public.ingredients
  add column if not exists recipe_yield_kg numeric(12, 6);

alter table public.ingredients
  drop constraint if exists ingredients_weight_kg_positive;

alter table public.ingredients
  add constraint ingredients_weight_kg_positive
  check (weight_kg is null or weight_kg > 0);

alter table public.ingredients
  drop constraint if exists ingredients_recipe_yield_kg_positive;

alter table public.ingredients
  add constraint ingredients_recipe_yield_kg_positive
  check (recipe_yield_kg is null or recipe_yield_kg > 0);
