import { supabaseAdmin } from "@/lib/supabase/admin-client";

type PurchaseLikeItem = {
  collection_id?: string | null;
  collection_model_id?: string | null;
  item_name_snapshot: string;
  quantity: number;
  unit: "m2" | "meter" | "piece" | "pack";
};

type StockRow = {
  id: string;
  collection_id: string;
  collection_model_id: string | null;
  quantity: number;
  quantity_m2?: number;
  unit: "m2" | "meter" | "piece" | "pack";
};

type StockAdjustment = {
  stockItemId: string;
  quantity: number;
  itemName: string;
};

type MovementMeta = {
  comment?: string;
  createdBy?: string;
};

function getAdjustmentKey(item: PurchaseLikeItem) {
  return `${item.collection_id ?? "null"}::${item.collection_model_id ?? "null"}::${item.unit}`;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

async function createStockMovement(
  companyId: string,
  stockItemId: string,
  movementType: "incoming" | "outgoing",
  quantity: number,
  meta?: MovementMeta
) {
  const now = new Date();
  await supabaseAdmin.from("stock_movements").insert({
    company_id: companyId,
    stock_item_id: stockItemId,
    type: movementType,
    movement_type: movementType,
    quantity: movementType === "outgoing" ? -Math.abs(quantity) : Math.abs(quantity),
    quantity_m2: movementType === "outgoing" ? -Math.abs(quantity) : Math.abs(quantity),
    unit_price: 0,
    total_amount: 0,
    movement_date: now.toISOString().slice(0, 10),
    comment: meta?.comment ?? null,
    created_by: meta?.createdBy ?? "00000000-0000-0000-0000-000000000101",
  });
}

async function incrementStockById(stockItemId: string, quantity: number) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from("stock_items")
    .select("id,quantity,quantity_m2")
    .eq("id", stockItemId)
    .single();

  if (currentError || !current) throw currentError ?? new Error("Не удалось получить текущий остаток");

  const { error: updateError } = await supabaseAdmin
    .from("stock_items")
    .update({
      quantity: toNumber(current.quantity_m2 ?? current.quantity) + quantity,
      quantity_m2: toNumber(current.quantity_m2 ?? current.quantity) + quantity,
      last_movement_at: new Date().toISOString(),
    })
    .eq("id", stockItemId);

  if (updateError) throw updateError;
}

async function loadStockRows(companyId: string, items: PurchaseLikeItem[]) {
  const collectionIds = Array.from(new Set(items.map((item) => item.collection_id).filter(Boolean) as string[]));
  if (!collectionIds.length) return [] as StockRow[];

  const { data, error } = await supabaseAdmin
    .from("stock_items")
    .select("id,collection_id,collection_model_id,quantity,quantity_m2,unit")
    .eq("company_id", companyId)
    .in("collection_id", collectionIds);

  if (error) throw error;
  return (data ?? []) as StockRow[];
}

async function buildAdjustments(companyId: string, items: PurchaseLikeItem[]) {
  const stockTrackedItems = items.filter((item) => Boolean(item.collection_id));
  if (!stockTrackedItems.length) return [] as StockAdjustment[];

  const aggregated = new Map<
    string,
    { collection_id: string; collection_model_id: string | null; unit: PurchaseLikeItem["unit"]; quantity: number; itemName: string }
  >();

  for (const item of stockTrackedItems) {
    const key = getAdjustmentKey(item);
    const current = aggregated.get(key);
    if (current) {
      current.quantity += toNumber(item.quantity);
      continue;
    }

    aggregated.set(key, {
      collection_id: item.collection_id as string,
      collection_model_id: item.collection_model_id ?? null,
      unit: item.unit,
      quantity: toNumber(item.quantity),
      itemName: item.item_name_snapshot,
    });
  }

  const stockRows = await loadStockRows(companyId, stockTrackedItems);
  const adjustments: StockAdjustment[] = [];

  for (const entry of aggregated.values()) {
    const stockRow = stockRows.find(
      (row) =>
        row.collection_id === entry.collection_id &&
        (row.collection_model_id ?? null) === (entry.collection_model_id ?? null)
    );

    if (!stockRow) {
      throw new Error(`Для товара "${entry.itemName}" не найден остаток на складе`);
    }

    if (stockRow.unit !== entry.unit) {
      throw new Error(
        `Единица товара "${entry.itemName}" (${entry.unit}) не совпадает со складской единицей (${stockRow.unit})`
      );
    }

    adjustments.push({
      stockItemId: stockRow.id,
      quantity: entry.quantity,
      itemName: entry.itemName,
    });
  }

  return adjustments;
}

export async function reserveStockForPurchase(companyId: string, items: PurchaseLikeItem[], meta?: MovementMeta) {
  const adjustments = await buildAdjustments(companyId, items);
  const applied: StockAdjustment[] = [];

  try {
    for (const adjustment of adjustments) {
      const { data, error } = await supabaseAdmin
        .from("stock_items")
        .select("id,quantity,quantity_m2")
        .eq("id", adjustment.stockItemId)
        .eq("company_id", companyId)
        .single();

      if (error || !data) {
        throw error ?? new Error(`Не удалось получить остаток для "${adjustment.itemName}"`);
      }

      const currentQuantity = toNumber(data.quantity_m2 ?? data.quantity);
      if (currentQuantity < adjustment.quantity) {
        throw new Error(
          `Недостаточно остатка для "${adjustment.itemName}": доступно ${currentQuantity}, требуется ${adjustment.quantity}`
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("stock_items")
        .update({
          quantity: currentQuantity - adjustment.quantity,
          quantity_m2: currentQuantity - adjustment.quantity,
          last_movement_at: new Date().toISOString(),
        })
        .eq("id", adjustment.stockItemId)
        .eq("company_id", companyId)
        .gte("quantity_m2", adjustment.quantity)
        .select("id")
        .single();

      if (updateError) {
        throw updateError;
      }

      applied.push(adjustment);
      await createStockMovement(companyId, adjustment.stockItemId, "outgoing", adjustment.quantity, meta);
    }
  } catch (error) {
    for (const adjustment of applied) {
      try {
        await incrementStockById(adjustment.stockItemId, adjustment.quantity);
      } catch {
        // best-effort compensation
      }
    }
    throw error;
  }
}

export async function restoreStockForPurchase(companyId: string, items: PurchaseLikeItem[], meta?: MovementMeta) {
  const adjustments = await buildAdjustments(companyId, items);
  for (const adjustment of adjustments) {
    const { data, error } = await supabaseAdmin
      .from("stock_items")
      .select("id,quantity,quantity_m2")
      .eq("id", adjustment.stockItemId)
      .eq("company_id", companyId)
      .single();

    if (error || !data) throw error ?? new Error(`Не удалось получить остаток для "${adjustment.itemName}"`);

    const { error: updateError } = await supabaseAdmin
      .from("stock_items")
      .update({
        quantity: toNumber(data.quantity_m2 ?? data.quantity) + adjustment.quantity,
        quantity_m2: toNumber(data.quantity_m2 ?? data.quantity) + adjustment.quantity,
        last_movement_at: new Date().toISOString(),
      })
      .eq("id", adjustment.stockItemId)
      .eq("company_id", companyId);

    if (updateError) throw updateError;
    await createStockMovement(companyId, adjustment.stockItemId, "incoming", adjustment.quantity, meta);
  }
}
