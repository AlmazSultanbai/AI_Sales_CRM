"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CollectionModel } from "@/types/domain";
import { updateModelSchema, UpdateModelInput } from "@/features/catalog/lib/schemas";
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
import { EntityImageUploader } from "@/features/media/components/entity-image-uploader";
import { useToaster } from "@/components/ui/toaster";

export function EditModelDialog({
  model,
  trigger,
  onSubmit,
  onMediaChanged,
  disabled,
  open,
  onOpenChange,
  hideTrigger,
}: {
  model: CollectionModel;
  trigger: React.ReactNode;
  onSubmit: (payload: UpdateModelInput) => Promise<void>;
  onMediaChanged?: () => Promise<void>;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToaster();
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  type FormValues = z.input<typeof updateModelSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(updateModelSchema),
    defaultValues: {
      model_code: model.model_code,
      color_name: model.color_name,
      color_hex: model.color_hex,
      price_per_m2: Number(model.price_per_m2),
      sku: model.sku ?? "",
      sort_order: model.sort_order ?? 0,
      is_active: model.is_active ?? true,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        model_code: model.model_code,
        color_name: model.color_name,
        color_hex: model.color_hex,
        price_per_m2: Number(model.price_per_m2),
        sku: model.sku ?? "",
        sort_order: model.sort_order ?? 0,
        is_active: model.is_active ?? true,
      });
    }
  }, [open, form, model]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const payload: UpdateModelInput = {
        ...values,
        price_per_m2: values.price_per_m2 !== undefined ? Number(values.price_per_m2) : undefined,
        sort_order: values.sort_order !== undefined ? Number(values.sort_order) : undefined,
        sku: values.sku ?? null,
      };
      await onSubmit(payload);
      toast({
        title: "Успешно сохранено",
        description: "Модель успешно обновлена",
        variant: "success",
        duration: 3000,
      });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось сохранить модель",
        variant: "error",
        duration: 4000,
      });
    }
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактировать модель {model.model_code}</DialogTitle>
          <DialogDescription>Измените цвет, цену, фото и атрибуты варианта.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <EntityImageUploader
            entityType="collection_model"
            entityId={model.id}
            imageUrl={model.image_url}
            onChange={async () => {
              await onMediaChanged?.();
            }}
          />

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`model_code_${model.id}`}>Код модели</Label>
                <Input id={`model_code_${model.id}`} {...form.register("model_code")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`price_${model.id}`}>Цена за м²</Label>
                <Input id={`price_${model.id}`} type="number" min={0} {...form.register("price_per_m2")} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`color_name_${model.id}`}>Название цвета</Label>
                <Input id={`color_name_${model.id}`} {...form.register("color_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`color_hex_${model.id}`}>HEX цвет</Label>
                <Input id={`color_hex_${model.id}`} {...form.register("color_hex")} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`sku_${model.id}`}>SKU</Label>
                <Input id={`sku_${model.id}`} {...form.register("sku")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`sort_order_${model.id}`}>Порядок</Label>
                <Input id={`sort_order_${model.id}`} type="number" min={0} {...form.register("sort_order")} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-border" {...form.register("is_active")} />
              Модель активна
            </label>

            <Button type="submit" disabled={disabled || form.formState.isSubmitting}>
              Сохранить модель
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
