-- The API validates permissions, store scope, catalog and quantities before this
-- service-role-only transaction. Receipts make retries safe after a lost response.
create table public.centralized_order_receipts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, request_id)
);
alter table public.centralized_order_receipts enable row level security;
revoke all on public.centralized_order_receipts from anon, authenticated;
grant all on public.centralized_order_receipts to service_role;

create or replace function public.create_centralized_orders(
  p_tenant_id uuid, p_actor_id uuid, p_request_id uuid, p_source text, p_orders jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  entry jsonb;
  item jsonb;
  order_id_value uuid;
  legacy text;
  result_value jsonb := '[]'::jsonb;
begin
  if p_tenant_id is null or p_request_id is null or jsonb_typeof(p_orders) <> 'array'
     or jsonb_array_length(p_orders) = 0 then
    raise exception 'Lançamento inválido';
  end if;
  -- Serialize factory submissions for a tenant, including retries of one request.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));
  select result into result_value from centralized_order_receipts
    where tenant_id = p_tenant_id and request_id = p_request_id;
  if found then return result_value; end if;
  result_value := '[]'::jsonb;

  for entry in select value from jsonb_array_elements(p_orders) loop
    if not exists(select 1 from stores where id = (entry->>'store_id')::uuid and tenant_id = p_tenant_id) then
      raise exception 'Loja não pertence à operação';
    end if;
    if exists(select 1 from store_orders where tenant_id = p_tenant_id
      and store_id = (entry->>'store_id')::uuid and delivery_date = (entry->>'delivery_date')::date
      and management_status = 'ativo') then
      raise exception 'Já existe um pedido ativo para uma das lojas na data selecionada. Revise os pedidos existentes.';
    end if;
    if jsonb_array_length(entry->'items') = 0 then raise exception 'Pedido sem itens'; end if;
    legacy := 'order-' || gen_random_uuid()::text;
    insert into store_orders(tenant_id, legacy_id, code, store_id, created_by_profile_id,
      ordered_at, base_date, delivery_date, opened_at, receive_window_snapshot, expedition_lead_days_snapshot, note, status)
    values(p_tenant_id, legacy, entry->>'code', (entry->>'store_id')::uuid, p_actor_id,
      now(), (entry->>'base_date')::date, (entry->>'delivery_date')::date, now(),
      entry->>'receive_window', (entry->>'expedition_lead_days')::integer,
      'Entrada ' || p_source, 'preenchido') returning id into order_id_value;

    for item in select value from jsonb_array_elements(entry->'items') loop
      if not exists(select 1 from products where id = (item->>'product_id')::uuid and tenant_id = p_tenant_id)
        or (item->>'quantity')::numeric <= 0 then
        raise exception 'Produto ou quantidade inválidos';
      end if;
      insert into store_order_items(tenant_id, legacy_id, order_id, product_id, product_code_snapshot,
        product_name_snapshot, requested_quantity, requested_unit, sales_to_kg_factor_snapshot,
        internal_kg_snapshot, expedition_unit_snapshot, expedition_to_kg_factor_snapshot, operational_unit_snapshot)
      values(p_tenant_id, 'item-' || gen_random_uuid()::text, order_id_value, (item->>'product_id')::uuid,
        item->>'code', item->>'name', (item->>'quantity')::numeric, (item->>'unit')::unit_code,
        (item->>'sales_factor')::numeric, round((item->>'quantity')::numeric * (item->>'sales_factor')::numeric, 3),
        (item->>'expedition_unit')::unit_code, (item->>'expedition_factor')::numeric, (item->>'production_unit')::unit_code);
    end loop;
    insert into store_order_events(tenant_id, order_id, event_type, title, description, created_by_profile_id, metadata)
      values(p_tenant_id, order_id_value, 'criacao', 'Pedido criado', 'Entrada ' || p_source, p_actor_id,
        jsonb_build_object('requestId', p_request_id));
    result_value := result_value || jsonb_build_array(jsonb_build_object('orderId', legacy, 'code', entry->>'code'));
  end loop;
  insert into centralized_order_receipts(tenant_id, request_id, result) values(p_tenant_id, p_request_id, result_value);
  return result_value;
end;
$$;
revoke all on function public.create_centralized_orders(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_centralized_orders(uuid, uuid, uuid, text, jsonb) to service_role;
