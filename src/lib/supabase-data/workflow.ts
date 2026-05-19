import "server-only";

import type { ProductionItemStatus } from "@/lib/order-planning";
import { buildFactoryPlanningData } from "@/lib/order-planning";
import { applyFactoryWorkflowState } from "@/lib/factory-workflow-logic";
import {
  canTransitionProductionItemStatus,
  getProductionStatusProgress,
  normalizeProductPreparationStages,
} from "@/lib/production-workflow";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildFactoryInputFromDb } from "@/lib/supabase-data/store-orders";
import { appendStoreOrderEvent } from "@/lib/supabase-data/store-order-events";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface PersistedWorkflowState {
  releasedOrders: string[];
  cancelledOrders: string[];
  productionItemStatuses: Record<string, ProductionItemStatus>;
}

export async function getPersistedWorkflowState(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<PersistedWorkflowState> {
  const [releasesResult, statusesResult, ordersResult] = await Promise.all([
    supabase.from("workflow_order_releases").select("order_id"),
    supabase.from("workflow_production_items").select("production_item_key, status"),
    supabase.from("store_orders").select("id, legacy_id, management_status"),
  ]);

  const orderRows = isSupabaseMissingSchemaError(ordersResult.error, ["management_status"])
    ? assertSupabaseResult(
        await supabase.from("store_orders").select("id, legacy_id"),
        "Failed to load order ids",
      ).map((row) => ({
        ...row,
        management_status: "ativo",
      }))
    : assertSupabaseResult(ordersResult, "Failed to load order ids");
  const releaseRows = isSupabaseMissingSchemaError(releasesResult.error, ["workflow_order_releases"])
    ? []
    : assertSupabaseResult(releasesResult, "Failed to load workflow releases");
  const statusRows = isSupabaseMissingSchemaError(statusesResult.error, ["workflow_production_items"])
    ? []
    : assertSupabaseResult(statusesResult, "Failed to load workflow statuses");

  const orderLegacyById = new Map(orderRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  return {
    releasedOrders: releaseRows
      .map((row) => orderLegacyById.get(row.order_id) ?? row.order_id)
      .filter((value, index, all) => all.indexOf(value) === index),
    cancelledOrders: orderRows
      .filter((row) => row.management_status === "cancelado")
      .map((row) => row.legacy_id ?? row.id),
    productionItemStatuses: statusRows.reduce<Record<string, ProductionItemStatus>>((acc, row) => {
      acc[row.production_item_key] = row.status;
      return acc;
    }, {}),
  };
}

async function appendOrderEventsForProductionItem(
  productionItemKey: string,
  status: ProductionItemStatus,
  updatedByProfileId: string | null | undefined,
  tenantId: string,
  supabase: SupabaseDataClient,
) {
  const [referenceDate] = productionItemKey.split("|");
  if (!referenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return;
  }

  const input = await buildFactoryInputFromDb({
    supabase,
    includeProfileNames: false,
    tenantId,
  });
  const planning = buildFactoryPlanningData(referenceDate, input);
  const matchingItems = planning.orderItems.filter((item) => item.productionItemKey === productionItemKey);
  const uniqueOrders = Array.from(new Set(matchingItems.map((item) => item.orderId)));

  await Promise.all(
    uniqueOrders.map((orderId) =>
      appendStoreOrderEvent(
        {
          orderId,
          type: "producao_status",
          title: "Andamento de produção atualizado",
          description: `Item operacional avançou para o status "${status}".`,
          createdByProfileId: updatedByProfileId ?? null,
          metadata: {
            productionItemKey,
            status,
          },
        },
        supabase,
      ),
    ),
  );

  // AJ-0011 / D05: quando a produção do pedido fecha 100% (status derivado =
  // aguardando_expedicao), persistir um checkpoint em delivery_executions e
  // emitir UM evento de "produção finalizada". Antes a transição era só
  // derivada em runtime (cache 10s) e a loja nunca recebia o aviso.
  //
  // `planning` é o motor puro (não reflete o status persistido de produção).
  // Para saber se o pedido realmente fechou 100%, aplicar o workflow state
  // persistido — que já inclui o upsert recém-feito por updateProductionItemStatus.
  const workflowState = await getPersistedWorkflowState(supabase);
  const appliedPlanning = applyFactoryWorkflowState(planning, {
    isReleased: (id) => workflowState.releasedOrders.includes(id),
    isCancelled: (id) => workflowState.cancelledOrders.includes(id),
    resolveProductionItemStatus: (itemKey) =>
      itemKey ? workflowState.productionItemStatuses[itemKey] ?? "nao_iniciado" : null,
  });

  const ordersReadyForExpedition = uniqueOrders.filter((orderId) => {
    const orderRow = appliedPlanning.orders.find((order) => order.id === orderId);
    return orderRow?.status === "aguardando_expedicao";
  });

  await Promise.all(
    ordersReadyForExpedition.map(async (orderId) => {
      const idQuery = supabase.from("store_orders").select("id");
      const idResult = await (isUuid(orderId)
        ? idQuery.eq("id", orderId)
        : idQuery.eq("legacy_id", orderId)
      ).maybeSingle();
      const orderDatabaseId = idResult.data?.id;
      if (!orderDatabaseId) {
        return;
      }

      // Idempotência: se já existe row de execução, o checkpoint e o evento já
      // foram emitidos (ou a entrega até já avançou) — não repetir nem sobrescrever.
      const existingExecution = await supabase
        .from("delivery_executions")
        .select("order_id")
        .eq("order_id", orderDatabaseId)
        .maybeSingle();

      if (
        existingExecution.error &&
        isSupabaseMissingSchemaError(existingExecution.error, ["delivery_executions"])
      ) {
        return;
      }
      if (existingExecution.data) {
        return;
      }

      const seedResult = await supabase.from("delivery_executions").upsert(
        {
          order_id: orderDatabaseId,
          status: "aguardando_expedicao",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id", ignoreDuplicates: true },
      );

      if (
        seedResult.error &&
        !isSupabaseMissingSchemaError(seedResult.error, ["delivery_executions"])
      ) {
        // Não falhar o fluxo de produção por causa do checkpoint de expedição.
        console.error("AJ-0011: falha ao semear delivery_executions", seedResult.error);
        return;
      }

      await appendStoreOrderEvent(
        {
          orderId,
          type: "producao_finalizada",
          title: "Produção concluída",
          description: "Todas as ordens de produção do pedido foram concluídas. Pedido liberado para expedição.",
          createdByProfileId: updatedByProfileId ?? null,
          metadata: { productionItemKey },
        },
        supabase,
      );
    }),
  );
}

async function resolvePreparationStagesForProductionItem(
  productionItemKey: string,
  supabase: SupabaseDataClient,
) {
  const productIdentifier = productionItemKey.split("|").at(-1);
  if (!productIdentifier) {
    return normalizeProductPreparationStages();
  }

  const productQuery = supabase.from("products").select("id");
  const productResult = await (isUuid(productIdentifier)
    ? productQuery.eq("id", productIdentifier)
    : productQuery.eq("legacy_id", productIdentifier)).maybeSingle();

  if (productResult.error) {
    throw new Error(`Failed to resolve product for workflow item: ${productResult.error.message}`);
  }

  if (!productResult.data) {
    return normalizeProductPreparationStages();
  }

  const stepsResult = await supabase
    .from("product_preparation_steps")
    .select("stage_key")
    .eq("product_id", productResult.data.id)
    .order("sort_order", { ascending: true });

  if (isSupabaseMissingSchemaError(stepsResult.error, ["product_preparation_steps"])) {
    return normalizeProductPreparationStages();
  }

  const steps = assertSupabaseResult(
    stepsResult,
    "Failed to load product preparation steps for workflow item",
  );

  return normalizeProductPreparationStages(steps.map((row) => row.stage_key));
}

export async function releaseOrder(
  orderId: string,
  releasedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const releasedByDatabaseId = await resolveProfileDatabaseId(supabase, releasedByProfileId ?? null);
  const orderRow = await resolveOrderRow(orderId, supabase);

  if (orderRow.management_status === "cancelado") {
    throw new Error("Cancelled orders cannot be released to production");
  }

  const upsertResult = await supabase.from("workflow_order_releases").upsert(
    {
      order_id: orderRow.id,
      released_at: new Date().toISOString(),
      released_by_profile_id: releasedByDatabaseId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "order_id",
    },
  );

  if (upsertResult.error) {
    throw new Error(`Failed to release order: ${upsertResult.error.message}`);
  }

  await appendStoreOrderEvent(
    {
      orderId: orderRow.id,
      type: "liberacao_producao",
      title: "Pedido liberado para produção",
      description: "O pedido entrou no fluxo operacional da fábrica.",
      createdByProfileId: releasedByProfileId ?? null,
    },
    supabase,
  );
}

export async function updateProductionItemStatus(
  productionItemKey: string,
  status: ProductionItemStatus,
  updatedByProfileId?: string | null,
  tenantId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const updatedByDatabaseId = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const preparationStages = await resolvePreparationStagesForProductionItem(
    productionItemKey,
    supabase,
  );
  const currentResult = await supabase
    .from("workflow_production_items")
    .select("status")
    .eq("production_item_key", productionItemKey)
    .maybeSingle();

  if (
    currentResult.error &&
    !isSupabaseMissingSchemaError(currentResult.error, ["workflow_production_items"])
  ) {
    throw new Error(`Failed to load current production item status: ${currentResult.error.message}`);
  }

  const currentStatus = currentResult.data?.status ?? "nao_iniciado";

  if (!canTransitionProductionItemStatus(currentStatus, status, preparationStages)) {
    throw new Error("Invalid production workflow transition");
  }

  const upsertResult = await supabase.from("workflow_production_items").upsert(
    {
      production_item_key: productionItemKey,
      status,
      progress: getProductionStatusProgress(status, preparationStages),
      updated_at: new Date().toISOString(),
      updated_by_profile_id: updatedByDatabaseId,
    },
    {
      onConflict: "production_item_key",
    },
  );

  if (upsertResult.error) {
    throw new Error(`Failed to update production item status: ${upsertResult.error.message}`);
  }

  if (tenantId) {
    await appendOrderEventsForProductionItem(
      productionItemKey,
      status,
      updatedByProfileId,
      tenantId,
      supabase,
    );
  }
}

async function resolveOrderRow(
  orderId: string,
  supabase: SupabaseDataClient,
) {
  const query = supabase
    .from("store_orders")
    .select("id, management_status");

  const result = await (isUuid(orderId) ? query.eq("id", orderId) : query.eq("legacy_id", orderId)).maybeSingle();
  if (isSupabaseMissingSchemaError(result.error, ["management_status"])) {
    const fallbackQuery = supabase.from("store_orders").select("id");
    const fallbackResult = await (isUuid(orderId)
      ? fallbackQuery.eq("id", orderId)
      : fallbackQuery.eq("legacy_id", orderId)).maybeSingle();
    const fallbackRow = assertSupabaseResult(
      { data: fallbackResult.data, error: fallbackResult.error },
      "Failed to resolve order management",
    );

    return {
      ...fallbackRow,
      management_status: "ativo",
    };
  }
  return assertSupabaseResult({ data: result.data, error: result.error }, "Failed to resolve order management");
}

export async function cancelOrder(
  orderId: string,
  managedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const managedByDatabaseId = await resolveProfileDatabaseId(supabase, managedByProfileId ?? null);
  const orderRow = await resolveOrderRow(orderId, supabase);
  const releaseResult = await supabase
    .from("workflow_order_releases")
    .select("id")
    .eq("order_id", orderRow.id)
    .maybeSingle();
  if (releaseResult.error) {
    throw new Error(`Failed to verify current order release: ${releaseResult.error.message}`);
  }
  const hasRelease = Boolean(releaseResult.data);

  if (hasRelease) {
    throw new Error("Orders already released to production cannot be cancelled");
  }

  if (orderRow.management_status === "cancelado") {
    return;
  }

  const result = await supabase
    .from("store_orders")
    .update({
      management_status: "cancelado",
      cancelled_at: new Date().toISOString(),
      cancelled_by_profile_id: managedByDatabaseId,
      reopened_at: null,
      reopened_by_profile_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderRow.id);

  if (result.error) {
    throw new Error(`Failed to cancel order: ${result.error.message}`);
  }

  await appendStoreOrderEvent(
    {
      orderId: orderRow.id,
      type: "cancelamento",
      title: "Pedido cancelado",
      description: "O pedido foi retirado do fluxo operacional antes da liberação para produção.",
      createdByProfileId: managedByProfileId ?? null,
    },
    supabase,
  );
}

export async function reopenOrder(
  orderId: string,
  managedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const managedByDatabaseId = await resolveProfileDatabaseId(supabase, managedByProfileId ?? null);
  const orderRow = await resolveOrderRow(orderId, supabase);

  if (orderRow.management_status !== "cancelado") {
    return;
  }

  const result = await supabase
    .from("store_orders")
    .update({
      management_status: "ativo",
      reopened_at: new Date().toISOString(),
      reopened_by_profile_id: managedByDatabaseId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderRow.id);

  if (result.error) {
    throw new Error(`Failed to reopen order: ${result.error.message}`);
  }

  await appendStoreOrderEvent(
    {
      orderId: orderRow.id,
      type: "reabertura",
      title: "Pedido reaberto",
      description: "O pedido voltou a ficar elegível para liberação operacional.",
      createdByProfileId: managedByProfileId ?? null,
    },
    supabase,
  );
}
