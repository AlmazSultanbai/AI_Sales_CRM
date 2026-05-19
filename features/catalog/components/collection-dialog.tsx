"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCollectionSchema,
  CreateCollectionInput,
  updateCollectionSchema,
  UpdateCollectionInput,
} from "@/features/catalog/lib/schemas";
import { catalogTypeLabels, catalogTypeOptions } from "@/features/catalog/lib/labels";
import { Collection } from "@/types/domain";
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
import { CatalogType } from "@/types/domain";

type DialogMode = "create" | "edit";
type FormValues = {
  name: string;
  type?: CatalogType;
  price_per_m2: number;
};

export function CollectionDialog({
  mode,
  initial,
  onCreate,
  onUpdate,
  onDelete,
  trigger,
  disabled,
}: {
  mode: DialogMode;
  initial?: Collection;
  onCreate?: (payload: CreateCollectionInput) => Promise<void>;
  onUpdate?: (id: string, payload: UpdateCollectionInput) => Promise<void>;
  onDelete?: (id: string, password: string) => Promise<void>;
  trigger: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const schema = useMemo(() => (mode === "create" ? createCollectionSchema : updateCollectionSchema), [mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: initial?.name ?? "",
      price_per_m2: initial?.price_per_m2 ?? 0,
      ...(mode === "create" ? { type: "material" } : {}),
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: initial?.name ?? "",
        price_per_m2: initial?.price_per_m2 ?? 0,
        ...(mode === "create" ? { type: "material" } : {}),
      });
    }
  }, [open, initial, form, mode]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (mode === "create" && onCreate) {
      await onCreate(values as CreateCollectionInput);
    }

    if (mode === "edit" && onUpdate && initial) {
      await onUpdate(initial.id, values as UpdateCollectionInput);
    }

    setOpen(false);
  });

  const handleDelete = async () => {
    if (mode !== "edit" || !initial || !onDelete) return;
    const firstConfirm = window.confirm("Удалить коллекцию?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("Вы точно хотите удалить эту коллекцию?");
    if (!secondConfirm) return;
    const password = window.prompt("Введите пароль для подтверждения удаления коллекции");
    if (!password) return;
    await onDelete(initial.id, password);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Новая коллекция" : "Редактировать коллекцию"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Создайте новую коллекцию с типом и базовой ценой."
              : "Обновите название и цену коллекции."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Название</Label>
            <Input id="name" placeholder="Например: Лиссабон" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-rose-600">{form.formState.errors.name.message as string}</p>
            ) : null}
          </div>

          {mode === "create" ? (
            <div className="space-y-2">
              <Label htmlFor="type">Тип</Label>
              <select
                id="type"
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                {...form.register("type")}
              >
                {catalogTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {catalogTypeLabels[option]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="price_per_m2">Цена за м²</Label>
            <Input id="price_per_m2" type="number" min={0} {...form.register("price_per_m2")} />
            {form.formState.errors.price_per_m2 ? (
              <p className="text-xs text-rose-600">{form.formState.errors.price_per_m2.message as string}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={disabled || form.formState.isSubmitting}>
              {mode === "create" ? "Создать" : "Сохранить"}
            </Button>
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={disabled || form.formState.isSubmitting}
                onClick={handleDelete}
              >
                Удалить коллекцию
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
