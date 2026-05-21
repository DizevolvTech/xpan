-- AJ-A8: Roteirização básica de entregas.
-- Sem endereço/CEP/geo no schema atual, adicionamos um campo opcional de zona
-- de entrega (texto livre — "Centro", "Norte", "Industrial", etc.) que o
-- gestor preenche manualmente por loja. Quando vazio, a roteirização
-- agrupa pela janela de recebimento (`receive_window`) como fallback.

alter table public.stores
  add column if not exists delivery_zone text;

create index if not exists idx_stores_tenant_delivery_zone
on public.stores (tenant_id, delivery_zone)
where delivery_zone is not null;
