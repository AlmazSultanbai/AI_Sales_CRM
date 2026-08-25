import { supabaseAdmin } from "@/lib/supabase/admin-client";

/**
 * Финансы магазина считаются по его заказам: модуль закупок (purchases/payments)
 * в работе не используется, поэтому суммы в колонках stores.* остаются нулевыми.
 * Отменённые заказы в расчёт не берём — обязательства по ним нет.
 */

export type StoreOrdersTotals = {
  ordersCount: number;
  ordersTotal: number;
  paidTotal: number;
  debtTotal: number;
  lastActivityAt: string | null;
};

export const emptyStoreTotals: StoreOrdersTotals = {
  ordersCount: 0,
  ordersTotal: 0,
  paidTotal: 0,
  debtTotal: 0,
  lastActivityAt: null,
};

type OrderRow = {
  client_name: string | null;
  phone: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  status: string | null;
  updated_at: string | null;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export function normalizeStoreName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

function addOrder(totals: StoreOrdersTotals, order: OrderRow) {
  const total = toNumber(order.total_amount);
  const paid = toNumber(order.paid_amount);

  totals.ordersCount += 1;
  totals.ordersTotal += total;
  totals.paidTotal += paid;
  totals.debtTotal += Math.max(total - paid, 0);

  if (order.updated_at && (!totals.lastActivityAt || order.updated_at > totals.lastActivityAt)) {
    totals.lastActivityAt = order.updated_at;
  }
}

export type StoreTotalsIndex = {
  byName: Map<string, StoreOrdersTotals>;
  byPhone: Map<string, StoreOrdersTotals>;
};

export async function loadStoreTotalsIndex(companyId: string): Promise<StoreTotalsIndex> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("client_name,phone,total_amount,paid_amount,status,updated_at")
    .eq("company_id", companyId)
    .neq("status", "cancelled");

  if (error) throw error;

  const byName = new Map<string, StoreOrdersTotals>();
  const byPhone = new Map<string, StoreOrdersTotals>();

  for (const order of (data ?? []) as OrderRow[]) {
    const name = normalizeStoreName(order.client_name);
    if (name) {
      const totals = byName.get(name) ?? { ...emptyStoreTotals };
      addOrder(totals, order);
      byName.set(name, totals);
    }

    const phone = normalizePhone(order.phone);
    if (phone) {
      const totals = byPhone.get(phone) ?? { ...emptyStoreTotals };
      addOrder(totals, order);
      byPhone.set(phone, totals);
    }
  }

  return { byName, byPhone };
}

/**
 * Заказ мог попасть и в совпадение по названию, и в совпадение по телефону —
 * поэтому берём одно совпадение: сначала по названию, иначе по телефону.
 */
export function pickStoreTotals(
  index: StoreTotalsIndex,
  store: { name?: string | null; phone?: string | null }
): StoreOrdersTotals {
  const byName = index.byName.get(normalizeStoreName(store.name));
  if (byName) return byName;

  const phone = normalizePhone(store.phone);
  if (phone) {
    const byPhone = index.byPhone.get(phone);
    if (byPhone) return byPhone;
  }

  return { ...emptyStoreTotals };
}

export function applyStoreTotals<T extends Record<string, unknown>>(store: T, totals: StoreOrdersTotals) {
  return {
    ...store,
    total_purchases_sum: totals.ordersTotal,
    total_paid_sum: totals.paidTotal,
    current_debt_sum: totals.debtTotal,
    debt_balance: totals.debtTotal,
    orders_count: totals.ordersCount,
    last_activity_at: totals.lastActivityAt ?? (store.last_activity_at as string | null) ?? null,
  };
}
