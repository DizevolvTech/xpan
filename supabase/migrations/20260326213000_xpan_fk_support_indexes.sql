create index if not exists idx_ingredient_components_ingredient_id
on public.ingredient_components (ingredient_id);

create index if not exists idx_ingredient_components_ingredient_reference_id
on public.ingredient_components (ingredient_reference_id);

create index if not exists idx_ingredient_components_product_reference_id
on public.ingredient_components (product_reference_id);

create index if not exists idx_product_preparation_steps_product_id
on public.product_preparation_steps (product_id);

create index if not exists idx_product_recipe_items_product_id
on public.product_recipe_items (product_id);

create index if not exists idx_product_recipe_items_ingredient_source_id
on public.product_recipe_items (ingredient_source_id);

create index if not exists idx_product_recipe_items_product_source_id
on public.product_recipe_items (product_source_id);

create index if not exists idx_schedule_line_item_snapshots_product_id
on public.schedule_line_item_snapshots (product_id);

create index if not exists idx_schedule_lines_created_by_profile_id
on public.schedule_lines (created_by_profile_id);

create index if not exists idx_schedule_lines_audited_by_profile_id
on public.schedule_lines (audited_by_profile_id);

create index if not exists idx_schedule_lines_deactivated_by_profile_id
on public.schedule_lines (deactivated_by_profile_id);

create index if not exists idx_schedule_lines_revision_of_id
on public.schedule_lines (revision_of_id);
