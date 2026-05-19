"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/features/stores/lib/view-utils";

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
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="bg-white">
        <CardContent className="p-2">
          <p className="text-[11px] text-muted">Всего закупок</p>
          <p className="mt-0.5 text-[20px] font-bold leading-tight text-ink">{formatCurrency(totalPurchases)}</p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-2">
          <p className="text-[11px] text-muted">Оплачено</p>
          <p className="mt-0.5 text-[20px] font-bold leading-tight text-emerald-700">{formatCurrency(totalPaid)}</p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-2">
          <p className="text-[11px] text-muted">Текущий долг</p>
          <p className="mt-0.5 text-[20px] font-bold leading-tight text-rose-700">{formatCurrency(currentDebt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
