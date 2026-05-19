"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportSections, ExportSection } from "@/features/exports/lib/export-sections";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ExportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayISO());
  const [section, setSection] = useState<ExportSection>("catalog");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDateError = useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    return new Date(dateFrom).getTime() > new Date(dateTo).getTime();
  }, [dateFrom, dateTo]);

  async function handleDownload() {
    if (hasDateError) {
      setError("Дата начала не может быть позже даты окончания.");
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("section", section);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const response = await fetch(`/api/exports/excel?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Не удалось выгрузить Excel");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `export-${section}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка выгрузки");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Выгрузка Excel</h1>
        <p className="mt-2 text-sm text-muted">Экспортируйте данные по нужному разделу и периоду в файл .xlsx</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры выгрузки</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-4">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <select
              value={section}
              onChange={(event) => setSection(event.target.value as ExportSection)}
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              {exportSections.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Экспорт в Excel
            </Button>
          </div>

          {hasDateError ? <p className="text-sm text-rose-600">Проверьте период: дата начала больше даты окончания.</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
