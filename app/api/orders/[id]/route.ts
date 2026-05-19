import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest, getUserIdFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { orderStatusSchema, updateOrderSchema } from "@/features/orders/lib/schemas";
import {
  applyStockForOrder,
  assertStockAvailability,
  computeOrderTotals,
  generateOrderNumber,
  shouldApplyStock,
} from "@/lib/supabase/orders-service";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

async function loadOrder(companyId: string, orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*,order_items(*)")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .single();
  if (error || !data) return null;
  return data as {
    id: string;
    company_id: string;
    order_number: string;
    status: "draft" | "confirmed" | "completed" | "cancelled";
    stock_applied: boolean;
    order_items: Array<{
      id: string;
      stock_item_id: string | null;
      collection_id: string | null;
      collection_model_id: string | null;
      material_name_snapshot: string;
      model_snapshot: string | null;
      color_snapshot: string | null;
      sku_snapshot: string | null;
      unit: "m2" | "meter" | "piece" | "pack";
      quantity_m2: number;
      sale_price_per_m2: number;
      cost_price_per_m2: number;
    }>;
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:read")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const { id } = await params;
  const order = await loadOrder(companyId, id);

  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const { data: movements } = await supabaseAdmin
    .from("stock_movements")
    .select("id,movement_type,quantity,quantity_m2,unit_price,total_amount,comment,movement_date,created_at,linked_order_item_id,stock_items(id,material_name,model_code,color_name,sku,unit)")
    .eq("company_id", companyId)
    .eq("linked_order_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    ...order,
    movements: movements ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const userId = getUserIdFromRequest(request);
  const { id } = await params;
  const body = await request.json();
  const action = typeof body?.action === "string" ? body.action : null;
  const order = await loadOrder(companyId, id);

  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  if (action === "duplicate") {
    const sourceOrder = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order.id)
      .eq("company_id", companyId)
      .single();
    if (sourceOrder.error || !sourceOrder.data) {
      return NextResponse.json({ error: sourceOrder.error?.message ?? "Не удалось загрузить заказ для копирования" }, { status: 500 });
    }

    const { data: duplicated, error: duplicateError } = await supabaseAdmin
      .from("orders")
      .insert({
        company_id: sourceOrder.data.company_id,
        order_number: generateOrderNumber(),
        order_date: new Date().toISOString().slice(0, 10),
        address: sourceOrder.data.address,
        client_name: sourceOrder.data.client_name,
        phone: sourceOrder.data.phone,
        total_amount: sourceOrder.data.total_amount,
        installation_amount: sourceOrder.data.installation_amount,
        workshop_total: sourceOrder.data.workshop_total,
        materials_sale_total: sourceOrder.data.materials_sale_total,
        materials_cost_total: sourceOrder.data.materials_cost_total,
        total_expenses: sourceOrder.data.total_expenses,
        gross_profit: sourceOrder.data.gross_profit,
        margin_percent: sourceOrder.data.margin_percent,
        comment: sourceOrder.data.comment,
        status: "draft",
        stock_applied: false,
        created_by: userId,
      })
      .select("*")
      .single();

    if (duplicateError || !duplicated) {
      return NextResponse.json({ error: duplicateError?.message ?? "Не удалось дублировать заказ" }, { status: 500 });
    }

    const { data: srcItems } = await supabaseAdmin.from("order_items").select("*").eq("order_id", order.id);
    if ((srcItems ?? []).length) {
      await supabaseAdmin.from("order_items").insert(
        (srcItems ?? []).map((item) => ({
          order_id: duplicated.id,
          stock_item_id: item.stock_item_id,
          collection_id: item.collection_id,
          collection_model_id: item.collection_model_id,
          material_name_snapshot: item.material_name_snapshot,
          model_snapshot: item.model_snapshot,
          color_snapshot: item.color_snapshot,
          sku_snapshot: item.sku_snapshot,
          unit: item.unit,
          quantity_m2: item.quantity_m2,
          sale_price_per_m2: item.sale_price_per_m2,
          sale_amount: item.sale_amount,
          cost_price_per_m2: item.cost_price_per_m2,
          cost_amount: item.cost_amount,
        }))
      );
    }
    return NextResponse.json(duplicated);
  }

  if (action === "status") {
    const statusParsed = orderStatusSchema.safeParse(body?.status);
    if (!statusParsed.success) {
      return NextResponse.json({ error: "Неверный статус заказа" }, { status: 400 });
    }
    const nextStatus = statusParsed.data;

    if (nextStatus === order.status) {
      return NextResponse.json({ ok: true });
    }

    if (nextStatus === "cancelled" && order.stock_applied) {
      await applyStockForOrder({
        companyId,
        orderId: order.id,
        orderNumber: order.order_number,
        items: order.order_items.map((item) => ({
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
        movementType: "incoming",
        userId,
        commentPrefix: "Возврат по отмене заказа. ",
      });

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ status: nextStatus, stock_applied: false, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("company_id", companyId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (shouldApplyStock(nextStatus) && !order.stock_applied) {
      try {
        await applyStockForOrder({
          companyId,
          orderId: order.id,
          orderNumber: order.order_number,
          items: order.order_items.map((item) => ({
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
          commentPrefix: "Расход по подтвержденному заказу. ",
        });

        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({ status: nextStatus, stock_applied: true, updated_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("company_id", companyId);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "На складе недостаточно остатков для подтверждения заказа" },
          { status: 409 }
        );
      }
    }

    const { error: statusError } = await supabaseAdmin
      .from("orders")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("company_id", companyId);
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  if (order.stock_applied && parsed.data.items) {
    return NextResponse.json(
      { error: "Нельзя менять материалы у подтвержденного заказа. Отмените заказ для редактирования." },
      { status: 409 }
    );
  }

  const items = (parsed.data.items ?? order.order_items).map((item) => ({
    ...item,
    quantity_m2: toNumber(item.quantity_m2),
    sale_price_per_m2: toNumber(item.sale_price_per_m2),
    cost_price_per_m2: toNumber(item.cost_price_per_m2),
  }));
  const totals = computeOrderTotals({
    items,
    installation_amount: parsed.data.installation_amount ?? null,
    total_amount: parsed.data.total_amount ?? null,
    workshop_total: parsed.data.workshop_total ?? null,
  });

  try {
    await assertStockAvailability(
      companyId,
      items.map((item, index) => ({
        id: item.id ?? `upd-${index}`,
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

  const nextStatus = parsed.data.status ?? order.status;
  const { error: orderUpdateError } = await supabaseAdmin
    .from("orders")
    .update({
      order_date: parsed.data.order_date ?? undefined,
      address: parsed.data.address ?? undefined,
      client_name: parsed.data.client_name ?? undefined,
      phone: parsed.data.phone ?? undefined,
      total_amount: totals.total_amount,
      installation_amount: totals.installation_amount,
      workshop_total: totals.workshop_total,
      materials_sale_total: totals.materials_sale_total,
      materials_cost_total: totals.materials_cost_total,
      total_expenses: totals.total_expenses,
      gross_profit: totals.gross_profit,
      margin_percent: totals.margin_percent,
      comment: parsed.data.comment ?? undefined,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("company_id", companyId);
  if (orderUpdateError) return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });

  if (parsed.data.items) {
    await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
    const { error: insertItemsError } = await supabaseAdmin.from("order_items").insert(
      items.map((item) => ({
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
        sale_amount: item.quantity_m2 * item.sale_price_per_m2,
        cost_price_per_m2: item.cost_price_per_m2,
        cost_amount: item.quantity_m2 * item.cost_price_per_m2,
      }))
    );
    if (insertItemsError) return NextResponse.json({ error: insertItemsError.message }, { status: 500 });
  }

  if (shouldApplyStock(nextStatus) && !order.stock_applied) {
    const fresh = await loadOrder(companyId, order.id);
    if (!fresh) return NextResponse.json({ error: "Заказ не найден после обновления" }, { status: 404 });
    try {
      await applyStockForOrder({
        companyId,
        orderId: fresh.id,
        orderNumber: fresh.order_number,
        items: fresh.order_items.map((item) => ({
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
        commentPrefix: "Расход после обновления заказа. ",
      });
      await supabaseAdmin.from("orders").update({ stock_applied: true }).eq("id", order.id);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "На складе недостаточно остатков для подтверждения заказа" },
        { status: 409 }
      );
    }
  }

  const updated = await loadOrder(companyId, order.id);
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const userId = getUserIdFromRequest(request);
  const { id } = await params;

  const order = await loadOrder(companyId, id);
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  if (order.stock_applied) {
    await applyStockForOrder({
      companyId,
      orderId: order.id,
      orderNumber: order.order_number,
      items: order.order_items.map((item) => ({
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
      movementType: "incoming",
      userId,
      commentPrefix: "Возврат по удалению заказа. ",
    });
  }

  await supabaseAdmin.from("orders").delete().eq("id", order.id).eq("company_id", companyId);
  return NextResponse.json({ ok: true });
}
