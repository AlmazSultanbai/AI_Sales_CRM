"use client";

import { ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPaymentSchema, CreatePaymentInput } from "@/features/stores/lib/schemas";
import { Purchase } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToaster } from "@/components/ui/toaster";
import { formatCurrency, formatPurchaseId } from "@/features/stores/lib/view-utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentFormDialog({
  trigger,
  purchases,
  defaultPurchaseId,
  onCreate,
  disabled,
}: {
  trigger: ReactNode;
  purchases: Purchase[];
  defaultPurchaseId?: string;
  onCreate: (payload: CreatePaymentInput) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToaster();
  type PaymentFormValues = z.input<typeof createPaymentSchema>;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      purchase_id: defaultPurchaseId ?? null,
      amount: 0,
      payment_date: todayISO(),
      payment_method: "cash",
      comment: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        purchase_id: defaultPurchaseId ?? null,
        amount: 0,
        payment_date: todayISO(),
        payment_method: "cash",
        comment: "",
      });
    }
  }, [open, form, defaultPurchaseId]);

  const selectedPurchaseId = form.watch("purchase_id") || undefined;
  const selectedPurchase = purchases.find((purchase) => purchase.id === selectedPurchaseId);
  const maxDebt = Number(selectedPurchase?.debt_amount ?? 0);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const amount = Number(values.amount);
      if (selectedPurchase && amount > maxDebt) {
        form.setError("amount", {
          type: "manual",
          message: `Сумма оплаты не может превышать долг (${formatCurrency(maxDebt)})`,
        });
        toast({
          title: "Ошибка сохранения",
          description: `Сумма оплаты не может превышать долг (${formatCurrency(maxDebt)})`,
          variant: "error",
          duration: 4000,
        });
        return;
      }

      const payload: CreatePaymentInput = {
        purchase_id: values.purchase_id ?? null,
        amount,
        payment_date: values.payment_date,
        payment_method: values.payment_method,
        comment: values.comment ?? null,
      };

      await onCreate(payload);
      toast({
        title: "Успешно сохранено",
        description: "Оплата добавлена",
        variant: "success",
        duration: 3000,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось сохранить оплату",
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
          <DialogTitle>Добавить оплату</DialogTitle>
          <DialogDescription>Оплата пересчитает остаток долга по закупке и общую задолженность магазина.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="purchase_id">Закупка</Label>
            <select
              id="purchase_id"
              className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
              value={form.watch("purchase_id") ?? ""}
              onChange={(event) => {
                const purchaseId = event.target.value || null;
                form.setValue("purchase_id", purchaseId);
              }}
            >
              <option value="">Без привязки к закупке</option>
              {purchases.map((purchase) => (
                <option key={purchase.id} value={purchase.id}>
                  {formatPurchaseId(purchase.purchase_number)} - {formatCurrency(Number(purchase.debt_amount))}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Сумма</Label>
              <Input id="amount" type="number" step="0.01" min="0" {...form.register("amount")} />
              {form.formState.errors.amount ? (
                <p className="text-xs text-rose-600">{form.formState.errors.amount.message as string}</p>
              ) : null}
              {selectedPurchase ? (
                <p className="text-xs text-muted">Остаток по закупке: {formatCurrency(maxDebt)}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Дата</Label>
              <Input id="payment_date" type="date" {...form.register("payment_date")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_method">Способ оплаты</Label>
              <select
                id="payment_method"
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                {...form.register("payment_method")}
              >
                <option value="cash">Наличные</option>
                <option value="bank">Банк</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_comment">Комментарий</Label>
              <Input id="payment_comment" placeholder="Комментарий" {...form.register("comment")} />
            </div>
          </div>

          <Button type="submit" disabled={disabled || form.formState.isSubmitting}>
            Сохранить оплату
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
