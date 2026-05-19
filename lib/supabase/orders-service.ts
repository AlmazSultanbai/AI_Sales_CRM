import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { CreateOrderInput, OrderStatus } from "@/features/orders/lib/schemas";
import { ItemUnit } from "@/lib/units";

type PersistedOrderItem = {
  id: string;
  stock_item_id: string | null;
  collection_id: string | null;
  collection_model_id: string | null;
  material_name_snapshot: string;
  sku_snapshot: string | null;
  unit: ItemUnit;
  quantity_m2: number;
  cost_price_per_m2: number;
};

type StockRow = {
  id: string;
  collection_id: string;
  collection_model_id: string | null;
  material_name: string | null;
  model_code: string | null;
  color_name: string | null;
  sku: string | null;
  quantity: number;
  quantity_m2: number;
  unit: ItemUnit;
  purchase_price_per_m2: number;
};

export type ComputedOrderTotals = {
  materials_sale_total: number;
  materials_cost_total: number;
  installation_amount: number;
  total_amount: number;
  total_expenses: number;
  gross_profit: number;
  margin_percent: number;
  workshop_total: number;
};

type ComputeTotalsInput = {
  items: Array<{
    quantity_m2: number;
    sale_price_per_m2: number;
    cost_price_per_m2: number;
  }>;
  installation_amount?: number | null;
  total_amount?: number | null;
  workshop_total?: number | null;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export function computeOrderTotals(input: ComputeTotalsInput): ComputedOrderTotals {
  const materials_sale_total = input.items.reduce(
    (acc, item) => acc + toNumber(item.quantity_m2) * toNumber(item.sale_price_per_m2),
    0
  );
  const materials_cost_total = input.items.reduce(
    (acc, item) => acc + toNumber(item.quantity_m2) * toNumber(item.cost_price_per_m2),
    0
  );

  const installation_amount = toNumber(input.installation_amount);
  const total_amount = input.total_amount == null ? materials_sale_total + installation_amount : toNumber(input.total_amount);
  const total_expenses = materials_cost_total + installation_amount;
  const gross_profit = total_amount - total_expenses;
  const margin_percent = total_amount > 0 ? (gross_profit / total_amount) * 100 : 0;
  const workshop_total = input.workshop_total == null ? total_amount - installation_amount : toNumber(input.workshop_total);

  return {
    materials_sale_total,
    materials_cost_total,
    installation_amount,
    total_amount,
    total_expenses,
    gross_profit,
    margin_percent,
    workshop_total,
  };
}

export function generateOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(
    now.getMilliseconds()
  ).padStart(3, "0")}`;
  return `ORD-${stamp}`;
}

export async function assertStockAvailability(companyId: string, items: PersistedOrderItem[]) {
  const stockRows = await resolveStockRowsByItems(companyId, items);
  const requiredByStockId = new Map<string, { required: number; label: string; sku: string | null }>();

  for (const item of items) {
    const stockRow = item.stock_item_id
      ? stockRows.find((row) => row.id === item.stock_item_id)
      : stockRows.find(
          (row) =>
            row.collection_id === item.collection_id &&
            (row.collection_model_id ?? null) === (item.collection_model_id ?? null)
        );

    if (!stockRow) {
      throw new Error(`Не найдена складская позиция для "${item.material_name_snapshot}"`);
    }

    if (stockRow.unit !== item.unit) {
      throw new Error(
        `Единица для "${item.material_name_snapshot}" не совпадает: склад "${stockRow.unit}", заказ "${item.unit}"`
      );
    }

    const key = stockRow.id;
    const current = requiredByStockId.get(key);
    const nextRequired = (current?.required ?? 0) + Math.abs(toNumber(item.quantity_m2));
    requiredByStockId.set(key, {
      required: nextRequired,
      label: item.material_name_snapshot,
      sku: stockRow.sku,
    });
  }

  for (const [stockId, requiredInfo] of requiredByStockId.entries()) {
    const stockRow = stockRows.find((row) => row.id === stockId);
    if (!stockRow) continue;
    const available = toNumber(stockRow.quantity_m2 ?? stockRow.quantity);
    if (requiredInfo.required > available) {
      throw new Error(
        `На складе не осталось "${requiredInfo.label}" (${requiredInfo.sku ?? "-"}) — доступно ${available}, требуется ${requiredInfo.required}`
      );
    }
  }
}

async function resolveStockRowsByItems(companyId: string, items: PersistedOrderItem[]) {
  const stockItemIds = Array.from(new Set(items.map((item) => item.stock_item_id).filter(Boolean) as string[]));
  const collectionIds = Array.from(new Set(items.map((item) => item.collection_id).filter(Boolean) as string[]));

  let query = supabaseAdmin
    .from("stock_items")
    .select(
      "id,collection_id,collection_model_id,material_name,model_code,color_name,sku,quantity,quantity_m2,unit,purchase_price_per_m2"
    )
    .eq("company_id", companyId);

  if (stockItemIds.length) {
    query = query.in("id", stockItemIds);
  } else if (collectionIds.length) {
    query = query.in("collection_id", collectionIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StockRow[];
}

type ApplyStockParams = {
  companyId: string;
  orderId: string;
  orderNumber: string;
  items: PersistedOrderItem[];
  movementType: "outgoing" | "incoming";
  userId?: string | null;
  commentPrefix?: string;
};

export async function applyStockForOrder(params: ApplyStockParams) {
  const stockRows = await resolveStockRowsByItems(params.companyId, params.items);
  const applied: Array<{ stockId: string; previousQuantity: number; movementId?: string }> = [];

  try {
    for (const item of params.items) {
      const stockRow = item.stock_item_id
        ? stockRows.find((row) => row.id === item.stock_item_id)
        : stockRows.find(
            (row) =>
              row.collection_id === item.collection_id &&
              (row.collection_model_id ?? null) === (item.collection_model_id ?? null)
          );

      if (!stockRow) {
        throw new Error(`Не найдена складская позиция для "${item.material_name_snapshot}"`);
      }

      if (stockRow.unit !== item.unit) {
        throw new Error(
          `Единица для "${item.material_name_snapshot}" не совпадает: склад "${stockRow.unit}", заказ "${item.unit}"`
        );
      }

      const currentQuantity = toNumber(stockRow.quantity_m2 ?? stockRow.quantity);
      const delta = Math.abs(toNumber(item.quantity_m2));
      const signedDelta = params.movementType === "outgoing" ? -delta : delta;
      const nextQuantity = currentQuantity + signedDelta;

      if (params.movementType === "outgoing" && nextQuantity < 0) {
        throw new Error(
          `Недостаточно остатка для "${item.material_name_snapshot}" (${stockRow.sku ?? "-"}): доступно ${currentQuantity}`
        );
      }

      const { error: stockUpdateError } = await supabaseAdmin
        .from("stock_items")
        .update({
          quantity: nextQuantity,
          quantity_m2: nextQuantity,
          last_movement_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", stockRow.id)
        .eq("company_id", params.companyId);

      if (stockUpdateError) throw stockUpdateError;

      const movementComment = `${params.commentPrefix ?? ""}Заказ №${params.orderNumber}: ${item.material_name_snapshot}`.trim();
      const movementQuantity = signedDelta;
      const movementAmount = Math.abs(movementQuantity) * toNumber(item.cost_price_per_m2);

      const { data: movement, error: movementError } = await supabaseAdmin
        .from("stock_movements")
        .insert({
          company_id: params.companyId,
          stock_item_id: stockRow.id,
          type: params.movementType,
          movement_type: params.movementType,
          quantity: movementQuantity,
          quantity_m2: movementQuantity,
          unit_price: toNumber(item.cost_price_per_m2),
          total_amount: movementAmount,
          movement_date: new Date().toISOString().slice(0, 10),
          comment: movementComment,
          created_by: params.userId ?? "00000000-0000-0000-0000-000000000101",
          linked_order_id: params.orderId,
          linked_order_item_id: item.id,
        })
        .select("id")
        .single();

      if (movementError) throw movementError;

      applied.push({ stockId: stockRow.id, previousQuantity: currentQuantity, movementId: movement.id });
    }
  } catch (error) {
    for (const item of applied.reverse()) {
      await supabaseAdmin
        .from("stock_items")
        .update({
          quantity: item.previousQuantity,
          quantity_m2: item.previousQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.stockId)
        .eq("company_id", params.companyId);

      if (item.movementId) {
        await supabaseAdmin.from("stock_movements").delete().eq("id", item.movementId);
      }
    }
    throw error;
  }
}

export function shouldApplyStock(status: OrderStatus) {
  return status === "confirmed" || status === "completed";
}
