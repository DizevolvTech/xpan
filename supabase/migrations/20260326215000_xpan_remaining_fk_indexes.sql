create index if not exists idx_delivery_executions_updated_by_profile_id
on public.delivery_executions (updated_by_profile_id);

create index if not exists idx_profile_store_access_store_id
on public.profile_store_access (store_id);

create index if not exists idx_store_occurrence_events_created_by_profile_id
on public.store_occurrence_events (created_by_profile_id);

create index if not exists idx_store_occurrences_opened_by_profile_id
on public.store_occurrences (opened_by_profile_id);

create index if not exists idx_store_occurrences_order_item_id
on public.store_occurrences (order_item_id);

create index if not exists idx_store_occurrences_product_id
on public.store_occurrences (product_id);

create index if not exists idx_store_occurrences_resolved_by_profile_id
on public.store_occurrences (resolved_by_profile_id);

create index if not exists idx_store_order_events_created_by_profile_id
on public.store_order_events (created_by_profile_id);

create index if not exists idx_store_order_items_product_id
on public.store_order_items (product_id);

create index if not exists idx_store_orders_cancelled_by_profile_id
on public.store_orders (cancelled_by_profile_id);

create index if not exists idx_store_orders_created_by_profile_id
on public.store_orders (created_by_profile_id);

create index if not exists idx_store_orders_reopened_by_profile_id
on public.store_orders (reopened_by_profile_id);

create index if not exists idx_tenant_support_occurrence_events_created_by_profile_id
on public.tenant_support_occurrence_events (created_by_profile_id);

create index if not exists idx_tenant_support_occurrence_events_tenant_id
on public.tenant_support_occurrence_events (tenant_id);

create index if not exists idx_tenant_support_occurrences_assigned_to_profile_id
on public.tenant_support_occurrences (assigned_to_profile_id);

create index if not exists idx_tenant_support_occurrences_opened_by_profile_id
on public.tenant_support_occurrences (opened_by_profile_id);

create index if not exists idx_user_permissions_module_key
on public.user_permissions (module_key);

create index if not exists idx_workflow_order_releases_released_by_profile_id
on public.workflow_order_releases (released_by_profile_id);

create index if not exists idx_workflow_production_items_updated_by_profile_id
on public.workflow_production_items (updated_by_profile_id);
