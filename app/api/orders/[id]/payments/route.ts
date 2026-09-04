import { NextRequest, NextResponse } from "next/server";
import { createOrderPaymentSchema } from "@/features/orders/lib/schemas";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest, getUserIdFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createOrderPaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const userId = getUserIdFromRequest(request);
  const { id: orderId } = await params;
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id,total_amount,paid_amount,debt_amount")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const amount = Number(parsed.data.amount);
  // Долг всегда из формулы: хранимый debt_amount у части заказов не пересчитан
  // и держит 0 при нулевой оплате — такая проверка блокировала честные оплаты.
  const debtAmount = Math.max(Number(order.total_amount ?? 0) - Number(order.paid_amount ?? 0), 0);
  if (amount > debtAmount + 0.01) {
    return NextResponse.json(
      { error: `Сумма оплаты не может превышать остаток долга (${debtAmount})` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("order_payments")
    .insert({
      company_id: companyId,
      order_id: orderId,
      amount,
      payment_date: parsed.data.payment_date,
      payment_method: parsed.data.payment_method,
      comment: parsed.data.comment || null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Не удалось сохранить оплату" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
