"use client";

import { useState } from "react";
import { CircleDollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/features/stores/lib/view-utils";
import { formatOrderNumber } from "@/features/orders/lib/view-utils";
import { cn } from "@/lib/utils";
import { Store } from "@/types/domain";

type DistributionRow = {
  order_id: string;
  order_number: string;
  order_date: string;
  total_amount: number;
  debt_before: number;
  pay: number;
  closes: boolean;
  debt_after: number;
};

type PayDebtResponse = {
  amount: number;
  payment_method: string;
  payment_date: string;
  debt_before: number;
  debt_after: number;
  distribution: DistributionRow[];
  error?: string;
};

const METHODS = [
  { value: "cash", label: "Нал" },
  { value: "transfer", label: "Перевод" },
  { value: "bank", label: "Банк" },
  { value: "card", label: "Карта" },
] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Погашение долга клиента одной суммой: ввод → предпросмотр распределения
 * по заказам (от старых к новым) → подтверждение. Пишутся обычные оплаты.
 */
export function PayDebtDialog({
  store,
  totalDebt,
  onDone,
}: {
  store: Store;
  totalDebt: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"amount" | "preview">("amount");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [preview, setPreview] = useState<PayDebtResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickAmounts = [50000, 100000, 200000].filter((value) => value < totalDebt);

  function reset() {
    setStep("amount");
    setAmount("");
    setMethod("cash");
    setPreview(null);
    setError(null);
  }

  async function requestServer(dryRun: boolean) {
    const response = await fetch(`/api/stores/${store.id}/pay-debt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        payment_method: method,
        payment_date: todayISO(),
        dry_run: dryRun,
      }),
    });
    const payload = (await response.json()) as PayDebtResponse;
    if (!response.ok) throw new Error(payload.error ?? "Не удалось провести оплату");
    return payload;
  }

  async function handlePreview() {
    if (!Number(amount)) {
      setError("Введите сумму");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setPreview(await requestServer(true));
      setStep("preview");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const result = await requestServer(false);
      setOpen(false);
      reset();
      onDone();

      // Квитанция клиенту в WhatsApp — вместо бумажки.
      const digits = String(store.phone ?? "").replace(/\D/g, "");
      if (digits.length >= 9) {
        const lines = [
          `Квитанция · ${store.name} · ${new Date().toLocaleDateString("ru-RU")}`,
          `Оплата ${formatCurrency(result.amount)} (${METHODS.find((item) => item.value === result.payment_method)?.label ?? result.payment_method})`,
          ...result.distribution.map((row) =>
            row.closes
              ? `✓ ${formatOrderNumber(row.order_number)} — ${formatCurrency(row.pay)}`
              : `${formatOrderNumber(row.order_number)} — ${formatCurrency(row.pay)} из ${formatCurrency(row.debt_before)}`
          ),
          `Остаток долга: ${formatCurrency(result.debt_after)}`,
        ];
        const phone = digits.length === 9 ? `996${digits}` : digits;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" disabled={totalDebt <= 0}>
          <CircleDollarSign className="h-4 w-4" />
          Погасить долг
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Погашение долга</DialogTitle>
          <DialogDescription>
            {store.name} · долг {formatCurrency(totalDebt)}
          </DialogDescription>
        </DialogHeader>

        {step === "amount" ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Сумма, с</p>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Сколько принёс клиент"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700"
                onClick={() => setAmount(String(Math.round(totalDebt * 100) / 100))}
              >
                Весь долг · {formatCurrency(totalDebt)}
              </button>
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setAmount(String(value))}
                >
                  {value.toLocaleString("ru-RU")}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMethod(item.value)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold",
                    method === item.value ? "bg-emerald-600 text-white" : "border border-border text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handlePreview} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Далее
            </Button>
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800">
              {formatCurrency(preview.amount)} · {METHODS.find((item) => item.value === method)?.label} ·{" "}
              {new Date().toLocaleDateString("ru-RU")}
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {preview.distribution.map((row) => {
                const share = row.debt_before > 0 ? Math.round((row.pay / row.debt_before) * 100) : 0;
                return (
                  <div key={row.order_id} className="rounded-xl border border-border p-3">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <b className="text-ink">
                        {formatOrderNumber(row.order_number)} · {new Date(row.order_date).toLocaleDateString("ru-RU")}
                      </b>
                      <b className={row.closes ? "text-emerald-700" : "text-ink"}>
                        {formatCurrency(row.pay)}
                        {row.closes ? " ✓" : ""}
                      </b>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                      <i className="block h-full rounded-full bg-emerald-600" style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {row.closes ? "Закрыт полностью" : `Частично: останется ${formatCurrency(row.debt_after)}`}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-baseline justify-between rounded-xl bg-slate-100 px-3.5 py-2 text-sm">
              <span className="text-muted">Долг после оплаты</span>
              <b className={preview.debt_after > 0 ? "text-rose-600" : "text-emerald-700"}>{formatCurrency(preview.debt_after)}</b>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("amount")} disabled={pending}>
                Назад
              </Button>
              <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirm} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Подтвердить
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
