import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest, getUserIdFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { createOrderSchema, orderListQuerySchema } from "@/features/orders/lib/schemas";
import {
  applyStockForOrder,
  assertStockAvailability,
  computeOrderTotals,
  generateOrderNumber,
  shouldApplyStock,
} from "@/lib/supabase/orders-service";

type OrderRow = {
  id: string;
  company_id: string;
  order_number: string;
  order_date: string;
  address: string;
  client_name: string | null;
  phone: string | null;
  total_amount: number;
  installation_amount: number;
  workshop_total: number;
  materials_sale_total: number;
  materials_cost_total: number;
  total_expenses: number;
  gross_profit: number;
  margin_percent: number;
  comment: string | null;
  status: "draft" | "confirmed" | "completed" | "cancelled";
  stock_applied: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  order_items?: Array<{
    id: string;
    material_name_snapshot: string;
    model_snapshot: string | null;
    sku_snapshot: string | null;
  }>;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function GET(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:read")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = orderListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Неверные параметры" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const { page, page_size: pageSize, status, date_from: dateFrom, date_to: dateTo, search, client, phone, address, material, user: userFilter } = parsed.data;

  let query = supabaseAdmin
    .from("orders")
    .select(
      "id,company_id,order_number,order_date,address,client_name,phone,total_amount,installation_amount,workshop_total,materials_sale_total,materials_cost_total,total_expenses,gross_profit,margin_percent,comment,status,stock_applied,created_by,created_at,updated_at,order_items(id,material_name_snapshot,model_snapshot,sku_snapshot)"
    )
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (dateFrom) query = query.gte("order_date", dateFrom);
  if (dateTo) query = query.lte("order_date", dateTo);
  if (client) query = query.ilike("client_name", `%${client}%`);
  if (phone) query = query.ilike("phone", `%${phone}%`);
  if (address) query = query.ilike("address", `%${address}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as OrderRow[];

  if (search) {
    const lower = search.toLowerCase();
    rows = rows.filter((row) => {
      const haystack = [row.order_number, row.address, row.client_name, row.phone].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(lower);
    });
  }

  if (material) {
    const lower = material.toLowerCase();
    rows = rows.filter((row) => (row.order_items ?? []).some((item) => item.material_name_snapshot.toLowerCase().includes(lower)));
  }

  const userIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean) as string[]));
  const { data: userRows } = userIds.length
    ? await supabaseAdmin.from("users").select("id,full_name").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const usersMap = new Map((userRows ?? []).map((user) => [user.id, user.full_name]));

  if (userFilter) {
    const lower = userFilter.toLowerCase();
    rows = rows.filter((row) => {
      const creatorName = row.created_by ? usersMap.get(row.created_by) ?? row.created_by : "";
      return String(creatorName).toLowerCase().includes(lower);
    });
  }

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalOrders += 1;
      acc.totalAmount += toNumber(row.total_amount);
      acc.installationTotal += toNumber(row.installation_amount);
      acc.workshopTotal += toNumber(row.workshop_total);
      acc.profitTotal += toNumber(row.gross_profit);
      if (row.status === "cancelled") acc.cancelled += 1;
      if (row.status === "draft") acc.draft += 1;
      return acc;
    },
    {
      totalOrders: 0,
      totalAmount: 0,
      installationTotal: 0,
      workshopTotal: 0,
      profitTotal: 0,
      cancelled: 0,
      draft: 0,
    }
  );

  const from = (page - 1) * pageSize;
  const pagedRows = rows.slice(from, from + pageSize);

  return NextResponse.json({
    items: pagedRows.map((row) => ({
      ...row,
      total_amount: toNumber(row.total_amount),
      installation_amount: toNumber(row.installation_amount),
      workshop_total: toNumber(row.workshop_total),
      materials_sale_total: toNumber(row.materials_sale_total),
      materials_cost_total: toNumber(row.materials_cost_total),
      total_expenses: toNumber(row.total_expenses),
      gross_profit: toNumber(row.gross_profit),
      margin_percent: toNumber(row.margin_percent),
      materials_preview: (row.order_items ?? []).slice(0, 3).map((item) => item.material_name_snapshot).join(", "),
      creator_name: row.created_by ? usersMap.get(row.created_by) ?? row.created_by : null,
    })),
    summary,
    pagination: {
      page,
      pageSize,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
    },
  });
}

export async function POST(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const userId = getUserIdFromRequest(request);
  const payload = parsed.data;

  const enrichedItems = payload.items.map((item) => ({
    ...item,
    sale_amount: toNumber(item.quantity_m2) * toNumber(item.sale_price_per_m2),
    cost_amount: toNumber(item.quantity_m2) * toNumber(item.cost_price_per_m2),
  }));

  const totals = computeOrderTotals({
    items: payload.items,
    installation_amount: payload.installation_amount,
    total_amount: payload.total_amount ?? null,
    workshop_total: payload.workshop_total ?? null,
  });

  try {
    await assertStockAvailability(
      companyId,
      payload.items.map((item, index) => ({
        id: `new-${index}`,
        stock_item_id: item.stock_item_id ?? null,
        collection_id: item.collection_id ?? null,
        collection_model_id: item.collection_model_id ?? null,
        material_name_snapshot: item.material_name_snapshot,
        sku_snapshot: item.sku_snapshot ?? null,
        unit: item.unit,
        quantity_m2: toNumber(item.quantity_m2),
        cost_price_per_m2: toNumber(item.cost_price_per_m2),
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "На складе недостаточно остатков для сохранения заказа" },
      { status: 409 }
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      company_id: companyId,
      order_number: generateOrderNumber(),
      order_date: payload.order_date,
      address: payload.address,
      client_name: payload.client_name ?? null,
      phone: payload.phone ?? null,
      total_amount: totals.total_amount,
      installation_amount: totals.installation_amount,
      workshop_total: totals.workshop_total,
      materials_sale_total: totals.materials_sale_total,
      materials_cost_total: totals.materials_cost_total,
      total_expenses: totals.total_expenses,
      gross_profit: totals.gross_profit,
      margin_percent: totals.margin_percent,
      comment: payload.comment ?? null,
      status: payload.status,
      stock_applied: false,
      created_by: userId,
    })
    .select("*")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Не удалось создать заказ" }, { status: 500 });
  }

  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .insert(
      enrichedItems.map((item) => ({
        order_id: order.id,
        stock_item_id: item.stock_item_id ?? null,
        collection_id: item.collection_id ?? null,
        collection_model_id: item.collection_model_id ?? null,
        material_name_snapshot: item.material_name_snapshot,
        model_snapshot: item.model_snapshot ?? null,
        color_snapshot: item.color_snapshot ?? null,
        sku_snapshot: item.sku_snapshot ?? null,
        unit: item.unit,
        quantity_m2: item.quantity_m2,
        sale_price_per_m2: item.sale_price_per_m2,
        sale_amount: item.sale_amount,
        cost_price_per_m2: item.cost_price_per_m2,
        cost_amount: item.cost_amount,
      }))
    )
    .select("*");

  if (itemsError || !orderItems) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError?.message ?? "Не удалось сохранить позиции заказа" }, { status: 500 });
  }

  try {
    if (shouldApplyStock(order.status)) {
      await applyStockForOrder({
        companyId,
        orderId: order.id,
        orderNumber: order.order_number,
        items: orderItems.map((item) => ({
          id: item.id,
          stock_item_id: item.stock_item_id,
          collection_id: item.collection_id,
          collection_model_id: item.collection_model_id,
          material_name_snapshot: item.material_name_snapshot,
          sku_snapshot: item.sku_snapshot,
          unit: item.unit,
          quantity_m2: toNumber(item.quantity_m2),
          cost_price_per_m2: toNumber(item.cost_price_per_m2),
        })),
        movementType: "outgoing",
        userId,
        commentPrefix: "Расход по заказу. ",
      });

      await supabaseAdmin.from("orders").update({ stock_applied: true }).eq("id", order.id);
    }
  } catch (error) {
    await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось списать материалы со склада" },
      { status: 409 }
    );
  }

  const { data: fullOrder, error: fullOrderError } = await supabaseAdmin
    .from("orders")
    .select("*,order_items(*)")
    .eq("id", order.id)
    .single();
  if (fullOrderError) return NextResponse.json({ error: fullOrderError.message }, { status: 500 });

  return NextResponse.json(fullOrder, { status: 201 });
}
