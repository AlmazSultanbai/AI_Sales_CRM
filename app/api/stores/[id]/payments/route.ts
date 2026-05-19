import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { can } from "@/lib/auth/rbac";
import { createPaymentSchema } from "@/features/stores/lib/schemas";
import { recalculatePurchaseById, recalculateStoreById } from "@/lib/supabase/stores-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const dateFrom = request.nextUrl.searchParams.get("date_from");
  const dateTo = request.nextUrl.searchParams.get("date_to");
  const method = request.nextUrl.searchParams.get("method");

  let query = supabaseAdmin
    .from("payments")
    .select("*")
    .eq("company_id", companyId)
    .eq("store_id", storeId)
    .order("payment_date", { ascending: false });

  if (dateFrom) query = query.gte("payment_date", dateFrom);
  if (dateTo) query = query.lte("payment_date", dateTo);
  if (method && method !== "all") query = query.eq("payment_method", method);

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

  const parsed = createPaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id: storeId } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const paymentAmount = Number(parsed.data.amount);

  if (parsed.data.purchase_id) {
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("id,debt_amount,store_id,company_id")
      .eq("id", parsed.data.purchase_id)
      .eq("store_id", storeId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 500 });
    }

    if (!purchase) {
      return NextResponse.json({ error: "Закупка не найдена для этого магазина" }, { status: 404 });
    }

    const debtAmount = Number(purchase.debt_amount ?? 0);
    if (paymentAmount > debtAmount) {
      return NextResponse.json(
        { error: `Сумма оплаты не может превышать остаток долга (${debtAmount})` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      company_id: companyId,
      store_id: storeId,
      purchase_id: parsed.data.purchase_id ?? null,
      amount: paymentAmount,
      payment_date: parsed.data.payment_date,
      payment_method: parsed.data.payment_method,
      comment: parsed.data.comment || null,
      created_by: "00000000-0000-0000-0000-000000000101",
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Не удалось добавить оплату" }, { status: 500 });
  }

  if (data.purchase_id) {
    await recalculatePurchaseById(data.purchase_id);
  }
  await recalculateStoreById(storeId);

  return NextResponse.json(data, { status: 201 });
}
