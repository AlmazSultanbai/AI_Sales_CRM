import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest, getUserIdFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { normalizePhone, normalizeStoreName } from "@/lib/supabase/store-orders-summary";

/**
 * Погашение долга клиента одной суммой.
 *
 * Клиент платит «сколько принёс», сервер раскладывает сумму по его заказам
 * с долгом от старых к новым (FIFO) и создаёт обычные оплаты в order_payments —
 * те же записи, что и оплата из карточки заказа. Пересчёт paid_amount,
 * debt_amount и статуса делает триггер БД, существующие записи не меняются.
 *
 * dry_run = true возвращает распределение без записи: кассир видит, какие
 * заказы закроются, ДО подтверждения.
 */

const payDebtSchema = z.object({
  amount: z.coerce.number().positive("Сумма должна быть больше нуля"),
  payment_method: z.enum(["cash", "bank", "card", "transfer"]).default("cash"),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Неверная дата")
    .default(() => new Date().toISOString().slice(0, 10)),
  comment: z.string().trim().max(500).optional(),
  dry_run: z.boolean().default(false),
});

type DebtOrder = {
  id: string;
  order_number: string;
  order_date: string;
  client_name: string | null;
  phone: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  status: string;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRoleFromRequest(request);
  if (!can(role, "orders:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = payDebtSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const userId = getUserIdFromRequest(request);
  const { id: storeId } = await params;

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id,name,phone")
    .eq("id", storeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  if (!store) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  // Заказы клиента — то же сопоставление, что и в сводке долгов:
  // по названию, иначе по последним 9 цифрам телефона; отменённые не в счёт.
  const { data: orderRows, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id,order_number,order_date,client_name,phone,total_amount,paid_amount,status")
    .eq("company_id", companyId)
    .neq("status", "cancelled")
    .order("order_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  const storeName = normalizeStoreName(store.name);
  const storePhone = normalizePhone(store.phone);

  const debtOrders = ((orderRows ?? []) as DebtOrder[])
    .filter((order) => {
      const byName = storeName && normalizeStoreName(order.client_name) === storeName;
      const byPhone = storePhone && normalizePhone(order.phone) === storePhone;
      return byName || byPhone;
    })
    .map((order) => ({
      ...order,
      debt: round2(Math.max(toNumber(order.total_amount) - toNumber(order.paid_amount), 0)),
    }))
    .filter((order) => order.debt > 0.009);

  const totalDebt = round2(debtOrders.reduce((acc, order) => acc + order.debt, 0));
  const amount = round2(parsed.data.amount);

  if (totalDebt <= 0) {
    return NextResponse.json({ error: "У клиента нет открытых долгов" }, { status: 400 });
  }

  if (amount > totalDebt + 0.01) {
    return NextResponse.json(
      { error: `Сумма больше долга клиента: долг ${totalDebt.toFixed(2)}, внесено ${amount.toFixed(2)}` },
      { status: 400 }
    );
  }

  // FIFO: от старых заказов к новым.
  let rest = amount;
  const distribution = debtOrders
    .map((order) => {
      const pay = round2(Math.min(order.debt, rest));
      rest = round2(rest - pay);
      return {
        order_id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        total_amount: toNumber(order.total_amount),
        debt_before: order.debt,
        pay,
        closes: pay >= order.debt - 0.009,
        debt_after: round2(order.debt - pay),
      };
    })
    .filter((item) => item.pay > 0);

  const summary = {
    store: { id: store.id, name: store.name, phone: store.phone },
    amount,
    payment_method: parsed.data.payment_method,
    payment_date: parsed.data.payment_date,
    debt_before: totalDebt,
    debt_after: round2(totalDebt - amount),
    distribution,
  };

  if (parsed.data.dry_run) {
    return NextResponse.json({ ...summary, dry_run: true });
  }

  // Пишем по одной оплате на заказ: валидацию и пересчёт делает триггер БД.
  const paid: string[] = [];
  for (const item of distribution) {
    const { error } = await supabaseAdmin.from("order_payments").insert({
      company_id: companyId,
      order_id: item.order_id,
      amount: item.pay,
      payment_date: parsed.data.payment_date,
      payment_method: parsed.data.payment_method,
      comment: parsed.data.comment || `Погашение долга клиента «${store.name}»`,
      created_by: userId,
    });

    if (error) {
      return NextResponse.json(
        {
          error: `Оплата записана частично: ${paid.length} из ${distribution.length} заказов (остановились на ${item.order_number}: ${error.message}). Проверьте платежи клиента.`,
          applied_order_ids: paid,
        },
        { status: 500 }
      );
    }
    paid.push(item.order_id);
  }

  return NextResponse.json({ ...summary, dry_run: false, applied: paid.length }, { status: 201 });
}
