"use client";

import { Calendar, CreditCard, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Purchase } from "@/types/domain";
import { formatCurrency, formatPurchaseId, paymentStatusMeta } from "@/features/stores/lib/view-utils";
import { PaymentFormDialog } from "@/features/stores/components/payment-form-dialog";
import { PurchaseFormDialog } from "@/features/stores/components/purchase-form-dialog";
import { Collection } from "@/types/domain";
import { ProductThumb } from "@/features/media/components/product-thumb";

export function PurchaseDetailsDialog({
  purchase,
  collections,
  open,
  onOpenChange,
  onCreatePayment,
  onUpdatePurchase,
  onDeletePurchase,
  pending,
}: {
  purchase?: Purchase;
  collections: Collection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePayment: (payload: {
    purchase_id?: string | null;
    amount: number;
    payment_date: string;
    payment_method: "cash" | "bank" | "card" | "transfer";
    comment?: string | null;
  }) => Promise<void>;
  onUpdatePurchase: (payload: {
    purchase_date: string;
    comment?: string | null;
    items: {
      collection_id?: string | null;
      collection_model_id?: string | null;
      item_name_snapshot: string;
      item_image_url_snapshot?: string | null;
      quantity: number;
      unit: "m2" | "meter" | "piece" | "pack";
      unit_price: number;
    }[];
  }) => Promise<void>;
  onDeletePurchase: () => Promise<void>;
  pending?: boolean;
}) {
  if (!purchase) return null;

  const status = paymentStatusMeta(purchase.payment_status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            {formatPurchaseId(purchase.purchase_number)}
          </DialogTitle>
          <DialogDescription>Детали закупки, оплаты и остаток долга.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-slate-50 p-4">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-sm text-muted">
                <Calendar className="h-4 w-4" />
                {new Date(purchase.purchase_date).toLocaleDateString("ru-RU")}
              </p>
              <Badge className={status.className}>{status.label}</Badge>
            </div>

            <div className="grid gap-1 text-right text-sm">
              <p>Сумма: <span className="font-semibold text-ink">{formatCurrency(Number(purchase.total_amount))}</span></p>
              <p>Оплачено: <span className="font-semibold text-emerald-700">{formatCurrency(Number(purchase.paid_amount))}</span></p>
              <p>Остаток: <span className="font-semibold text-rose-700">{formatCurrency(Number(purchase.debt_amount))}</span></p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Состав закупки</p>
            <div className="space-y-2">
              {(purchase.purchase_items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <ProductThumb
                      src={item.item_image_url_snapshot}
                      alt={item.item_name_snapshot}
                      className="h-10 w-10 rounded-lg"
                    />
                    <div>
                    <p className="font-medium text-ink">{item.item_name_snapshot}</p>
                    <p className="text-xs text-muted">
                      {item.quantity} {item.unit} × {formatCurrency(Number(item.unit_price))}
                    </p>
                    </div>
                  </div>
                  <p className="font-semibold text-ink">{formatCurrency(Number(item.total_price))}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <CreditCard className="h-4 w-4" />
              Платежи по закупке
            </p>
            <div className="space-y-2">
              {(purchase.payments ?? []).length ? (
                (purchase.payments ?? []).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-ink">{new Date(payment.payment_date).toLocaleDateString("ru-RU")}</p>
                      <p className="text-xs text-muted">{payment.payment_method}</p>
                    </div>
                    <p className="font-semibold text-emerald-700">{formatCurrency(Number(payment.amount))}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">Платежей пока нет</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PaymentFormDialog
              purchases={[purchase]}
              defaultPurchaseId={purchase.id}
              onCreate={onCreatePayment}
              disabled={pending}
              trigger={<Button>Добавить оплату</Button>}
            />

            <PurchaseFormDialog
              mode="edit"
              collections={collections}
              initialPurchase={purchase}
              onUpdate={onUpdatePurchase}
              disabled={pending}
              trigger={<Button variant="outline">Редактировать закупку</Button>}
            />

            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={async () => {
                const ok = window.confirm("Удалить закупку? Это действие нельзя отменить.");
                if (!ok) return;
                await onDeletePurchase();
                onOpenChange(false);
              }}
              disabled={pending}
            >
              Удалить закупку
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
