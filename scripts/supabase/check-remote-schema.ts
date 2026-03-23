import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const expectedTables = [
  "tenants",
  "profiles",
  "permission_modules",
  "user_permissions",
  "operational_settings",
  "stores",
  "profile_store_access",
  "categories",
  "subcategories",
  "schedule_lines",
  "ingredients",
  "products",
  "schedule_line_item_snapshots",
  "ingredient_components",
  "product_recipe_items",
  "store_orders",
  "store_order_items",
  "workflow_order_releases",
  "workflow_production_items",
  "delivery_executions",
  "store_occurrences",
  "store_order_events",
  "store_occurrence_events",
  "business_code_sequences",
] as const;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const results = await Promise.all(
    expectedTables.map(async (table) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers,
      });

      const body = await response.text();

      return {
        table,
        status: response.status,
        exists: response.status !== 404,
        detail: body.slice(0, 300),
      };
    }),
  );

  const missing = results.filter((result) => !result.exists);
  const existing = results.filter((result) => result.exists);

  console.log(`project=${process.env.SUPABASE_PROJECT_REF ?? "unknown"}`);
  console.log(`existing=${existing.length}`);
  console.log(`missing=${missing.length}`);

  for (const result of results) {
    console.log(
      `${result.exists ? "OK" : "MISSING"} ${result.table} status=${result.status}`,
    );
  }

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
