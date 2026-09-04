"use client";

import { History, PencilRuler, Plus, RefreshCw, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { StockListItem } from "@/features/inventory/lib/stock-api";
import { formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { unitLabel } from "@/lib/units";
import { MovementType } from "@/types/domain";

export type ItemSheetAction = MovementType | "history";

/** Шторка действий по позиции: приход, расход, перемещение, корректировка, история. */
export function ItemActionSheet({
  item,
  onClose,
  onAction,
}: {
  item?: StockListItem;
  onClose: () => void;
  onAction: (item: StockListItem, action: ItemSheetAction) => void;
}) {
  const actions: Array<{ key: ItemSheetAction; label: string; icon: React.ReactNode }> = [
    { key: "incoming", label: "Приход к позиции", icon: <Plus className="h-4 w-4" /> },
    { key: "outgoing", label: "Расход / списание", icon: <Truck className="h-4 w-4" /> },
    { key: "transfer", label: "Перемещение", icon: <RefreshCw className="h-4 w-4" /> },
    { key: "adjustment", label: "Корректировка", icon: <PencilRuler className="h-4 w-4" /> },
    { key: "history", label: "История движений", icon: <History className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-sm">
        {item ? (
          <>
            <DialogHeader className="mb-2">
              <div className="flex items-center gap-3">
                <ProductThumb
                  src={item.photo_url ?? item.collection_models?.image_url ?? null}
                  alt={item.material_name ?? "Товар"}
                  className="h-11 w-11 shrink-0 rounded-xl"
                />
                <div className="min-w-0">
                  <DialogTitle className="truncate text-base">
                    {item.material_name ?? item.collections?.name ?? "Позиция"}
                  </DialogTitle>
                  <p className="truncate text-sm text-muted">
                    {[item.model_code, item.color_name].filter(Boolean).join(" · ") || "Без характеристик"} · остаток{" "}
                    {formatStockQuantity(Number(item.quantity_m2 ?? 0))} {unitLabel(item.unit)}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-1.5">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => onAction(item, action.key)}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
