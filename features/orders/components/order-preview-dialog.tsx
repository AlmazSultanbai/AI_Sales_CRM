"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrder } from "@/features/orders/hooks/use-orders-queries";
import { formatCurrency, formatOrderNumber, orderStatusMeta } from "@/features/orders/lib/view-utils";

function parseAdvanceAmount(comment?: string | null) {
  if (!comment) return 0;
  const match = comment.match(/(?:Предоплата|Задаток):\s*([^\n]+)/i);
  if (!match?.[1]) return 0;

  return match[1]
    .split(";")
    .map((chunk) => {
      const numeric = chunk.match(/([\d.,\s]+)/);
      if (!numeric?.[1]) return 0;
      return Number(numeric[1].replace(/\s/g, "").replace(",", "."));
    })
    .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

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

  const materialsTotal = Number(order?.materials_sale_total || 0);
  const installationTotal = Number(order?.installation_amount || 0);
  const advanceTotal = parseAdvanceAmount(order?.comment);
  const payableTotal = Math.max(materialsTotal + installationTotal, 0);

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
                <p className="text-xs text-muted">Предоплата</p>
                <p className="font-semibold text-ink">{formatCurrency(advanceTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Итого</p>
                <p className="font-semibold text-ink">{formatCurrency(payableTotal)}</p>
              </div>
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
