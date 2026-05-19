"use client";

import { ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStoreSchema, CreateStoreInput, UpdateStoreInput } from "@/features/stores/lib/schemas";
import { Store } from "@/types/domain";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToaster } from "@/components/ui/toaster";

export function StoreFormDialog({
  mode,
  trigger,
  initialStore,
  onCreate,
  onUpdate,
  disabled,
}: {
  mode: "create" | "edit";
  trigger: ReactNode;
  initialStore?: Store;
  onCreate?: (payload: CreateStoreInput) => Promise<void>;
  onUpdate?: (payload: UpdateStoreInput) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToaster();

  const form = useForm<CreateStoreInput>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: initialStore?.name ?? "",
      contact_person: initialStore?.contact_person ?? "",
      phone: initialStore?.phone ?? "",
      address: initialStore?.address ?? "",
      notes: initialStore?.notes ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: initialStore?.name ?? "",
        contact_person: initialStore?.contact_person ?? "",
        phone: initialStore?.phone ?? "",
        address: initialStore?.address ?? "",
        notes: initialStore?.notes ?? "",
      });
    }
  }, [open, initialStore, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      if (mode === "create" && onCreate) await onCreate(values);
      if (mode === "edit" && onUpdate) await onUpdate(values);

      toast({
        title: "Успешно сохранено",
        description: mode === "create" ? "Магазин успешно создан" : "Изменения магазина успешно сохранены",
        variant: "success",
        duration: 3000,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось сохранить изменения. Попробуйте снова.",
        variant: "error",
        duration: 4000,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Новый магазин" : "Редактировать магазин"}</DialogTitle>
          <DialogDescription>Заполните карточку магазина для учета закупок и оплат.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="store_name">Название магазина</Label>
            <Input id="store_name" {...form.register("name")} />
            {form.formState.errors.name ? <p className="text-xs text-rose-600">{form.formState.errors.name.message}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Контактное лицо</Label>
              <Input id="contact_person" {...form.register("contact_person")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Адрес</Label>
            <Input id="address" {...form.register("address")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Заметка</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>

          <Button type="submit" disabled={disabled || form.formState.isSubmitting}>
            {mode === "create" ? "Создать магазин" : "Сохранить изменения"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
