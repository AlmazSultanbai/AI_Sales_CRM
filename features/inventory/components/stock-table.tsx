"use client";

import { History, Pencil } from "lucide-react";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { movementTypeLabel, formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { StockListItem } from "@/features/inventory/lib/stock-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { unitLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

function stockPillClass(quantity: number, threshold: number) {
  if (quantity <= 0) return "crm-pill crm-pill-red";
  if (quantity <= threshold) return "crm-pill crm-pill-amber";
  return "crm-pill crm-pill-green";
}

function lastMovementText(item: StockListItem) {
  const movement = item.lastMovement;
  if (!movement) return "Движений пока не было";

  const date = new Date(movement.created_at).toLocaleDateString("ru-RU");
  const type = movementTypeLabel(movement.movement_type as never);
  const source = movement.supplier_name ? ` · ${movement.supplier_name}` : "";
  return `${date} · ${type}${source}`;
}

export function StockTable({
  items,
  isLoading,
  onOpenHistory,
  onOpenDetails,
}: {
  items: StockListItem[];
  isLoading?: boolean;
  onOpenHistory: (item: StockListItem) => void;
  onOpenDetails: (item: StockListItem) => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted">Загрузка склада...</CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted">Позиции по текущим фильтрам не найдены.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const quantity = Number(item.quantity_m2 ?? item.quantity ?? 0);
        const threshold = Number(item.low_stock_threshold ?? 10);
        const unit = unitLabel(item.unit);
        const title = item.material_name ?? item.collections?.name ?? "Товар";
        const model = item.model_code ?? item.collection_models?.model_code ?? null;
        const color = item.color_name ?? item.collection_models?.color_name ?? null;
        const collection = item.collections?.name ?? null;
        const salePrice = item.sale_price_per_m2 == null ? null : Number(item.sale_price_per_m2);
        const purchasePrice = item.purchase_price_per_m2 == null ? null : Number(item.purchase_price_per_m2);

        const subtitle = [collection, model, color].filter(Boolean).join(" · ") || "Без характеристик";

        return (
          <div key={item.id} className="crm-row crm-row-link">
            <div className="flex items-start gap-3">
              <ProductThumb
                src={item.photo_url ?? item.collection_models?.image_url ?? null}
                alt={title}
                className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="crm-row-title truncate">{title}</p>
                    <p className="crm-row-sub truncate">{subtitle}</p>
                  </div>

                  <div className="text-right">
                    <p className="crm-row-amount">{salePrice == null ? "0 с" : formatSom(salePrice)}</p>
                    {purchasePrice == null ? null : (
                      <p className="crm-row-amount-sub">закуп {formatSom(purchasePrice)}</p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn(stockPillClass(quantity, threshold))}>
                    {quantity <= 0 ? "Нет остатка" : `${formatStockQuantity(quantity)} ${unit}`}
                  </span>
                  <span className="crm-pill crm-pill-soft">{lastMovementText(item)}</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-border pt-2.5">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onOpenHistory(item)}>
                <History className="h-3.5 w-3.5" />
                История
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onOpenDetails(item)}>
                <Pencil className="h-3.5 w-3.5" />
                Движение
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
