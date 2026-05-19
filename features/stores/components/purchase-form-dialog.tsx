"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import {
  createPurchaseSchema,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  updatePurchaseSchema,
} from "@/features/stores/lib/schemas";
import { Collection, Purchase } from "@/types/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/features/stores/lib/view-utils";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { useToaster } from "@/components/ui/toaster";
import { defaultUnitByCollectionType, unitLabelLong } from "@/lib/units";

type PurchaseFormValues = z.input<typeof createPurchaseSchema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function allowedUnitsByCollectionType(type?: "material" | "profile" | "cap" | "fixator") {
  if (!type) return ["m2", "meter", "piece", "pack"] as const;
  if (type === "profile") return ["meter"] as const;
  if (type === "cap" || type === "fixator") return ["pack"] as const;
  return ["m2"] as const;
}

export function PurchaseFormDialog({
  mode,
  trigger,
  collections,
  initialPurchase,
  onCreate,
  onUpdate,
  disabled,
}: {
  mode: "create" | "edit";
  trigger: ReactNode;
  collections: Collection[];
  initialPurchase?: Purchase;
  onCreate?: (payload: CreatePurchaseInput) => Promise<void>;
  onUpdate?: (payload: UpdatePurchaseInput) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { toast } = useToaster();
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(mode === "create" ? createPurchaseSchema : updatePurchaseSchema),
    defaultValues: {
      purchase_date: initialPurchase?.purchase_date ?? todayISO(),
      comment: initialPurchase?.comment ?? "",
      items:
        initialPurchase?.purchase_items?.map((item) => ({
          collection_id: item.collection_id,
          collection_model_id: item.collection_model_id,
          item_name_snapshot: item.item_name_snapshot,
          item_image_url_snapshot: item.item_image_url_snapshot ?? null,
          quantity: Number(item.quantity),
          unit: item.unit,
          unit_price: Number(item.unit_price),
        })) ?? [{ item_name_snapshot: "", item_image_url_snapshot: null, quantity: 1, unit: "m2", unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = useWatch({ control: form.control, name: "items" }) ?? [];

  useEffect(() => {
    if (open) return;
    setSubmitError(null);
    form.reset({
      purchase_date: initialPurchase?.purchase_date ?? todayISO(),
      comment: initialPurchase?.comment ?? "",
      items:
        initialPurchase?.purchase_items?.map((item) => ({
          collection_id: item.collection_id,
          collection_model_id: item.collection_model_id,
          item_name_snapshot: item.item_name_snapshot,
          item_image_url_snapshot: item.item_image_url_snapshot ?? null,
          quantity: Number(item.quantity),
          unit: item.unit,
          unit_price: Number(item.unit_price),
        })) ?? [{ item_name_snapshot: "", item_image_url_snapshot: null, quantity: 1, unit: "m2", unit_price: 0 }],
    });
  }, [open, form, initialPurchase]);

  const grandTotal = useMemo(
    () =>
      (watchedItems ?? []).reduce((sum, item) => {
        const qty = Number(item.quantity ?? 0);
        const price = Number(item.unit_price ?? 0);
        return sum + qty * price;
      }, 0),
    [watchedItems]
  );

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      const payload: CreatePurchaseInput = {
        purchase_date: values.purchase_date,
        comment: values.comment ?? null,
        items: values.items.map((item) => ({
          collection_id: item.collection_id ?? null,
          collection_model_id: item.collection_model_id ?? null,
          item_name_snapshot: item.item_name_snapshot,
          item_image_url_snapshot: item.item_image_url_snapshot ?? null,
          quantity: Number(item.quantity),
          unit: item.unit,
          unit_price: Number(item.unit_price),
        })),
      };

      if (mode === "create" && onCreate) {
        await onCreate(payload);
      }

      if (mode === "edit" && onUpdate) {
        await onUpdate(payload);
      }

      toast({
        title: "Успешно сохранено",
        description: mode === "create" ? "Закупка успешно сохранена" : "Изменения по закупке успешно сохранены",
        variant: "success",
        duration: 3000,
      });
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось сохранить закупку. Попробуйте снова.";
      setSubmitError(message);
      toast({
        title: "Ошибка сохранения",
        description: message,
        variant: "error",
        duration: 4000,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Новая закупка" : "Редактировать закупку"}</DialogTitle>
          <DialogDescription>
            Добавьте состав закупки. Сумма, оплата и долг будут пересчитаны автоматически.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Дата закупки</Label>
              <Input id="purchase_date" type="date" {...form.register("purchase_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий</Label>
              <Input id="comment" placeholder="Комментарий к закупке" {...form.register("comment")} />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Позиции закупки</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => append({ item_name_snapshot: "", item_image_url_snapshot: null, quantity: 1, unit: "m2", unit_price: 0 })}
              >
                <Plus className="h-3.5 w-3.5" />
                Позиция
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => {
                const selectedCollectionId = form.watch(`items.${index}.collection_id`);
                const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
                const models = selectedCollection?.collection_models ?? [];
                const rowQuantity = Number(form.watch(`items.${index}.quantity`) || 0);
                const rowUnitPrice = Number(form.watch(`items.${index}.unit_price`) || 0);
                const rowUnit = String(form.watch(`items.${index}.unit`) || "m2");
                const rowTotal = rowQuantity * rowUnitPrice;
                const rowImage = form.watch(`items.${index}.item_image_url_snapshot`);
                const unitOptions = allowedUnitsByCollectionType(selectedCollection?.type);

                return (
                  <div key={field.id} className="rounded-xl border border-border bg-white p-3">
                    <div className="grid gap-3 lg:grid-cols-12">
                      <div className="lg:col-span-12">
                        <div className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ProductThumb src={rowImage} alt={form.watch(`items.${index}.item_name_snapshot`) || "Позиция"} className="h-10 w-10 rounded-lg" />
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                {form.watch(`items.${index}.item_name_snapshot`) || "Новая позиция"}
                              </p>
                              <p className="text-xs text-muted">
                                {rowQuantity} {rowUnit} × {formatCurrency(rowUnitPrice)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-ink">{formatCurrency(rowTotal)}</p>
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <Label className="mb-1.5 block text-xs">Коллекция</Label>
                        <select
                          className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                          value={form.watch(`items.${index}.collection_id`) ?? ""}
                          onChange={(event) => {
                            const collectionId = event.target.value || null;
                            form.setValue(`items.${index}.collection_id`, collectionId);
                            form.setValue(`items.${index}.collection_model_id`, null);

                            const collection = collections.find((item) => item.id === collectionId);
                            if (collection) {
                              form.setValue(`items.${index}.item_name_snapshot`, collection.name);
                              form.setValue(`items.${index}.item_image_url_snapshot`, collection.image_url ?? null);
                              form.setValue(`items.${index}.unit_price`, Number(collection.price_per_m2 ?? 0));
                              form.setValue(`items.${index}.unit`, defaultUnitByCollectionType(collection.type));
                            }
                          }}
                        >
                          <option value="">Выберите</option>
                          {collections.map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:col-span-2">
                        <Label className="mb-1.5 block text-xs">Модель</Label>
                        <select
                          className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                          value={form.watch(`items.${index}.collection_model_id`) ?? ""}
                          onChange={(event) => {
                            const modelId = event.target.value || null;
                            form.setValue(`items.${index}.collection_model_id`, modelId);

                            const model = models.find((item) => item.id === modelId);
                            if (model && selectedCollection) {
                              form.setValue(`items.${index}.item_name_snapshot`, `${selectedCollection.name} ${model.model_code}`);
                              form.setValue(
                                `items.${index}.item_image_url_snapshot`,
                                model.image_url ?? selectedCollection.image_url ?? null
                              );
                              form.setValue(`items.${index}.unit_price`, Number(model.price_per_m2 ?? selectedCollection.price_per_m2 ?? 0));
                            }
                          }}
                        >
                          <option value="">Без модели</option>
                          {models.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.model_code}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:col-span-3">
                        <Label className="mb-1.5 block text-xs">Название позиции</Label>
                        <Input placeholder="Лиссабон 01" {...form.register(`items.${index}.item_name_snapshot`)} />
                      </div>

                      <div className="lg:col-span-2">
                        <Label className="mb-1.5 block text-xs">Кол-во</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="min-w-[120px]"
                          {...form.register(`items.${index}.quantity`)}
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <Label className="mb-1.5 block text-xs">Ед.</Label>
                        <select
                          className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                          {...form.register(`items.${index}.unit`)}
                          disabled={unitOptions.length === 1}
                        >
                          {unitOptions.map((option) => (
                            <option key={option} value={option}>
                              {unitLabelLong(option)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:col-span-2">
                        <Label className="mb-1.5 block text-xs">Цена</Label>
                        <Input type="number" step="0.01" min="0" {...form.register(`items.${index}.unit_price`)} />
                      </div>

                      <div className="flex items-end justify-between gap-2 lg:col-span-12">
                        <p className="text-xs text-muted">Сумма позиции: {formatCurrency(rowTotal)}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Итог закупки</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatCurrency(grandTotal)}</p>
              {submitError ? <p className="mt-2 text-xs text-rose-600">{submitError}</p> : null}
            </div>
            <Button type="submit" disabled={disabled || form.formState.isSubmitting}>
              {mode === "create" ? "Сохранить закупку" : "Обновить закупку"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
