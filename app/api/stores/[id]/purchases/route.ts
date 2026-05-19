import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { can } from "@/lib/auth/rbac";
import { createPurchaseSchema, purchaseStatusSchema } from "@/features/stores/lib/schemas";
import { recalculatePurchaseById, recalculateStoreById } from "@/lib/supabase/stores-service";
import { reserveStockForPurchase, restoreStockForPurchase } from "@/lib/supabase/stock-service";

function generatePurchaseNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(
    2,
    "0"
  )}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds()
  ).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0")}`;
  return `PUR-${stamp}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const status = purchaseStatusSchema.parse(request.nextUrl.searchParams.get("status") ?? "all");
  const dateFrom = request.nextUrl.searchParams.get("date_from");
  const dateTo = request.nextUrl.searchParams.get("date_to");
  const minAmount = request.nextUrl.searchParams.get("min_amount");
  const maxAmount = request.nextUrl.searchParams.get("max_amount");

  let query = supabaseAdmin
    .from("purchases")
    .select("*,purchase_items(*),payments(*)")
    .eq("company_id", companyId)
    .eq("store_id", storeId)
    .order("purchase_date", { ascending: false });

  if (status !== "all") {
    query = query.eq("payment_status", status);
  }

  if (dateFrom) query = query.gte("purchase_date", dateFrom);
  if (dateTo) query = query.lte("purchase_date", dateTo);
  if (minAmount) query = query.gte("total_amount", Number(minAmount));
  if (maxAmount) query = query.lte("total_amount", Number(maxAmount));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stores:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createPurchaseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id: storeId } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const stockItems = parsed.data.items.map((item) => ({
    collection_id: item.collection_id ?? null,
    collection_model_id: item.collection_model_id ?? null,
    item_name_snapshot: item.item_name_snapshot,
    quantity: Number(item.quantity),
    unit: item.unit,
  }));

  try {
    await reserveStockForPurchase(companyId, stockItems, { comment: "Расход по новой закупке магазина" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Недостаточно остатка на складе" },
      { status: 409 }
    );
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .insert({
      company_id: companyId,
      store_id: storeId,
      purchase_number: generatePurchaseNumber(),
      purchase_date: parsed.data.purchase_date,
      comment: parsed.data.comment || null,
      created_by: "00000000-0000-0000-0000-000000000101",
    })
    .select("*")
    .single();

  if (purchaseError || !purchase) {
    await restoreStockForPurchase(companyId, stockItems, { comment: "Откат расхода: закупка не создана" }).catch(() => null);
    return NextResponse.json({ error: purchaseError?.message ?? "Не удалось создать закупку" }, { status: 500 });
  }

  const itemsPayload = parsed.data.items.map((item) => ({
    purchase_id: purchase.id,
    collection_id: item.collection_id ?? null,
    collection_model_id: item.collection_model_id ?? null,
    item_name_snapshot: item.item_name_snapshot,
    item_image_url_snapshot: item.item_image_url_snapshot ?? null,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: Number(item.quantity) * Number(item.unit_price),
  }));

  const { error: itemsError } = await supabaseAdmin.from("purchase_items").insert(itemsPayload);
  if (itemsError) {
    await supabaseAdmin.from("purchases").delete().eq("id", purchase.id);
    await restoreStockForPurchase(companyId, stockItems, { comment: "Откат расхода: ошибка позиций закупки" }).catch(() => null);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  await recalculatePurchaseById(purchase.id);
  await recalculateStoreById(storeId);

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("*,purchase_items(*),payments(*)")
    .eq("id", purchase.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
