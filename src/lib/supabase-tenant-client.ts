import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertTenantId, type SupabaseDataClient } from "@/lib/supabase-data/common";

const tenantOwnedTables = new Set([
  "profiles",
  "user_permissions",
  "operational_settings",
  "stores",
  "profile_store_access",
  "categories",
  "subcategories",
  "schedule_lines",
  "schedule_line_item_snapshots",
  "ingredients",
  "ingredient_components",
  "products",
  "product_recipe_items",
  "product_preparation_steps",
  "product_changelog",
  "production_line_types",
  "store_orders",
  "store_order_items",
  "workflow_order_releases",
  "workflow_production_items",
  "workflow_production_starts",
  "workflow_production_batches",
  "delivery_executions",
  "delivery_attempts",
  "store_occurrences",
  "store_order_events",
  "store_occurrence_events",
  "tenant_support_occurrences",
  "tenant_support_occurrence_events",
  "business_code_sequences",
  "production_leftovers",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function injectTenantIntoPayload<T>(payload: T, tenantId: string): T {
  if (Array.isArray(payload)) {
    return payload.map((entry) => injectTenantIntoPayload(entry, tenantId)) as T;
  }

  if (!isRecord(payload)) {
    return payload;
  }

  if ("tenant_id" in payload) {
    return payload as T;
  }

  return {
    ...payload,
    tenant_id: tenantId,
  } as T;
}

function injectTenantIntoOnConflict(
  options: Record<string, unknown> | undefined,
) {
  if (!options) {
    return options;
  }

  const onConflict = typeof options.onConflict === "string" ? options.onConflict : "";
  if (!onConflict) {
    return options;
  }

  const columns = onConflict
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  if (columns.includes("tenant_id")) {
    return options;
  }

  return {
    ...options,
    onConflict: ["tenant_id", ...columns].join(","),
  };
}

function wrapTenantBuilder(
  table: string,
  builder: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== "function") {
        return value;
      }

      if (prop === "select" || prop === "update" || prop === "delete") {
        return (...args: unknown[]) => {
          const result = Reflect.apply(value, target, args) as Record<string, unknown>;
          if (typeof result.eq === "function") {
            const scoped = Reflect.apply(result.eq as (...eqArgs: unknown[]) => unknown, result, [
              "tenant_id",
              tenantId,
            ]) as Record<string, unknown>;
            return wrapTenantBuilder(table, scoped, tenantId);
          }

          return wrapTenantBuilder(table, result, tenantId);
        };
      }

      if (prop === "insert") {
        return (payload: unknown, ...args: unknown[]) =>
          wrapTenantBuilder(
            table,
            Reflect.apply(value, target, [injectTenantIntoPayload(payload, tenantId), ...args]) as Record<
              string,
              unknown
            >,
            tenantId,
          );
      }

      if (prop === "upsert") {
        return (payload: unknown, options?: Record<string, unknown>) =>
          wrapTenantBuilder(
            table,
            Reflect.apply(value, target, [
              injectTenantIntoPayload(payload, tenantId),
              injectTenantIntoOnConflict(options),
            ]) as Record<string, unknown>,
            tenantId,
          );
      }

      return (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args);

        if (result && typeof result === "object") {
          return wrapTenantBuilder(table, result as Record<string, unknown>, tenantId);
        }

        return result;
      };
    },
  });
}

export function createTenantScopedSupabaseClient(
  tenantId: string | null | undefined,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): SupabaseDataClient {
  const resolvedTenantId = assertTenantId(tenantId);

  return new Proxy(supabase as unknown as Record<string, unknown>, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== "function") {
        return value;
      }

      if (prop === "from") {
        return (table: string) => {
          const query = Reflect.apply(value, target, [table]) as Record<string, unknown>;

          if (!tenantOwnedTables.has(table)) {
            return query;
          }

          return wrapTenantBuilder(table, query, resolvedTenantId);
        };
      }

      if (prop === "rpc") {
        return (fn: string, args?: Record<string, unknown>, ...rest: unknown[]) => {
          const nextArgs =
            fn === "next_business_code_number"
              ? {
                  ...(args ?? {}),
                  p_tenant_id: resolvedTenantId,
                }
              : args;

          return Reflect.apply(value, target, [fn, nextArgs, ...rest]);
        };
      }

      return (...args: unknown[]) => Reflect.apply(value, target, args);
    },
  }) as unknown as SupabaseDataClient;
}
