-- Quadro #232: marcacao "Participa da coccao" por insumo da receita.
-- Nulo = sem escolha gravada: o calculo usa o padrao da etapa (as etapas de massa participam,
-- operacional e acabamento nao), que e exatamente o que a quebra ja fazia. Assim nenhum produto
-- existente muda de numero ate alguem marcar ou desmarcar o insumo.
-- A coluna break_stage (antes/depois da divisao) continua no banco, sem uso na tela.

alter table public.product_recipe_items
  add column if not exists participates_in_cooking boolean;
