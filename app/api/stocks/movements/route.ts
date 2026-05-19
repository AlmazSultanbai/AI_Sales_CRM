import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { createStockMovementSchema, stockHistoryQuerySchema } from "@/features/inventory/lib/schemas";
import { generateSku } from "@/features/inventory/lib/stock-utils";
import { defaultUnitByCollectionType, normalizeUnitByCollectionType, unitLabel } from "@/lib/units";
import { MovementType } from "@/types/domain";

type StockItemRecord = {
  id: string;
  company_id: string;
  collection_id: string;
  collection_model_id: string | null;
  material_name: string | null;
  model_code: string | null;
  color_name: string | null;
  sku: string | null;
  photo_url: string | null;
  quantity: number;
  quantity_m2: number;
  purchase_price_per_m2: number;
  sale_price_per_m2: number | null;
  low_stock_threshold: number;
  unit?: "m2" | "meter" | "piece" | "pack" | null;
};

function signedQuantity(type: MovementType, quantity: number) {
  if (type === "outgoing" || type === "transfer" || type === "writeoff") return -Math.abs(quantity);
  return Math.abs(quantity);
}

async function resolveStockItem(companyId: string, payload: ReturnType<typeof createStockMovementSchema.parse>) {
  if (payload.stock_item_id) {
    const { data } = await supabaseAdmin
      .from("stock_items")
      .select("*")
      .eq("id", payload.stock_item_id)
      .eq("company_id", companyId)
      .single();
    return data as StockItemRecord | null;
  }

  if (payload.sku) {
    const { data } = await supabaseAdmin
      .from("stock_items")
      .select("*")
      .eq("company_id", companyId)
      .eq("sku", payload.sku)
      .maybeSingle();
    if (data) return data as StockItemRecord;
  }

  if (payload.collection_id && payload.collection_model_id) {
    const { data } = await supabaseAdmin
      .from("stock_items")
      .select("*")
      .eq("company_id", companyId)
      .eq("collection_id", payload.collection_id)
      .eq("collection_model_id", payload.collection_model_id)
      .maybeSingle();
    if (data) return data as StockItemRecord;
  }

  return null;
}

async function createStockItem(companyId: string, payload: ReturnType<typeof createStockMovementSchema.parse>) {
  if (!payload.collection_id) {
    throw new Error("Для новой складской позиции нужно выбрать товар/коллекцию");
  }

  const { data: model } = payload.collection_model_id
    ? await supabaseAdmin
        .from("collection_models")
        .select("id,model_code,color_name,image_url,sku")
        .eq("id", payload.collection_model_id)
        .maybeSingle()
    : { data: null as { id: string; model_code: string; color_name: string; image_url: string | null; sku: string | null } | null };

  const { data: collection } = await supabaseAdmin
    .from("collections")
    .select("id,name,image_url,type")
    .eq("id", payload.collection_id)
    .maybeSingle();

  const materialName = payload.material_name ?? collection?.name ?? "Не указан";
  const modelCode = payload.model_code ?? model?.model_code ?? "-";
  const colorName = payload.color_name ?? model?.color_name ?? "Не указан";
  const sku = payload.sku || model?.sku || generateSku(materialName, modelCode, colorName);
  const photoUrl = payload.photo_url ?? model?.image_url ?? collection?.image_url ?? null;

  const { data, error } = await supabaseAdmin
    .from("stock_items")
    .insert({
      company_id: companyId,
      collection_id: payload.collection_id,
      collection_model_id: payload.collection_model_id ?? null,
      material_name: materialName,
      model_code: modelCode,
      color_name: colorName,
      sku,
      photo_url: photoUrl,
      quantity: 0,
      quantity_m2: 0,
      purchase_price_per_m2: Number(payload.unit_price ?? 0),
      sale_price_per_m2: payload.sale_price_per_m2 == null ? null : Number(payload.sale_price_per_m2),
      low_stock_threshold: Number(payload.low_stock_threshold ?? 10),
      unit: defaultUnitByCollectionType(collection?.type),
      last_movement_at: payload.movement_date,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось создать складскую позицию");
  }

  return data as StockItemRecord;
}

export async function GET(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stocks:read")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const parsed = stockHistoryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Неверные параметры" }, { status: 400 });
  }

  const {
    page,
    page_size: pageSize,
    stock_item_id: stockItemId,
    movement_type: movementType,
    date_from: dateFrom,
    date_to: dateTo,
    search,
    supplier_or_store: supplierOrStore,
    created_by: createdBy,
    material,
    collection,
    model,
    color,
  } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  let query = supabaseAdmin
    .from("stock_movements")
    .select(
      "id,company_id,stock_item_id,type,movement_type,quantity,quantity_m2,unit_price,total_amount,supplier_name,source_store_id,destination_store_id,movement_date,comment,created_by,created_at,stock_items(id,material_name,model_code,color_name,sku,photo_url,collection_id,collection_model_id,unit)"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (stockItemId) query = query.eq("stock_item_id", stockItemId);
  if (movementType) {
    query = query.or(`movement_type.eq.${movementType},type.eq.${movementType}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    company_id: string;
    stock_item_id: string;
    type?: string | null;
    movement_type?: string | null;
    quantity: number;
    quantity_m2?: number | null;
    unit_price?: number | null;
    total_amount?: number | null;
    supplier_name?: string | null;
    source_store_id?: string | null;
    destination_store_id?: string | null;
    movement_date?: string | null;
    comment?: string | null;
    created_by?: string | null;
    created_at: string;
    stock_items?:
      | {
          id: string;
          material_name?: string | null;
          model_code?: string | null;
          color_name?: string | null;
          sku?: string | null;
          photo_url?: string | null;
          collection_id?: string | null;
          collection_model_id?: string | null;
          unit?: "m2" | "meter" | "piece" | "pack" | null;
        }
      | {
          id: string;
          material_name?: string | null;
          model_code?: string | null;
          color_name?: string | null;
          sku?: string | null;
          photo_url?: string | null;
          collection_id?: string | null;
          collection_model_id?: string | null;
          unit?: "m2" | "meter" | "piece" | "pack" | null;
        }[]
      | null;
  }>;

  const normalizedRows = rows.map((row) => {
    const rawStockItem = row.stock_items;
    const stockItem = Array.isArray(rawStockItem) ? rawStockItem[0] ?? null : rawStockItem ?? null;
    return {
      ...row,
      stock_items: stockItem,
    };
  });

  const storeIds = Array.from(
    new Set(normalizedRows.flatMap((row) => [row.source_store_id, row.destination_store_id]).filter(Boolean) as string[])
  );
  const userIds = Array.from(new Set(normalizedRows.map((row) => row.created_by).filter(Boolean) as string[]));
  const collectionIds = Array.from(
    new Set(normalizedRows.map((row) => row.stock_items?.collection_id).filter(Boolean) as string[])
  );

  const [storesRes, usersRes, collectionsRes] = await Promise.all([
    storeIds.length
      ? supabaseAdmin.from("stores").select("id,name").eq("company_id", companyId).in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    userIds.length
      ? supabaseAdmin.from("users").select("id,full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    collectionIds.length
      ? supabaseAdmin.from("collections").select("id,name,type").eq("company_id", companyId).in("id", collectionIds)
      : Promise.resolve({ data: [] as { id: string; name: string; type: string }[], error: null }),
  ]);

  const storesMap = new Map((storesRes.data ?? []).map((store) => [store.id, store.name]));
  const usersMap = new Map((usersRes.data ?? []).map((user) => [user.id, user.full_name]));
  const collectionsMap = new Map((collectionsRes.data ?? []).map((collection) => [collection.id, collection.name]));
  const collectionTypeMap = new Map((collectionsRes.data ?? []).map((collection) => [collection.id, collection.type]));

  const normalized = normalizedRows.map((row) => {
    const type = (row.movement_type ?? row.type ?? "incoming") as MovementType;
    const stockItem = row.stock_items ?? null;
    const collectionName = stockItem?.collection_id ? collectionsMap.get(stockItem.collection_id) ?? "-" : "-";
    const collectionType = stockItem?.collection_id ? collectionTypeMap.get(stockItem.collection_id) ?? null : null;
    const sourceName = row.source_store_id ? storesMap.get(row.source_store_id) ?? row.source_store_id : null;
    const destinationName = row.destination_store_id ? storesMap.get(row.destination_store_id) ?? row.destination_store_id : null;
    const creatorName = row.created_by ? usersMap.get(row.created_by) ?? row.created_by : null;

    return {
      ...row,
      movement_type: type,
      quantity_m2: Number(row.quantity_m2 ?? row.quantity ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      total_amount: Number(row.total_amount ?? 0),
      collection_name: collectionName,
      collection_type: collectionType,
      stock_items: stockItem
        ? {
            ...stockItem,
            unit: normalizeUnitByCollectionType(collectionType, stockItem.unit),
          }
        : stockItem,
      source_name: sourceName,
      destination_name: destinationName,
      creator_name: creatorName,
    };
  });

  const filtered = normalized.filter((row) => {
    if (dateFrom) {
      const movementDate = new Date(row.movement_date ?? row.created_at);
      const fromDate = new Date(dateFrom);
      if (movementDate < fromDate) return false;
    }
    if (dateTo) {
      const movementDate = new Date(row.movement_date ?? row.created_at);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (movementDate > toDate) return false;
    }
    if (search) {
      const haystack = [
        row.stock_items?.material_name,
        row.collection_name,
        row.stock_items?.model_code,
        row.stock_items?.color_name,
        row.stock_items?.sku,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    if (supplierOrStore) {
      const haystack = [row.supplier_name, row.source_name, row.destination_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(supplierOrStore.toLowerCase())) return false;
    }
    if (createdBy) {
      const creator = (row.creator_name ?? "").toLowerCase();
      if (!creator.includes(createdBy.toLowerCase())) return false;
    }
    if (material) {
      const value = (row.stock_items?.material_name ?? "").toLowerCase();
      if (!value.includes(material.toLowerCase())) return false;
    }
    if (collection) {
      const value = (row.collection_name ?? "").toLowerCase();
      if (!value.includes(collection.toLowerCase())) return false;
    }
    if (model) {
      const value = (row.stock_items?.model_code ?? "").toLowerCase();
      if (!value.includes(model.toLowerCase())) return false;
    }
    if (color) {
      const value = (row.stock_items?.color_name ?? "").toLowerCase();
      if (!value.includes(color.toLowerCase())) return false;
    }
    return true;
  });

  const summary = filtered.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.movement_type === "incoming") acc.incoming += 1;
      if (row.movement_type === "outgoing" || row.movement_type === "writeoff") acc.outgoing += 1;
      if (row.movement_type === "transfer") acc.transfer += 1;
      if (row.movement_type === "adjustment") acc.adjustment += 1;
      return acc;
    },
    { total: 0, incoming: 0, outgoing: 0, transfer: 0, adjustment: 0 }
  );

  return NextResponse.json({
    items: filtered.slice(from, to),
    summary,
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
  });
}

export async function POST(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stocks:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createStockMovementSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const payload = parsed.data;

  let stockItem = await resolveStockItem(companyId, payload);
  if (!stockItem) {
    if (payload.movement_type !== "incoming" && payload.movement_type !== "adjustment") {
      return NextResponse.json({ error: "Складская позиция не найдена для выбранного SKU" }, { status: 404 });
    }
    try {
      stockItem = await createStockItem(companyId, payload);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка создания позиции" }, { status: 500 });
    }
  }

  const effectiveCollectionId = payload.collection_id ?? stockItem.collection_id ?? null;
  let collectionType: string | null = null;
  if (effectiveCollectionId) {
    const { data: collection } = await supabaseAdmin
      .from("collections")
      .select("id,type")
      .eq("id", effectiveCollectionId)
      .eq("company_id", companyId)
      .maybeSingle();
    collectionType = collection?.type ?? null;
  }
  const effectiveUnit = normalizeUnitByCollectionType(collectionType, stockItem.unit);

  const delta = signedQuantity(payload.movement_type, Number(payload.quantity_m2));
  const currentQty = Number(stockItem.quantity_m2 ?? stockItem.quantity ?? 0);
  const nextQty = currentQty + delta;

  if (nextQty < 0) {
    return NextResponse.json(
      { error: `Недостаточно остатка по SKU ${stockItem.sku ?? payload.sku}. Доступно: ${currentQty} ${unitLabel(effectiveUnit)}` },
      { status: 409 }
    );
  }

  const unitPrice = Number(payload.unit_price ?? stockItem.purchase_price_per_m2 ?? 0);
  const shouldUpdateSalePrice = payload.movement_type === "incoming" && payload.sale_price_per_m2 != null;
  const nextSalePrice = shouldUpdateSalePrice ? Number(payload.sale_price_per_m2) : stockItem.sale_price_per_m2;
  const totalAmount = Math.abs(Number(payload.quantity_m2)) * unitPrice;

  const { error: updateError } = await supabaseAdmin
    .from("stock_items")
    .update({
      material_name: payload.material_name ?? stockItem.material_name,
      model_code: payload.model_code ?? stockItem.model_code,
      color_name: payload.color_name ?? stockItem.color_name,
      sku: payload.sku ?? stockItem.sku,
      photo_url: payload.photo_url ?? stockItem.photo_url,
      quantity: nextQty,
      quantity_m2: nextQty,
      purchase_price_per_m2: payload.movement_type === "incoming" ? unitPrice : stockItem.purchase_price_per_m2,
      sale_price_per_m2: nextSalePrice,
      low_stock_threshold: Number(payload.low_stock_threshold ?? stockItem.low_stock_threshold ?? 10),
      unit: effectiveUnit,
      last_movement_at: payload.movement_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stockItem.id)
    .eq("company_id", companyId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const movementQuantity = delta;
  const { data: movement, error: movementError } = await supabaseAdmin
    .from("stock_movements")
    .insert({
      company_id: companyId,
      stock_item_id: stockItem.id,
      type: payload.movement_type,
      movement_type: payload.movement_type,
      quantity: movementQuantity,
      quantity_m2: movementQuantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      supplier_name: payload.supplier_name ?? null,
      source_store_id: payload.source_store_id ?? null,
      destination_store_id: payload.destination_store_id ?? null,
      movement_date: payload.movement_date,
      comment: payload.comment ?? null,
      created_by: "00000000-0000-0000-0000-000000000101",
    })
    .select("id,stock_item_id,movement_type,quantity,quantity_m2,unit_price,total_amount,supplier_name,movement_date,comment,created_at")
    .single();

  if (movementError) {
    await supabaseAdmin
      .from("stock_items")
      .update({ quantity: currentQty, quantity_m2: currentQty })
      .eq("id", stockItem.id)
      .eq("company_id", companyId);

    return NextResponse.json({ error: movementError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      movement: {
        ...movement,
        quantity_m2: Number(movement.quantity_m2 ?? movement.quantity ?? 0),
        unit_price: Number(movement.unit_price ?? 0),
        total_amount: Number(movement.total_amount ?? 0),
      },
      stock_item: {
        ...stockItem,
        quantity: nextQty,
        quantity_m2: nextQty,
        sale_price_per_m2: nextSalePrice,
      },
    },
    { status: 201 }
  );
}
