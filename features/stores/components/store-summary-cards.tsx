"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/features/stores/lib/view-utils";

/**
 * Суммы приходят из заказов магазина (модуль закупок не используется),
 * поэтому и подписи говорят про заказы, а не про закупки.
 */
export function StoreSummaryCards({
  totalPurchases,
  totalPaid,
  currentDebt,
}: {
  totalPurchases: number;
  totalPaid: number;
  currentDebt: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <Card className="bg-white">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted">Заказы на сумму</p>
          <p className="mt-0.5 break-words text-[18px] font-bold leading-tight text-ink sm:text-[20px]">{formatCurrency(totalPurchases)}</p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted">Оплачено</p>
          <p className="mt-0.5 break-words text-[18px] font-bold leading-tight text-emerald-700 sm:text-[20px]">{formatCurrency(totalPaid)}</p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted">Текущий долг</p>
          <p className="mt-0.5 break-words text-[18px] font-bold leading-tight text-rose-700 sm:text-[20px]">{formatCurrency(currentDebt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
