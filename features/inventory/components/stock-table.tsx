"use client";

import { ChevronRight } from "lucide-react";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { movementTypeLabel, formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { StockListItem } from "@/features/inventory/lib/stock-api";
import { Card, CardContent } from "@/components/ui/card";
import { unitLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

/** Среднее окно ~2,1 м²: переводим остаток ткани в понятную бизнес-единицу. */
const WINDOW_M2 = 2.1;

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
  onOpenItem,
}: {
  items: StockListItem[];
  isLoading?: boolean;
  onOpenItem: (item: StockListItem) => void;
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
        const windows = item.unit === "m2" && quantity > 0 ? Math.max(1, Math.round(quantity / WINDOW_M2)) : null;

        const subtitle = [collection, model, color].filter(Boolean).join(" · ") || "Без характеристик";

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenItem(item)}
            className="crm-row crm-row-link block w-full text-left"
          >
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

                  <div className="flex items-start gap-2 text-right">
                    <div>
                      <p className="crm-row-amount">{salePrice == null ? "0 с" : formatSom(salePrice)}</p>
                      {purchasePrice == null ? null : (
                        <p className="crm-row-amount-sub">закуп {formatSom(purchasePrice)}</p>
                      )}
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn(stockPillClass(quantity, threshold))}>
                    {quantity <= 0 ? "Нет остатка" : `${formatStockQuantity(quantity)} ${unit}`}
                  </span>
                  {windows != null ? <span className="crm-pill crm-pill-soft">≈ {windows} окон</span> : null}
                  <span className="crm-pill crm-pill-soft">{lastMovementText(item)}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
