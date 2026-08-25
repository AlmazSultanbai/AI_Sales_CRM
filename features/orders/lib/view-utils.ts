import { OrderPaymentStatus, OrderStatus } from "@/types/domain";
import { formatMoney } from "@/lib/format";

export function orderStatusMeta(status: OrderStatus) {
  switch (status) {
    case "draft":
      return { label: "Черновик", className: "bg-slate-100 text-slate-700 border-slate-200" };
    case "confirmed":
      return { label: "Подтвержден", className: "bg-blue-50 text-blue-700 border-blue-200" };
    case "completed":
      return { label: "Выполнен", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "cancelled":
      return { label: "Отменен", className: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
  }
}

export function orderPaymentStatusMeta(status: OrderPaymentStatus, paidAmount = 0, totalAmount = 0) {
  switch (status) {
    case "paid":
      return { label: "Оплачен", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "partial":
      if (totalAmount > 0 && paidAmount / totalAmount <= 0.5) {
        return { label: "Оплачено до 50%", className: "bg-rose-50 text-rose-700 border-rose-200" };
      }
      return { label: "Оплачено более 50%", className: "bg-amber-50 text-amber-700 border-amber-200" };
    default:
      return { label: "Не оплачен", className: "bg-rose-50 text-rose-700 border-rose-200" };
  }
}

export function formatCurrency(value: number) {
  return formatMoney(value);
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatOrderNumber(orderNumber?: string | null) {
  const value = String(orderNumber ?? "").trim();
  if (!value) return "Заказ";

  if (value.startsWith("ORD-")) {
    const short = value.replace("ORD-", "");
    const numericTail = short.slice(-2).replace(/^0+/, "") || short.slice(-2) || short;
    return `Заказ №${numericTail}`;
  }

  if (/^\d+$/.test(value)) {
    return `Заказ №${value}`;
  }

  return `Заказ ${value}`;
}
