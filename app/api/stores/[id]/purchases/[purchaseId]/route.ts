import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { can } from "@/lib/auth/rbac";
import { updatePurchaseSchema } from "@/features/stores/lib/schemas";
import { recalculatePurchaseById, recalculateStoreById } from "@/lib/supabase/stores-service";
import { reserveStockForPurchase, restoreStockForPurchase } from "@/lib/supabase/stock-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  const { id: storeId, purchaseId } = await params;
  const companyId = getCompanyIdFromRequest(request);

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("*,purchase_items(*),payments(*)")
    .eq("id", purchaseId)
    .eq("store_id", storeId)
    .eq("company_id", companyId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stores:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = updatePurchaseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id: storeId, purchaseId } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const { data: currentPurchase, error: currentPurchaseError } = await supabaseAdmin
    .from("purchases")
    .select("id,purchase_items(collection_id,collection_model_id,item_name_snapshot,quantity,unit)")
    .eq("id", purchaseId)
    .eq("store_id", storeId)
    .eq("company_id", companyId)
    .single();

  if (currentPurchaseError || !currentPurchase) {
    return NextResponse.json({ error: currentPurchaseError?.message ?? "Закупка не найдена" }, { status: 404 });
  }

  const oldStockItems = (currentPurchase.purchase_items ?? []).map((item) => ({
    collection_id: item.collection_id ?? null,
    collection_model_id: item.collection_model_id ?? null,
    item_name_snapshot: item.item_name_snapshot,
    quantity: Number(item.quantity),
    unit: item.unit as "m2" | "meter" | "piece" | "pack",
  }));
  const newStockItems = parsed.data.items.map((item) => ({
    collection_id: item.collection_id ?? null,
    collection_model_id: item.collection_model_id ?? null,
    item_name_snapshot: item.item_name_snapshot,
    quantity: Number(item.quantity),
    unit: item.unit,
  }));

  try {
    await restoreStockForPurchase(companyId, oldStockItems, { comment: "Возврат остатков перед обновлением закупки" });
    await reserveStockForPurchase(companyId, newStockItems, { comment: "Расход после обновления закупки" });
  } catch (error) {
    await reserveStockForPurchase(companyId, oldStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Недостаточно остатка на складе" },
      { status: 409 }
    );
  }

  const { error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .update({
      purchase_date: parsed.data.purchase_date,
      comment: parsed.data.comment || null,
    })
    .eq("id", purchaseId)
    .eq("store_id", storeId)
    .eq("company_id", companyId);

  if (purchaseError) {
    await restoreStockForPurchase(companyId, newStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    await reserveStockForPurchase(companyId, oldStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }

  const { error: deleteItemsError } = await supabaseAdmin.from("purchase_items").delete().eq("purchase_id", purchaseId);
  if (deleteItemsError) {
    await restoreStockForPurchase(companyId, newStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    await reserveStockForPurchase(companyId, oldStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    return NextResponse.json({ error: deleteItemsError.message }, { status: 500 });
  }

  const itemsPayload = parsed.data.items.map((item) => ({
    purchase_id: purchaseId,
    collection_id: item.collection_id ?? null,
    collection_model_id: item.collection_model_id ?? null,
    item_name_snapshot: item.item_name_snapshot,
    item_image_url_snapshot: item.item_image_url_snapshot ?? null,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: Number(item.quantity) * Number(item.unit_price),
  }));

  const { error: insertItemsError } = await supabaseAdmin.from("purchase_items").insert(itemsPayload);
  if (insertItemsError) {
    await restoreStockForPurchase(companyId, newStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    await reserveStockForPurchase(companyId, oldStockItems, { comment: "Откат обновления закупки" }).catch(() => null);
    return NextResponse.json({ error: insertItemsError.message }, { status: 500 });
  }

  await recalculatePurchaseById(purchaseId);
  await recalculateStoreById(storeId);

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("*,purchase_items(*),payments(*)")
    .eq("id", purchaseId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stores:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id: storeId, purchaseId } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .select("id,purchase_items(collection_id,collection_model_id,item_name_snapshot,quantity,unit)")
    .eq("id", purchaseId)
    .eq("store_id", storeId)
    .eq("company_id", companyId)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: purchaseError?.message ?? "Закупка не найдена" }, { status: 404 });
  }

  const stockItems = (purchase.purchase_items ?? []).map((item) => ({
    collection_id: item.collection_id ?? null,
    collection_model_id: item.collection_model_id ?? null,
    item_name_snapshot: item.item_name_snapshot,
    quantity: Number(item.quantity),
    unit: item.unit as "m2" | "meter" | "piece" | "pack",
  }));

  try {
    await restoreStockForPurchase(companyId, stockItems, { comment: "Возврат остатков после удаления закупки" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось восстановить остаток на складе" },
      { status: 500 }
    );
  }

  const { error } = await supabaseAdmin
    .from("purchases")
    .delete()
    .eq("id", purchaseId)
    .eq("store_id", storeId)
    .eq("company_id", companyId);

  if (error) {
    await reserveStockForPurchase(companyId, stockItems, { comment: "Откат удаления закупки" }).catch(() => null);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recalculateStoreById(storeId);
  return NextResponse.json({ success: true });
}
