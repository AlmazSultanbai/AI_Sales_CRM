import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { stockInStockFilterSchema, stockListQuerySchema } from "@/features/inventory/lib/schemas";
import { normalizeUnitByCollectionType } from "@/lib/units";

type StockRow = {
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
  last_movement_at: string | null;
  unit: "m2" | "meter" | "piece" | "pack";
  created_at: string;
  updated_at: string;
  collections: { id: string; name: string; type: string } | null;
  collection_models: { id: string; model_code: string; color_name: string; color_hex: string; image_url: string | null; sku: string | null } | null;
};

function applyFilters<T extends { ilike: Function; eq: Function; gt: Function; lte: Function; or: Function }>(
  query: T,
  params: Omit<ReturnType<typeof stockListQuerySchema.parse>, "low_stock">
) {
  let filtered = query;
  if (params.search) {
    const search = params.search.trim();
    filtered = filtered.or(`material_name.ilike.%${search}%,sku.ilike.%${search}%,model_code.ilike.%${search}%,color_name.ilike.%${search}%`);
  }
  if (params.material) filtered = filtered.ilike("material_name", `%${params.material}%`);
  if (params.collection_id) filtered = filtered.eq("collection_id", params.collection_id);
  if (params.model_id) filtered = filtered.eq("collection_model_id", params.model_id);
  if (params.color) filtered = filtered.ilike("color_name", `%${params.color}%`);
  const inStock = stockInStockFilterSchema.parse(params.in_stock ?? "all");
  if (inStock === "in_stock") filtered = filtered.gt("quantity_m2", 0);
  if (inStock === "out_of_stock") filtered = filtered.lte("quantity_m2", 0);

  return filtered;
}

export async function GET(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stocks:read")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const queryParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = stockListQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Неверные параметры" }, { status: 400 });
  }

  const params = parsed.data;
  const lite = request.nextUrl.searchParams.get("lite") === "1";
  const { low_stock: _lowStock, ...filtersWithoutLowStock } = params;
  const from = (params.page - 1) * params.page_size;
  const to = from + params.page_size;
  const selectColumns = lite
    ? "id,company_id,collection_id,collection_model_id,material_name,model_code,color_name,sku,photo_url,quantity,quantity_m2,purchase_price_per_m2,sale_price_per_m2,low_stock_threshold,last_movement_at,unit,created_at,updated_at"
    : "id,company_id,collection_id,collection_model_id,material_name,model_code,color_name,sku,photo_url,quantity,quantity_m2,purchase_price_per_m2,sale_price_per_m2,low_stock_threshold,last_movement_at,unit,created_at,updated_at,collections(id,name,type),collection_models(id,model_code,color_name,color_hex,image_url,sku)";

  let listQuery = supabaseAdmin
    .from("stock_items")
    .select(selectColumns, { count: "exact" })
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  listQuery = applyFilters(listQuery, filtersWithoutLowStock);
  if (params.low_stock !== "true") {
    listQuery = listQuery.range(from, to - 1);
  }

  const { data: rows, error: rowsError, count } = await listQuery;
  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  let stockRows = (rows ?? []) as unknown as StockRow[];
  if (params.low_stock === "true") {
    stockRows = stockRows.filter((item) => Number(item.quantity_m2 ?? item.quantity ?? 0) <= Number(item.low_stock_threshold ?? 10));
  }

  const pagedRows = params.low_stock === "true" ? stockRows.slice(from, to) : stockRows;
  const movementItemIds = pagedRows.map((item) => item.id);
  const lastMovementMap = new Map<string, { created_at: string; movement_type: string; supplier_name: string | null; source_store_id: string | null; destination_store_id: string | null }>();

  if (!lite && movementItemIds.length) {
    const { data: movements } = await supabaseAdmin
      .from("stock_movements")
      .select("stock_item_id,created_at,movement_type,supplier_name,source_store_id,destination_store_id")
      .eq("company_id", companyId)
      .in("stock_item_id", movementItemIds)
      .order("created_at", { ascending: false });

    for (const movement of movements ?? []) {
      if (!movement.stock_item_id || lastMovementMap.has(movement.stock_item_id)) continue;
      lastMovementMap.set(movement.stock_item_id, {
        created_at: movement.created_at,
        movement_type: movement.movement_type,
        supplier_name: movement.supplier_name,
        source_store_id: movement.source_store_id,
        destination_store_id: movement.destination_store_id,
      });
    }
  }
  let summaryValue = { totalItems: 0, totalQuantity: 0, totalAmount: 0, lowStockItems: 0 };
  if (!lite) {
    let summaryQuery = supabaseAdmin
      .from("stock_items")
      .select("quantity_m2,purchase_price_per_m2,low_stock_threshold")
      .eq("company_id", companyId);
    summaryQuery = applyFilters(summaryQuery, filtersWithoutLowStock);
    const { data: summaryRows, error: summaryError } = await summaryQuery;
    if (summaryError) {
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    summaryValue = (summaryRows ?? []).reduce(
      (acc, row) => {
        const quantity = Number(row.quantity_m2 ?? 0);
        const price = Number(row.purchase_price_per_m2 ?? 0);
        const threshold = Number(row.low_stock_threshold ?? 10);

        acc.totalItems += 1;
        acc.totalQuantity += quantity;
        acc.totalAmount += quantity * price;
        if (quantity > 0 && quantity <= threshold) acc.lowStockItems += 1;
        return acc;
      },
      { totalItems: 0, totalQuantity: 0, totalAmount: 0, lowStockItems: 0 }
    );
  }

  return NextResponse.json({
    items: pagedRows.map((item) => ({
      ...item,
      quantity_m2: Number(item.quantity_m2 ?? item.quantity ?? 0),
      purchase_price_per_m2: Number(item.purchase_price_per_m2 ?? 0),
      sale_price_per_m2: item.sale_price_per_m2 == null ? null : Number(item.sale_price_per_m2),
      low_stock_threshold: Number(item.low_stock_threshold ?? 10),
      unit: normalizeUnitByCollectionType(item.collections?.type, item.unit),
      lastMovement: lastMovementMap.get(item.id) ?? null,
    })),
    summary: summaryValue,
    pagination: {
      page: params.page,
      pageSize: params.page_size,
      total: params.low_stock === "true" ? stockRows.length : Number(count ?? 0),
      totalPages: Math.max(1, Math.ceil((params.low_stock === "true" ? stockRows.length : Number(count ?? 0)) / params.page_size)),
    },
  });
}
