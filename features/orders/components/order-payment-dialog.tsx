"use client";

import { ReactNode, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToaster } from "@/components/ui/toaster";
import { CreateOrderPaymentInput } from "@/features/orders/lib/schemas";
import { formatCurrency } from "@/features/orders/lib/view-utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function OrderPaymentDialog({
  trigger,
  debtAmount,
  onCreate,
}: {
  trigger: ReactNode;
  debtAmount: number;
  onCreate: (payload: CreateOrderPaymentInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<CreateOrderPaymentInput["payment_method"]>("cash");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToaster();

  useEffect(() => {
    if (!open) {
      setAmount("");
      setPaymentDate(todayISO());
      setPaymentMethod("cash");
      setComment("");
    }
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ title: "Ошибка оплаты", description: "Укажите сумму больше нуля", variant: "error" });
      return;
    }
    if (numericAmount > debtAmount + 0.01) {
      toast({
        title: "Ошибка оплаты",
        description: `Сумма оплаты не может превышать долг (${formatCurrency(debtAmount)})`,
        variant: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        amount: numericAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        comment: comment.trim() || null,
      });
      toast({ title: "Оплата сохранена", description: "Долг по заказу пересчитан", variant: "success" });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось сохранить оплату",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Добавить оплату</DialogTitle>
          <DialogDescription>Остаток долга: {formatCurrency(debtAmount)}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="order-payment-amount">Сумма</Label>
              <Input
                id="order-payment-amount"
                type="number"
                min="0"
                max={debtAmount}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value === "" ? "" : Number(event.target.value))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-payment-date">Дата</Label>
              <Input id="order-payment-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="order-payment-method">Способ оплаты</Label>
              <select
                id="order-payment-method"
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as CreateOrderPaymentInput["payment_method"])}
              >
                <option value="cash">Наличные</option>
                <option value="bank">Банк</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-payment-comment">Комментарий</Label>
              <Input id="order-payment-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Необязательно" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving || debtAmount <= 0}>
              {isSaving ? "Сохранение..." : "Сохранить оплату"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
