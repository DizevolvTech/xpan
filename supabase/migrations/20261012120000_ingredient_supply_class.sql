-- Classe do insumo (Gestão de Insumos): MP, ME e MC. MPI continua sendo PRODUTO marcado
-- "pode ser insumo" (não é gravado aqui). Aditivo: todo insumo existente vira MP (matéria-prima),
-- o padrão correto para o que já está cadastrado (farinha, açúcar, ovos…); o cliente reclassifica.
-- Nenhum cálculo lê esta coluna: ela só classifica e sugere a etapa na ficha técnica.

alter table public.ingredients
  add column if not exists supply_class text not null default 'MP';

alter table public.ingredients
  drop constraint if exists ingredients_supply_class_check;

alter table public.ingredients
  add constraint ingredients_supply_class_check
  check (supply_class = any (array['MP', 'ME', 'MC']));
