"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToaster } from "@/components/ui/toaster";
import { useOrder } from "@/features/orders/hooks/use-orders-queries";
import { useOrderMutations } from "@/features/orders/hooks/use-orders-queries";
import { OrderPaymentDialog } from "@/features/orders/components/order-payment-dialog";
import { CreateOrderPaymentInput } from "@/features/orders/lib/schemas";
import { formatCurrency, formatOrderNumber, orderPaymentStatusMeta, orderStatusMeta } from "@/features/orders/lib/view-utils";

export function OrderPreviewDialog({
  orderId,
  open,
  onClose,
}: {
  orderId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: order, isLoading } = useOrder(orderId ?? undefined);
  const { createOrderPaymentMutation } = useOrderMutations();
  const { toast } = useToaster();

  const materialsTotal = Number(order?.materials_sale_total || 0);
  const installationTotal = Number(order?.installation_amount || 0);
  const paidAmount = Number(order?.paid_amount || 0);
  const debtAmount = Number(order?.debt_amount || 0);

  async function addPayment(payload: CreateOrderPaymentInput) {
    if (!order) return;
    try {
      await createOrderPaymentMutation.mutateAsync({ orderId: order.id, payload });
      toast({ title: "Оплата сохранена", description: "Долг по заказу пересчитан", variant: "success" });
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось сохранить оплату",
        variant: "error",
      });
      throw error;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{order?.order_number ? formatOrderNumber(order.order_number) : "Детали заказа"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted">Загрузка деталей заказа...</p>
        ) : order ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted">Дата</p>
                <p className="font-medium text-ink">{new Date(order.order_date).toLocaleDateString("ru-RU")}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Магазин</p>
                <p className="font-medium text-ink">{order.client_name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Статус</p>
                <p className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${orderStatusMeta(order.status).className}`}>
                  {orderStatusMeta(order.status).label}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Телефон</p>
                <p className="font-medium text-ink">{order.phone || "-"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted">Адрес</p>
              <p className="font-medium text-ink">{order.address || "-"}</p>
            </div>

            <div className="rounded-xl border border-border">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr] gap-2 border-b border-border px-3 py-2 text-xs text-muted">
                <span>Материал</span>
                <span>Модель</span>
                <span>Цвет</span>
                <span>Кол-во</span>
                <span>Цена</span>
                <span>Сумма</span>
              </div>
              <div className="divide-y divide-border">
                {(order.order_items ?? []).map((item) => (
                  <div key={item.id} className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr] gap-2 px-3 py-2 text-sm">
                    <span className="text-ink">{item.material_name_snapshot}</span>
                    <span className="text-muted">{item.model_snapshot || "-"}</span>
                    <span className="text-muted">{item.color_snapshot || "-"}</span>
                    <span className="text-muted">{item.quantity_m2}</span>
                    <span className="text-muted">{formatCurrency(Number(item.sale_price_per_m2 || 0))}</span>
                    <span className="font-medium text-ink">{formatCurrency(Number(item.sale_amount || 0))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted">Материалы</p>
                <p className="font-semibold text-ink">{formatCurrency(materialsTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Установка</p>
                <p className="font-semibold text-ink">{formatCurrency(installationTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Оплачено</p>
                <p className="font-semibold text-emerald-700">{formatCurrency(paidAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Долг</p>
                <p className="font-semibold text-rose-700">{formatCurrency(debtAmount)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">Оплаты</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${orderPaymentStatusMeta(order.payment_status, paidAmount, Number(order.total_amount)).className}`}>
                    {orderPaymentStatusMeta(order.payment_status, paidAmount, Number(order.total_amount)).label}
                  </span>
                  <OrderPaymentDialog
                    debtAmount={debtAmount}
                    onCreate={addPayment}
                    trigger={<Button size="sm" disabled={debtAmount <= 0}>+ Оплата</Button>}
                  />
                </div>
              </div>
              {(order.order_payments ?? []).length ? (
                <div className="divide-y divide-border">
                  {(order.order_payments ?? []).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-muted">{new Date(payment.payment_date).toLocaleDateString("ru-RU")} · {payment.payment_method}</span>
                      <span className="font-medium text-emerald-700">{formatCurrency(Number(payment.amount))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Оплат пока нет</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Детали заказа не найдены</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
