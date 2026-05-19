import { PurchaseStatus } from "@/types/domain";

export function formatCurrency(value: number) {
  return `${Number(value).toLocaleString("ru-RU")} c`;
}

export function formatPurchaseId(id: string) {
  if (id.startsWith("PUR-")) {
    return id.replace("PUR-", "Закуп №");
  }
  return id;
}

export function paymentStatusMeta(status: PurchaseStatus) {
  if (status === "paid") return { label: "Оплачено", className: "bg-emerald-100 text-emerald-700" };
  if (status === "partial") return { label: "Частично", className: "bg-amber-100 text-amber-700" };
  return { label: "Не оплачено", className: "bg-rose-100 text-rose-700" };
}

export function debtRiskByDays(days: number) {
  if (days <= 7) return { label: "Норма", className: "bg-slate-100 text-slate-700" };
  if (days <= 30) return { label: "Внимание", className: "bg-amber-100 text-amber-700" };
  return { label: "Риск", className: "bg-rose-100 text-rose-700" };
}

export function storeDebtIndicator(debt: number) {
  if (debt <= 0) return "bg-emerald-500";
  if (debt < 10000) return "bg-amber-500";
  return "bg-rose-500";
}
