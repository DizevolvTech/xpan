drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
on public.profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists categories_insert_manager_scope on public.categories;
create policy categories_insert_manager_scope
on public.categories
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists categories_update_manager_scope on public.categories;
create policy categories_update_manager_scope
on public.categories
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists subcategories_insert_manager_scope on public.subcategories;
create policy subcategories_insert_manager_scope
on public.subcategories
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists subcategories_update_manager_scope on public.subcategories;
create policy subcategories_update_manager_scope
on public.subcategories
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists stores_insert_manager_scope on public.stores;
create policy stores_insert_manager_scope
on public.stores
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists stores_update_manager_scope on public.stores;
create policy stores_update_manager_scope
on public.stores
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists ingredients_insert_manager_scope on public.ingredients;
create policy ingredients_insert_manager_scope
on public.ingredients
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists ingredients_update_manager_scope on public.ingredients;
create policy ingredients_update_manager_scope
on public.ingredients
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists ingredient_components_insert_manager_scope on public.ingredient_components;
create policy ingredient_components_insert_manager_scope
on public.ingredient_components
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists ingredient_components_delete_manager_scope on public.ingredient_components;
create policy ingredient_components_delete_manager_scope
on public.ingredient_components
for delete
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists products_insert_manager_scope on public.products;
create policy products_insert_manager_scope
on public.products
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists products_update_manager_scope on public.products;
create policy products_update_manager_scope
on public.products
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists product_recipe_items_insert_manager_scope on public.product_recipe_items;
create policy product_recipe_items_insert_manager_scope
on public.product_recipe_items
for insert
to authenticated
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists product_recipe_items_delete_manager_scope on public.product_recipe_items;
create policy product_recipe_items_delete_manager_scope
on public.product_recipe_items
for delete
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);

drop policy if exists schedule_lines_update_factory_scope on public.schedule_lines;
create policy schedule_lines_update_factory_scope
on public.schedule_lines
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
