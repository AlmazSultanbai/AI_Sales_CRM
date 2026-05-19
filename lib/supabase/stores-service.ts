import { supabaseAdmin } from "@/lib/supabase/admin-client";

export async function recalculatePurchaseById(purchaseId: string) {
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("purchase_items")
    .select("total_price")
    .eq("purchase_id", purchaseId);

  if (itemsError) throw itemsError;

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("purchase_id", purchaseId);

  if (paymentsError) throw paymentsError;

  const totalAmount = (items ?? []).reduce((sum, item) => sum + Number(item.total_price), 0);
  const paidAmount = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const debtAmount = Math.max(totalAmount - paidAmount, 0);

  const paymentStatus = debtAmount <= 0 && totalAmount > 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

  const { error } = await supabaseAdmin
    .from("purchases")
    .update({
      total_amount: totalAmount,
      paid_amount: paidAmount,
      debt_amount: debtAmount,
      payment_status: paymentStatus,
    })
    .eq("id", purchaseId);

  if (error) throw error;
}

export async function recalculateStoreById(storeId: string) {
  const { data: purchases, error: purchasesError } = await supabaseAdmin
    .from("purchases")
    .select("total_amount,debt_amount,created_at")
    .eq("store_id", storeId);

  if (purchasesError) throw purchasesError;

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("amount,created_at")
    .eq("store_id", storeId);

  if (paymentsError) throw paymentsError;

  const totalPurchases = (purchases ?? []).reduce((sum, p) => sum + Number(p.total_amount), 0);
  const currentDebt = (purchases ?? []).reduce((sum, p) => sum + Number(p.debt_amount), 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const lastPurchaseDate = (purchases ?? []).map((p) => new Date(p.created_at).getTime());
  const lastPaymentDate = (payments ?? []).map((p) => new Date(p.created_at).getTime());
  const timestamps = [...lastPurchaseDate, ...lastPaymentDate].filter((value) => Number.isFinite(value));
  const lastActivity = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  const { error } = await supabaseAdmin
    .from("stores")
    .update({
      total_purchases_sum: totalPurchases,
      total_paid_sum: totalPaid,
      current_debt_sum: currentDebt,
      debt_balance: currentDebt,
      last_activity_at: lastActivity,
    })
    .eq("id", storeId);

  if (error) throw error;
}

export async function recalculateStoreFromPurchase(purchaseId: string) {
  const { data: purchase, error } = await supabaseAdmin
    .from("purchases")
    .select("store_id")
    .eq("id", purchaseId)
    .single();

  if (error || !purchase) throw error;

  await recalculateStoreById(purchase.store_id);
}
