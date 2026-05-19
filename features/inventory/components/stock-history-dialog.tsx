"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStockMovements } from "@/features/inventory/hooks/use-stock-queries";
import { StockListItem } from "@/features/inventory/lib/stock-api";
import { movementTypeLabel, formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { unitLabel } from "@/lib/units";

export function StockHistoryDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: StockListItem;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStockMovements({
    stock_item_id: item?.id,
    page,
    page_size: 12,
  });

  const title = useMemo(() => {
    if (!item) return "История движений";
    return `История: ${item.material_name ?? item.collections?.name ?? "Позиция"} (${item.sku ?? "без SKU"})`;
  }, [item]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Все движения по выбранной складской позиции.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? <p className="text-sm text-muted">Загрузка истории...</p> : null}

          {(data?.items ?? []).map((movement) => (
            <Card key={movement.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {new Date(movement.created_at).toLocaleString("ru-RU")} · {movementTypeLabel(movement.movement_type)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {movement.supplier_name ? `Поставщик: ${movement.supplier_name}` : movement.comment || "Без комментария"}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className="bg-slate-100 text-slate-700">{movement.movement_type}</Badge>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatStockQuantity(Number(movement.quantity_m2 ?? movement.quantity ?? 0))} {unitLabel(movement.stock_items?.unit)}
                  </p>
                  <p className="text-xs text-muted">{formatSom(Number(movement.total_amount ?? 0))}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {!isLoading && !(data?.items?.length ?? 0) ? (
            <p className="py-8 text-center text-sm text-muted">По этой позиции нет движений.</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted">
            Страница {data?.pagination.page ?? 1} из {data?.pagination.totalPages ?? 1}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(data?.pagination.page ?? 1) <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(data?.pagination.page ?? 1) >= (data?.pagination.totalPages ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Вперед
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
