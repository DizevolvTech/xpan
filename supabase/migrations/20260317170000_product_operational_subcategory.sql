alter table public.products
add column if not exists operational_subcategory_id uuid references public.subcategories(id) on delete set null;

create index if not exists idx_products_operational_subcategory
on public.products(operational_subcategory_id);

update public.products
set operational_subcategory_id = subcategory_id
where operational_subcategory_id is null;
