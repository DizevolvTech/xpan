-- Separate total mixer capacity from the legacy main-ingredient limit.
alter table public.products add column if not exists max_batch_weight_kg numeric;
alter table public.products add constraint products_max_batch_weight_positive
  check (max_batch_weight_kg is null or (max_batch_weight_kg > 0 and max_batch_weight_kg <> 'NaN'::numeric));
comment on column public.products.max_batch_weight_kg is
  'XPAN-04: maximum total mixer load in kg; selected recipe ingredients determine whole units per batch.';
