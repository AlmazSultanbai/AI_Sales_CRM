"use client";

import { Eye, History } from "lucide-react";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { movementTypeLabel, stockStatusClass, formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { StockListItem } from "@/features/inventory/lib/stock-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { unitLabel } from "@/lib/units";

function movementContext(item: StockListItem) {
  const movement = item.lastMovement;
  if (!movement) return "—";
  if (movement.supplier_name) return `Поставщик: ${movement.supplier_name}`;
  if (movement.source_store_id) return `Источник: ${movement.source_store_id.slice(0, 8)}`;
  if (movement.destination_store_id) return `Назначение: ${movement.destination_store_id.slice(0, 8)}`;
  return "Без комментария";
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
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-border bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-3 text-left font-semibold">Фото</th>
                <th className="px-2 py-3 text-left font-semibold">Материал</th>
                <th className="hidden px-2 py-3 text-left font-semibold 2xl:table-cell">Коллекция</th>
                <th className="px-2 py-3 text-left font-semibold">Модель</th>
                <th className="hidden px-2 py-3 text-left font-semibold xl:table-cell">Цвет</th>
                <th className="px-2 py-3 text-left font-semibold">SKU</th>
                <th className="px-2 py-3 text-left font-semibold">Себест.</th>
                <th className="hidden px-2 py-3 text-left font-semibold lg:table-cell">Продажа</th>
                <th className="px-2 py-3 text-left font-semibold">Остаток</th>
                <th className="px-2 py-3 text-left font-semibold">Последнее движение</th>
                <th className="px-2 py-3 text-left font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50/70">
                  <td className="px-2 py-2.5">
                    <ProductThumb
                      src={item.photo_url ?? item.collection_models?.image_url ?? null}
                      alt={item.material_name ?? item.collections?.name ?? "Товар"}
                      className="h-9 w-9 rounded-lg"
                    />
                  </td>
                  <td className="px-2 py-2.5 font-semibold text-ink">{item.material_name ?? item.collections?.name ?? "—"}</td>
                  <td className="hidden px-2 py-2.5 text-slate-600 2xl:table-cell">{item.collections?.name ?? "—"}</td>
                  <td className="px-2 py-2.5 text-slate-700">{item.model_code ?? item.collection_models?.model_code ?? "—"}</td>
                  <td className="hidden px-2 py-2.5 text-slate-700 xl:table-cell">{item.color_name ?? item.collection_models?.color_name ?? "—"}</td>
                  <td className="max-w-[170px] px-2 py-2.5 font-medium text-slate-700">
                    <span className="block truncate">{item.sku ?? item.collection_models?.sku ?? "—"}</span>
                  </td>
                  <td className="px-2 py-2.5 font-medium text-slate-700">
                    {item.purchase_price_per_m2 == null ? "—" : formatSom(Number(item.purchase_price_per_m2))}
                  </td>
                  <td className="hidden px-2 py-2.5 font-medium text-slate-700 lg:table-cell">
                    {item.sale_price_per_m2 == null ? "—" : formatSom(Number(item.sale_price_per_m2))}
                  </td>
                  <td className={`px-2 py-2.5 text-base font-bold ${stockStatusClass(item)}`}>
                    {formatStockQuantity(Number(item.quantity_m2 ?? item.quantity ?? 0))} {unitLabel(item.unit)}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-slate-600">
                    <p>
                      {item.lastMovement
                        ? `${new Date(item.lastMovement.created_at).toLocaleDateString("ru-RU")} · ${movementTypeLabel(item.lastMovement.movement_type as never)}`
                        : "—"}
                    </p>
                    <p className="mt-0.5 hidden text-[11px] text-slate-500 2xl:block">{movementContext(item)}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" onClick={() => onOpenHistory(item)} aria-label="История позиции">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => onOpenDetails(item)} aria-label="Детали позиции">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
