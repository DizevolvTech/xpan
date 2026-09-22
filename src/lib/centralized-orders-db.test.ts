import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("transação centralizada: isolamento, rollback integral e confirmação idempotente", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create type unit_code as enum ('Un','Kg');
      create table tenants(id uuid primary key);
      create table stores(id uuid primary key, tenant_id uuid);
      create table products(id uuid primary key, tenant_id uuid);
      create table store_orders(id uuid primary key default gen_random_uuid(), tenant_id uuid,
        legacy_id text, code text, store_id uuid, created_by_profile_id uuid, ordered_at timestamptz,
        base_date date, delivery_date date, opened_at timestamptz, receive_window_snapshot text,
        expedition_lead_days_snapshot int, note text, status text, management_status text default 'ativo');
      create table store_order_items(id uuid default gen_random_uuid(), tenant_id uuid, legacy_id text,
        order_id uuid references store_orders(id), product_id uuid, product_code_snapshot text,
        product_name_snapshot text, requested_quantity numeric, requested_unit unit_code,
        sales_to_kg_factor_snapshot numeric, internal_kg_snapshot numeric, expedition_unit_snapshot unit_code,
        expedition_to_kg_factor_snapshot numeric, operational_unit_snapshot unit_code);
      create table store_order_events(tenant_id uuid, order_id uuid, event_type text, title text,
        description text, created_by_profile_id uuid, metadata jsonb);
    `);
    await db.exec(await readFile("supabase/migrations/20260922120000_product_max_batch_weight.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/20260922121000_centralized_orders.sql", "utf8"));
    const tenant = "00000000-0000-4000-8000-000000000001";
    const store1 = "00000000-0000-4000-8000-000000000002";
    const store2 = "00000000-0000-4000-8000-000000000003";
    const product = "00000000-0000-4000-8000-000000000004";
    const foreign = "00000000-0000-4000-8000-000000000005";
    await db.query("insert into tenants values ($1)", [tenant]);
    await db.query("insert into stores values ($1,$3),($2,$3)", [store1, store2, tenant]);
    await db.query("insert into products(id,tenant_id) values ($1,$2)", [product, tenant]);
    const order = (store: string, productId = product) => ({ store_id: store, code: store,
      base_date: "2026-09-22", delivery_date: "2026-09-24", receive_window: "Manhã", expedition_lead_days: 1,
      items: [{ product_id: productId, quantity: 250, unit: "Un", code: "PR01", name: "Bolo",
        sales_factor: .5, expedition_unit: "Un", expedition_factor: .5, production_unit: "Kg" }],
    });
    const call = (id: string, orders: unknown[]) => db.query("select create_centralized_orders($1,null,$2,'excel',$3::jsonb) as result", [tenant, id, JSON.stringify(orders)]);
    const request1 = "00000000-0000-4000-8000-000000000006";
    await assert.rejects(() => call(request1, [order(store1), order(store2, foreign)]), /Produto/);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from store_orders")).rows[0].count, 0);
    const first = await call(request1, [order(store1), order(store2)]);
    const retry = await call(request1, [order(store1), order(store2)]);
    assert.deepEqual(retry.rows, first.rows);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from store_orders")).rows[0].count, 2);
    assert.equal((await db.query<{ total: number }>("select sum(requested_quantity)::int as total from store_order_items")).rows[0].total, 500);
    await assert.rejects(() => call(foreign, [order(store1)]), /pedido ativo/);
    await assert.rejects(() => db.query("update products set max_batch_weight_kg = -1"), /check constraint/);
    await db.query("update products set max_batch_weight_kg = 80");
    assert.equal(Number((await db.query<{ max_batch_weight_kg: string }>("select max_batch_weight_kg from products")).rows[0].max_batch_weight_kg), 80);
  } finally { await db.close(); }
});
