"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { Collection, MovementType, StockItem } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createStockMovementSchema, CreateStockMovementInput } from "@/features/inventory/lib/schemas";
import { formatSom, generateSku, movementTypeLabel } from "@/features/inventory/lib/stock-utils";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { z } from "zod";
import { normalizeUnitByCollectionType, unitLabelLong } from "@/lib/units";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function asMovementType(type: MovementType): "incoming" | "outgoing" | "transfer" | "adjustment" {
  if (type === "writeoff") return "outgoing";
  return type as "incoming" | "outgoing" | "transfer" | "adjustment";
}

type StockMovementFormValues = z.input<typeof createStockMovementSchema>;

export function StockMovementDrawer({
  open,
  onClose,
  collections,
  selectedStockItem,
  movementType,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  selectedStockItem?: StockItem;
  movementType: MovementType;
  onSubmit: (payload: CreateStockMovementInput) => Promise<void>;
  isPending?: boolean;
}) {
  const effectiveMovementType = asMovementType(movementType);
  const form = useForm<StockMovementFormValues>({
    resolver: zodResolver(createStockMovementSchema),
    defaultValues: {
      movement_type: effectiveMovementType,
      collection_id: null,
      collection_model_id: null,
      sku: "",
      supplier_name: "",
      movement_date: todayISO(),
      quantity_m2: 1,
      unit_price: 0,
      sale_price_per_m2: null,
      comment: "",
      low_stock_threshold: 10,
    },
  });

  const collectionId = form.watch("collection_id") ?? undefined;
  const modelId = form.watch("collection_model_id") ?? undefined;
  const quantity = Number(form.watch("quantity_m2") ?? 0);
  const unitPrice = Number(form.watch("unit_price") ?? 0);
  const total = quantity * unitPrice;

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === collectionId),
    [collections, collectionId]
  );
  const modelOptions = selectedCollection?.collection_models ?? [];
  const selectedModel = modelOptions.find((model) => model.id === modelId);
  const currentUnit = normalizeUnitByCollectionType(selectedCollection?.type ?? selectedStockItem?.collections?.type, selectedStockItem?.unit);

  useEffect(() => {
    if (!open) return;

    form.reset({
      movement_type: effectiveMovementType,
      stock_item_id: selectedStockItem?.id,
      collection_id: selectedStockItem?.collection_id ?? null,
      collection_model_id: selectedStockItem?.collection_model_id ?? null,
      material_name: selectedStockItem?.material_name ?? selectedStockItem?.collections?.name ?? "",
      model_code: selectedStockItem?.model_code ?? selectedStockItem?.collection_models?.model_code ?? "",
      color_name: selectedStockItem?.color_name ?? selectedStockItem?.collection_models?.color_name ?? "",
      sku: selectedStockItem?.sku ?? selectedStockItem?.collection_models?.sku ?? "",
      photo_url: selectedStockItem?.photo_url ?? selectedStockItem?.collection_models?.image_url ?? "",
      supplier_name: "",
      movement_date: todayISO(),
      quantity_m2: 1,
      unit_price: Number(selectedStockItem?.purchase_price_per_m2 ?? 0),
      sale_price_per_m2: selectedStockItem?.sale_price_per_m2 == null ? null : Number(selectedStockItem.sale_price_per_m2),
      comment: "",
      low_stock_threshold: Number(selectedStockItem?.low_stock_threshold ?? 10),
    });
  }, [open, selectedStockItem, form, effectiveMovementType]);

  useEffect(() => {
    if (!open) return;
    if (!selectedCollection) return;

    form.setValue("material_name", selectedCollection.name);
    if (!selectedModel && selectedCollection.collection_models.length) {
      form.setValue("collection_model_id", selectedCollection.collection_models[0].id);
    }
  }, [open, selectedCollection, selectedModel, form]);

  useEffect(() => {
    if (!selectedModel) return;
    form.setValue("model_code", selectedModel.model_code);
    form.setValue("color_name", selectedModel.color_name ?? "");
    form.setValue("photo_url", selectedModel.image_url ?? null);
    if (effectiveMovementType === "incoming") {
      form.setValue("unit_price", Number(selectedModel.price_per_m2 ?? 0));
      if (selectedStockItem?.sale_price_per_m2 == null) {
        form.setValue("sale_price_per_m2", Number(selectedModel.price_per_m2 ?? 0));
      }
    }

    const currentSku = form.getValues("sku");
    if (!currentSku) {
      const autoSku =
        selectedModel.sku ||
        generateSku(
          form.getValues("material_name") || selectedCollection?.name || "",
          selectedModel.model_code || "",
          selectedModel.color_name || ""
        );
      form.setValue("sku", autoSku);
    }
  }, [selectedModel, selectedCollection, form, effectiveMovementType, selectedStockItem]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-white shadow-soft">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">{movementTypeLabel(movementType)}</h3>
            <p className="text-xs text-muted">Движение товара фиксируется в истории склада.</p>
          </div>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              const normalized = createStockMovementSchema.parse(values);
              await onSubmit({
                ...normalized,
                movement_type: effectiveMovementType,
                sku:
                  normalized.sku ||
                  generateSku(normalized.material_name || "", normalized.model_code || "", normalized.color_name || ""),
              });
              form.reset({
                movement_type: effectiveMovementType,
                stock_item_id: undefined,
                collection_id: null,
                collection_model_id: null,
                material_name: "",
                model_code: "",
                color_name: "",
                sku: "",
                photo_url: "",
                supplier_name: "",
                movement_date: todayISO(),
                quantity_m2: 1,
                unit_price: 0,
                sale_price_per_m2: null,
                comment: "",
                low_stock_threshold: 10,
              });
            } catch {
              // Ошибку и уведомление обрабатывает родительский компонент.
            }
          })}
        >
          <div className="space-y-2">
            <Label>Товар / коллекция</Label>
            <select
              className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
              value={collectionId ?? ""}
              onChange={(event) => form.setValue("collection_id", event.target.value || null)}
            >
              <option value="">Выберите коллекцию</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Поставщик</Label>
            <Input placeholder="Например: Айгуль" {...form.register("supplier_name")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Модель</Label>
              <select
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={modelId ?? ""}
                onChange={(event) => form.setValue("collection_model_id", event.target.value || null)}
              >
                <option value="">Выберите модель</option>
                {modelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Цвет</Label>
              <Input readOnly value={form.watch("color_name") ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input {...form.register("sku")} />
              {form.formState.errors.sku ? <p className="text-xs text-rose-600">{form.formState.errors.sku.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>Дата</Label>
              <Input type="date" {...form.register("movement_date")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Количество ({unitLabelLong(currentUnit)})</Label>
              <Input type="number" min={0.01} step={0.01} {...form.register("quantity_m2")} />
              {form.formState.errors.quantity_m2 ? (
                <p className="text-xs text-rose-600">{form.formState.errors.quantity_m2.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Цена закупки за {unitLabelLong(currentUnit)} (сом)</Label>
              <Input type="number" min={0} step={0.01} {...form.register("unit_price")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Цена продажи за {unitLabelLong(currentUnit)} (сом)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="Опционально"
              {...form.register("sale_price_per_m2", {
                setValueAs: (value) => (value === "" || value == null ? null : Number(value)),
              })}
            />
            {form.formState.errors.sale_price_per_m2 ? (
              <p className="text-xs text-rose-600">{form.formState.errors.sale_price_per_m2.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Общая сумма (сом)</Label>
            <Input readOnly value={formatSom(total)} />
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea rows={4} {...form.register("comment")} />
          </div>

          <div className="space-y-2">
            <Label>Фото (preview)</Label>
            <ProductThumb
              src={form.watch("photo_url") ?? null}
              alt={form.watch("material_name") || "Фото товара"}
              className="h-20 w-20 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              Сохранить движение
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
