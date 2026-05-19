"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createModelSchema, CreateModelInput } from "@/features/catalog/lib/schemas";
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

export function AddModelDialog({
  onSubmit,
  disabled,
  open,
  onOpenChange,
  hideTrigger,
}: {
  onSubmit: (data: CreateModelInput) => Promise<void>;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  type FormValues = z.input<typeof createModelSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(createModelSchema),
    defaultValues: {
      model_code: "",
      color_name: "Темно-синий",
      color_hex: "#1E3A8A",
      price_per_m2: 0,
      sku: "",
      sort_order: 0,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: CreateModelInput = {
      model_code: values.model_code,
      color_name: values.color_name,
      color_hex: values.color_hex,
      price_per_m2: Number(values.price_per_m2),
      sku: values.sku ?? null,
      sort_order: values.sort_order !== undefined ? Number(values.sort_order) : undefined,
    };

    await onSubmit(payload);
    form.reset();
    setDialogOpen(false);
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">+ модель</Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая модель</DialogTitle>
          <DialogDescription>Добавьте код модели для этой коллекции.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model_code">Код модели</Label>
              <Input id="model_code" placeholder="Например: 07" {...form.register("model_code")} />
              {form.formState.errors.model_code ? (
                <p className="text-xs text-rose-600">{form.formState.errors.model_code.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_per_m2">Цена за м²</Label>
              <Input id="price_per_m2" type="number" min={0} {...form.register("price_per_m2")} />
              {form.formState.errors.price_per_m2 ? (
                <p className="text-xs text-rose-600">{form.formState.errors.price_per_m2.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="color_name">Название цвета</Label>
              <Input id="color_name" placeholder="Например: Темно-синий" {...form.register("color_name")} />
              {form.formState.errors.color_name ? (
                <p className="text-xs text-rose-600">{form.formState.errors.color_name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="color_hex">HEX цвет</Label>
              <Input id="color_hex" placeholder="#1E3A8A" {...form.register("color_hex")} />
              {form.formState.errors.color_hex ? (
                <p className="text-xs text-rose-600">{form.formState.errors.color_hex.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU (опционально)</Label>
              <Input id="sku" placeholder="LIS-01" {...form.register("sku")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Порядок</Label>
              <Input id="sort_order" type="number" min={0} {...form.register("sort_order")} />
            </div>
          </div>

          <Button type="submit" disabled={disabled || form.formState.isSubmitting}>
            Добавить
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
