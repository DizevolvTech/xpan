drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = auth_user_id
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = auth_user_id
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
)
with check (
  (select auth.uid()) = auth_user_id
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
);

drop policy if exists permission_modules_select_authenticated on public.permission_modules;
create policy permission_modules_select_authenticated
on public.permission_modules
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists categories_insert_manager_scope on public.categories;
drop policy if exists categories_update_manager_scope on public.categories;
drop policy if exists categories_manage_catalog_admin on public.categories;
drop policy if exists categories_delete_manager_scope on public.categories;

create policy categories_insert_manager_scope
on public.categories
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy categories_update_manager_scope
on public.categories
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy categories_delete_manager_scope
on public.categories
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists subcategories_insert_manager_scope on public.subcategories;
drop policy if exists subcategories_update_manager_scope on public.subcategories;
drop policy if exists subcategories_manage_catalog_admin on public.subcategories;
drop policy if exists subcategories_delete_manager_scope on public.subcategories;

create policy subcategories_insert_manager_scope
on public.subcategories
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy subcategories_update_manager_scope
on public.subcategories
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy subcategories_delete_manager_scope
on public.subcategories
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists stores_insert_manager_scope on public.stores;
drop policy if exists stores_update_manager_scope on public.stores;
drop policy if exists stores_manage_catalog_admin on public.stores;
drop policy if exists stores_delete_manager_scope on public.stores;

create policy stores_insert_manager_scope
on public.stores
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy stores_update_manager_scope
on public.stores
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy stores_delete_manager_scope
on public.stores
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists profile_store_access_manage_admin on public.profile_store_access;
drop policy if exists profile_store_access_insert_admin on public.profile_store_access;
drop policy if exists profile_store_access_update_admin on public.profile_store_access;
drop policy if exists profile_store_access_delete_admin on public.profile_store_access;

create policy profile_store_access_insert_admin
on public.profile_store_access
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.is_admin()
);

create policy profile_store_access_update_admin
on public.profile_store_access
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_admin()
)
with check (
  tenant_id = public.current_tenant_id()
  and public.is_admin()
);

create policy profile_store_access_delete_admin
on public.profile_store_access
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_admin()
);

drop policy if exists operational_settings_manage_catalog_admin on public.operational_settings;
drop policy if exists operational_settings_insert_catalog_admin on public.operational_settings;
drop policy if exists operational_settings_update_catalog_admin on public.operational_settings;
drop policy if exists operational_settings_delete_catalog_admin on public.operational_settings;

create policy operational_settings_insert_catalog_admin
on public.operational_settings
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy operational_settings_update_catalog_admin
on public.operational_settings
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy operational_settings_delete_catalog_admin
on public.operational_settings
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists ingredients_insert_manager_scope on public.ingredients;
drop policy if exists ingredients_update_manager_scope on public.ingredients;
drop policy if exists ingredients_manage_catalog_admin on public.ingredients;
drop policy if exists ingredients_delete_manager_scope on public.ingredients;

create policy ingredients_insert_manager_scope
on public.ingredients
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy ingredients_update_manager_scope
on public.ingredients
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy ingredients_delete_manager_scope
on public.ingredients
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists ingredient_components_insert_manager_scope on public.ingredient_components;
drop policy if exists ingredient_components_delete_manager_scope on public.ingredient_components;
drop policy if exists ingredient_components_manage_catalog_admin on public.ingredient_components;
drop policy if exists ingredient_components_update_manager_scope on public.ingredient_components;

create policy ingredient_components_insert_manager_scope
on public.ingredient_components
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy ingredient_components_update_manager_scope
on public.ingredient_components
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy ingredient_components_delete_manager_scope
on public.ingredient_components
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists products_insert_manager_scope on public.products;
drop policy if exists products_update_manager_scope on public.products;
drop policy if exists products_manage_catalog_admin on public.products;
drop policy if exists products_delete_manager_scope on public.products;

create policy products_insert_manager_scope
on public.products
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy products_update_manager_scope
on public.products
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy products_delete_manager_scope
on public.products
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists product_preparation_steps_manage_catalog_admin on public.product_preparation_steps;
drop policy if exists product_preparation_steps_insert_manager_scope on public.product_preparation_steps;
drop policy if exists product_preparation_steps_update_manager_scope on public.product_preparation_steps;
drop policy if exists product_preparation_steps_delete_manager_scope on public.product_preparation_steps;

create policy product_preparation_steps_insert_manager_scope
on public.product_preparation_steps
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy product_preparation_steps_update_manager_scope
on public.product_preparation_steps
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy product_preparation_steps_delete_manager_scope
on public.product_preparation_steps
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists product_recipe_items_insert_manager_scope on public.product_recipe_items;
drop policy if exists product_recipe_items_delete_manager_scope on public.product_recipe_items;
drop policy if exists product_recipe_items_manage_catalog_admin on public.product_recipe_items;
drop policy if exists product_recipe_items_update_manager_scope on public.product_recipe_items;

create policy product_recipe_items_insert_manager_scope
on public.product_recipe_items
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy product_recipe_items_update_manager_scope
on public.product_recipe_items
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy product_recipe_items_delete_manager_scope
on public.product_recipe_items
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists schedule_lines_update_factory_scope on public.schedule_lines;
drop policy if exists schedule_lines_manage_catalog_admin on public.schedule_lines;
drop policy if exists schedule_lines_insert_manager_scope on public.schedule_lines;
drop policy if exists schedule_lines_update_by_scope on public.schedule_lines;
drop policy if exists schedule_lines_delete_manager_scope on public.schedule_lines;

create policy schedule_lines_insert_manager_scope
on public.schedule_lines
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy schedule_lines_update_by_scope
on public.schedule_lines
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
);

create policy schedule_lines_delete_manager_scope
on public.schedule_lines
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists schedule_line_item_snapshots_manage_catalog_admin on public.schedule_line_item_snapshots;
drop policy if exists schedule_line_item_snapshots_insert_manager_scope on public.schedule_line_item_snapshots;
drop policy if exists schedule_line_item_snapshots_update_manager_scope on public.schedule_line_item_snapshots;
drop policy if exists schedule_line_item_snapshots_delete_manager_scope on public.schedule_line_item_snapshots;

create policy schedule_line_item_snapshots_insert_manager_scope
on public.schedule_line_item_snapshots
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy schedule_line_item_snapshots_update_manager_scope
on public.schedule_line_item_snapshots
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

create policy schedule_line_item_snapshots_delete_manager_scope
on public.schedule_line_item_snapshots
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists user_permissions_manage_admin on public.user_permissions;
drop policy if exists user_permissions_insert_admin on public.user_permissions;
drop policy if exists user_permissions_update_admin on public.user_permissions;
drop policy if exists user_permissions_delete_admin on public.user_permissions;

create policy user_permissions_insert_admin
on public.user_permissions
for insert
to authenticated
with check (
  tenant_id is not null
  and tenant_id = public.current_tenant_id()
  and public.is_admin()
);

create policy user_permissions_update_admin
on public.user_permissions
for update
to authenticated
using (
  tenant_id is not null
  and tenant_id = public.current_tenant_id()
  and public.is_admin()
)
with check (
  tenant_id is not null
  and tenant_id = public.current_tenant_id()
  and public.is_admin()
);

create policy user_permissions_delete_admin
on public.user_permissions
for delete
to authenticated
using (
  tenant_id is not null
  and tenant_id = public.current_tenant_id()
  and public.is_admin()
);

drop policy if exists workflow_order_releases_manage_factory_or_admin on public.workflow_order_releases;
drop policy if exists workflow_order_releases_insert_factory_or_admin on public.workflow_order_releases;
drop policy if exists workflow_order_releases_update_factory_or_admin on public.workflow_order_releases;
drop policy if exists workflow_order_releases_delete_factory_or_admin on public.workflow_order_releases;

create policy workflow_order_releases_insert_factory_or_admin
on public.workflow_order_releases
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy workflow_order_releases_update_factory_or_admin
on public.workflow_order_releases
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy workflow_order_releases_delete_factory_or_admin
on public.workflow_order_releases
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists workflow_production_items_manage_factory_scope on public.workflow_production_items;
drop policy if exists workflow_production_items_insert_factory_scope on public.workflow_production_items;
drop policy if exists workflow_production_items_update_factory_scope on public.workflow_production_items;
drop policy if exists workflow_production_items_delete_factory_scope on public.workflow_production_items;

create policy workflow_production_items_insert_factory_scope
on public.workflow_production_items
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy workflow_production_items_update_factory_scope
on public.workflow_production_items
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy workflow_production_items_delete_factory_scope
on public.workflow_production_items
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists delivery_executions_manage_factory_scope on public.delivery_executions;
drop policy if exists delivery_executions_insert_factory_scope on public.delivery_executions;
drop policy if exists delivery_executions_update_factory_scope on public.delivery_executions;
drop policy if exists delivery_executions_delete_factory_scope on public.delivery_executions;

create policy delivery_executions_insert_factory_scope
on public.delivery_executions
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy delivery_executions_update_factory_scope
on public.delivery_executions
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy delivery_executions_delete_factory_scope
on public.delivery_executions
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);
