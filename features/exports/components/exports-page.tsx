"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportForm } from "@/features/exports/components/export-form";

export function ExportsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Выгрузка Excel</h1>
        <p className="mt-2 text-sm text-muted">Экспортируйте данные по нужному разделу и периоду в файл .xlsx</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры выгрузки</CardTitle>
        </CardHeader>

        <CardContent>
          <ExportForm defaultSection="catalog" />
        </CardContent>
      </Card>
    </section>
  );
}
