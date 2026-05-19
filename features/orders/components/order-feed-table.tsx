"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, orderStatusMeta } from "@/features/orders/lib/view-utils";
import { OrderStatus } from "@/types/domain";

type OrderFeedItem = {
  id: string;
  order_number: string;
  order_date: string;
  client_name: string | null;
  total_amount: number;
  status: OrderStatus;
};

export function OrderFeedTable({
  title,
  items,
  pageSize = 8,
  onOpen,
}: {
  title: string;
  items: OrderFeedItem[];
  pageSize?: number;
  onOpen: (orderId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-muted">Всего: {items.length}</p>
      </div>

      <div className="rounded-2xl border border-border bg-white">
        <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(140px,1.2fr)_150px_150px] items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
          <span>Заказ</span>
          <span>Дата</span>
          <span>Магазин</span>
          <span className="text-right">Сумма</span>
          <span className="text-right">Статус</span>
        </div>
        <div className="divide-y divide-border">
          {pageItems.length ? (
            pageItems.map((order, index) => {
              const status = orderStatusMeta(order.status);
              const displayIndex = String((page - 1) * pageSize + index + 1).padStart(2, "0");
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onOpen(order.id)}
                  className="grid w-full grid-cols-[minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(140px,1.2fr)_150px_150px] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50"
                >
                  <span className="font-semibold text-ink">{`Заказ №${displayIndex}`}</span>
                  <span className="text-muted">{new Date(order.order_date).toLocaleDateString("ru-RU")}</span>
                  <span className="truncate text-muted">{order.client_name || "-"}</span>
                  <span className="text-right font-bold text-ink">{formatCurrency(Number(order.total_amount || 0))}</span>
                  <span className="flex justify-end">
                    <Badge className={status.className}>{status.label}</Badge>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted">Заказы не найдены по заданным фильтрам</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Назад
        </Button>
        <span className="text-xs text-muted">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Вперед
        </Button>
      </div>
    </div>
  );
}
