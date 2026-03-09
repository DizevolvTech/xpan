create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select profiles.role
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.status = 'ativo'
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'administrador'::public.user_role;
$$;

create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_user_role() in (
      'administrador'::public.user_role,
      'gestor-dados'::public.user_role,
      'gestor-fabrica'::public.user_role,
      'chao-fabrica'::public.user_role
    ) then true
    when public.current_user_role() = 'loja'::public.user_role then exists (
      select 1
      from public.profile_store_access
      where profile_store_access.profile_id = public.current_profile_id()
        and profile_store_access.store_id = target_store_id
    )
    else false
  end;
$$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_store(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.permission_modules enable row level security;
alter table public.user_permissions enable row level security;
alter table public.operational_settings enable row level security;
alter table public.stores enable row level security;
alter table public.profile_store_access enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.schedule_lines enable row level security;
alter table public.schedule_line_item_snapshots enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_components enable row level security;
alter table public.products enable row level security;
alter table public.product_recipe_items enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.workflow_order_releases enable row level security;
alter table public.workflow_production_items enable row level security;
alter table public.delivery_executions enable row level security;
alter table public.store_occurrences enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or public.is_admin()
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or public.is_admin()
)
with check (
  auth.uid() = auth_user_id
  or public.is_admin()
);

drop policy if exists permission_modules_select_authenticated on public.permission_modules;
create policy permission_modules_select_authenticated
on public.permission_modules
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists user_permissions_select_self_or_admin on public.user_permissions;
create policy user_permissions_select_self_or_admin
on public.user_permissions
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists user_permissions_manage_admin on public.user_permissions;
create policy user_permissions_manage_admin
on public.user_permissions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists operational_settings_select_authenticated on public.operational_settings;
create policy operational_settings_select_authenticated
on public.operational_settings
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists stores_select_by_scope on public.stores;
create policy stores_select_by_scope
on public.stores
for select
to authenticated
using (public.can_access_store(id));

drop policy if exists profile_store_access_select_self_or_admin on public.profile_store_access;
create policy profile_store_access_select_self_or_admin
on public.profile_store_access
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists profile_store_access_manage_admin on public.profile_store_access;
create policy profile_store_access_manage_admin
on public.profile_store_access
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated
on public.categories
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists subcategories_select_authenticated on public.subcategories;
create policy subcategories_select_authenticated
on public.subcategories
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists schedule_lines_select_authenticated on public.schedule_lines;
create policy schedule_lines_select_authenticated
on public.schedule_lines
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists schedule_line_item_snapshots_select_authenticated on public.schedule_line_item_snapshots;
create policy schedule_line_item_snapshots_select_authenticated
on public.schedule_line_item_snapshots
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists ingredients_select_authenticated on public.ingredients;
create policy ingredients_select_authenticated
on public.ingredients
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists ingredient_components_select_authenticated on public.ingredient_components;
create policy ingredient_components_select_authenticated
on public.ingredient_components
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
on public.products
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists product_recipe_items_select_authenticated on public.product_recipe_items;
create policy product_recipe_items_select_authenticated
on public.product_recipe_items
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists store_orders_select_by_scope on public.store_orders;
create policy store_orders_select_by_scope
on public.store_orders
for select
to authenticated
using (public.can_access_store(store_id));

drop policy if exists store_orders_insert_store_or_admin on public.store_orders;
create policy store_orders_insert_store_or_admin
on public.store_orders
for insert
to authenticated
with check (
  (
    public.current_user_role() = 'loja'::public.user_role
    and created_by_profile_id = public.current_profile_id()
    and public.can_access_store(store_id)
  )
  or public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists store_orders_update_factory_or_admin on public.store_orders;
create policy store_orders_update_factory_or_admin
on public.store_orders
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'gestor-dados'::public.user_role
  )
  or (
    public.current_user_role() = 'loja'::public.user_role
    and created_by_profile_id = public.current_profile_id()
    and public.can_access_store(store_id)
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'gestor-dados'::public.user_role
  )
  or (
    public.current_user_role() = 'loja'::public.user_role
    and created_by_profile_id = public.current_profile_id()
    and public.can_access_store(store_id)
  )
);

drop policy if exists store_order_items_select_by_scope on public.store_order_items;
create policy store_order_items_select_by_scope
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_items.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_order_items_insert_by_scope on public.store_order_items;
create policy store_order_items_insert_by_scope
on public.store_order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_items.order_id
      and (
        public.current_user_role() in (
          'administrador'::public.user_role,
          'gestor-fabrica'::public.user_role,
          'gestor-dados'::public.user_role
        )
        or (
          public.current_user_role() = 'loja'::public.user_role
          and store_orders.created_by_profile_id = public.current_profile_id()
          and public.can_access_store(store_orders.store_id)
        )
      )
  )
);

drop policy if exists workflow_order_releases_select_by_scope on public.workflow_order_releases;
create policy workflow_order_releases_select_by_scope
on public.workflow_order_releases
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = workflow_order_releases.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists workflow_order_releases_manage_factory_or_admin on public.workflow_order_releases;
create policy workflow_order_releases_manage_factory_or_admin
on public.workflow_order_releases
for all
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists workflow_production_items_select_factory_scope on public.workflow_production_items;
create policy workflow_production_items_select_factory_scope
on public.workflow_production_items
for select
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists workflow_production_items_manage_factory_scope on public.workflow_production_items;
create policy workflow_production_items_manage_factory_scope
on public.workflow_production_items
for all
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists delivery_executions_select_by_scope on public.delivery_executions;
create policy delivery_executions_select_by_scope
on public.delivery_executions
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = delivery_executions.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists delivery_executions_manage_factory_scope on public.delivery_executions;
create policy delivery_executions_manage_factory_scope
on public.delivery_executions
for all
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists store_occurrences_select_by_scope on public.store_occurrences;
create policy store_occurrences_select_by_scope
on public.store_occurrences
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_occurrences_insert_store_or_admin on public.store_occurrences;
create policy store_occurrences_insert_store_or_admin
on public.store_occurrences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and (
        public.current_user_role() in (
          'administrador'::public.user_role,
          'gestor-fabrica'::public.user_role
        )
        or (
          public.current_user_role() = 'loja'::public.user_role
          and store_occurrences.opened_by_profile_id = public.current_profile_id()
          and public.can_access_store(store_orders.store_id)
        )
      )
  )
);

drop policy if exists store_occurrences_update_factory_or_admin on public.store_occurrences;
create policy store_occurrences_update_factory_or_admin
on public.store_occurrences
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
);
