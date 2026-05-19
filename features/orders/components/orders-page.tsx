"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, FilePenLine, Plus, RefreshCw, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOrders, useOrderMutations } from "@/features/orders/hooks/use-orders-queries";
import { formatCurrency, orderStatusMeta } from "@/features/orders/lib/view-utils";
import { useToaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function OrdersPage() {
  const { toast } = useToaster();
  const [status, setStatus] = useState<"all" | "draft" | "confirmed" | "completed" | "cancelled">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [material, setMaterial] = useState("");
  const [user, setUser] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState(todayISO());
  const filters = useMemo(
    () => ({
      status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search || undefined,
      client: client || undefined,
      phone: phone || undefined,
      address: address || undefined,
      material: material || undefined,
      user: user || undefined,
      page,
      page_size: pageSize,
    }),
    [status, dateFrom, dateTo, search, client, phone, address, material, user, page, pageSize]
  );

  const { data, isLoading, error } = useOrders(filters);
  const { statusOrderMutation, duplicateOrderMutation, deleteOrderMutation } = useOrderMutations();
  const summary = data?.summary ?? {
    totalOrders: 0,
    totalAmount: 0,
    installationTotal: 0,
    workshopTotal: 0,
    profitTotal: 0,
    cancelled: 0,
    draft: 0,
  };
  const pagination = data?.pagination ?? { page: 1, pageSize, total: 0, totalPages: 1 };
  const orders = data?.items ?? [];

  async function handleStatus(orderId: string, nextStatus: "draft" | "confirmed" | "completed" | "cancelled") {
    try {
      await statusOrderMutation.mutateAsync({ orderId, status: nextStatus });
      toast({
        title: "Успешно сохранено",
        description: nextStatus === "cancelled" ? "Заказ отменен и остатки возвращены" : "Статус заказа обновлен",
        variant: "success",
      });
    } catch (requestError) {
      toast({
        title: "Ошибка сохранения",
        description: requestError instanceof Error ? requestError.message : "Не удалось обновить статус",
        variant: "error",
      });
    }
  }

  async function handleDuplicate(orderId: string) {
    try {
      await duplicateOrderMutation.mutateAsync(orderId);
      toast({
        title: "Успешно сохранено",
        description: "Заказ продублирован как черновик",
        variant: "success",
      });
    } catch (requestError) {
      toast({
        title: "Ошибка дублирования",
        description: requestError instanceof Error ? requestError.message : "Не удалось дублировать заказ",
        variant: "error",
      });
    }
  }

  async function handleDelete(orderId: string) {
    if (!window.confirm("Удалить заказ? Если он подтвержден, остатки будут возвращены на склад.")) return;
    try {
      await deleteOrderMutation.mutateAsync(orderId);
      toast({
        title: "Успешно сохранено",
        description: "Заказ удален",
        variant: "success",
      });
    } catch (requestError) {
      toast({
        title: "Ошибка удаления",
        description: requestError instanceof Error ? requestError.message : "Не удалось удалить заказ",
        variant: "error",
      });
    }
  }

  function resetFilters() {
    setStatus("all");
    setDateFrom("");
    setDateTo(todayISO());
    setSearch("");
    setClient("");
    setPhone("");
    setAddress("");
    setMaterial("");
    setUser("");
    setPage(1);
  }

  async function exportOrdersByPeriod() {
    if (!exportStartDate || !exportEndDate) {
      toast({
        title: "Ошибка выгрузки",
        description: "Выберите период для выгрузки",
        variant: "error",
      });
      return;
    }

    if (new Date(exportStartDate).getTime() > new Date(exportEndDate).getTime()) {
      toast({
        title: "Ошибка периода",
        description: "Дата «от» не может быть больше даты «до»",
        variant: "error",
      });
      return;
    }

    try {
      const checkResponse = await fetch(
        `/api/orders?page=1&page_size=1&status=all&date_from=${encodeURIComponent(exportStartDate)}&date_to=${encodeURIComponent(exportEndDate)}`
      );
      const checkData = (await checkResponse.json()) as { pagination?: { total?: number }; error?: string };
      if (!checkResponse.ok) {
        throw new Error(checkData.error ?? "Не удалось проверить заказы для выгрузки");
      }
      if (!checkData.pagination?.total) {
        toast({
          title: "Нет данных",
          description: "За выбранный период заказов нет",
          variant: "error",
        });
        return;
      }
    } catch (requestError) {
      toast({
        title: "Ошибка выгрузки",
        description: requestError instanceof Error ? requestError.message : "Не удалось подготовить выгрузку",
        variant: "error",
      });
      return;
    }

    const href = `/api/exports/excel?section=orders&date_from=${encodeURIComponent(
      exportStartDate
    )}&date_to=${encodeURIComponent(exportEndDate)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Заказы</h1>
          <p className="mt-2 text-sm text-muted">
            Учет заказов с автоматическим списанием материалов, движениями склада и финансовыми итогами.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/orders/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Новый заказ
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card><CardContent className="space-y-1 p-4"><p className="text-xs text-muted">Всего заказов</p><p className="text-2xl font-bold text-ink">{summary.totalOrders}</p></CardContent></Card>
        <Card><CardContent className="space-y-1 p-4"><p className="text-xs text-muted">На общую сумму</p><p className="text-2xl font-bold text-ink">{formatCurrency(summary.totalAmount)}</p></CardContent></Card>
        <Card><CardContent className="space-y-1 p-4"><p className="text-xs text-muted">Установка</p><p className="text-2xl font-bold text-ink">{formatCurrency(summary.installationTotal)}</p></CardContent></Card>
        <Card><CardContent className="space-y-1 p-4"><p className="text-xs text-muted">Итого цех</p><p className="text-2xl font-bold text-ink">{formatCurrency(summary.workshopTotal)}</p></CardContent></Card>
        <Card><CardContent className="space-y-1 p-4"><p className="text-xs text-muted">Прибыль</p><p className="text-2xl font-bold text-emerald-700">{formatCurrency(summary.profitTotal)}</p></CardContent></Card>
        <Card><CardContent className="space-y-1 p-4"><p className="text-xs text-muted">Отмененные / Черновики</p><p className="text-2xl font-bold text-rose-600">{summary.cancelled} / {summary.draft}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <select className="h-10 rounded-xl border border-border bg-white px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
              <option value="all">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="confirmed">Подтвержден</option>
              <option value="completed">Выполнен</option>
              <option value="cancelled">Отменен</option>
            </select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            <Input placeholder="Номер / адрес / телефон" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <Input placeholder="Клиент" value={client} onChange={(e) => { setClient(e.target.value); setPage(1); }} />
            <Input placeholder="Материал" value={material} onChange={(e) => { setMaterial(e.target.value); setPage(1); }} />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Input placeholder="Телефон" value={phone} onChange={(e) => { setPhone(e.target.value); setPage(1); }} />
            <Input placeholder="Адрес" value={address} onChange={(e) => { setAddress(e.target.value); setPage(1); }} />
            <Input placeholder="Пользователь" value={user} onChange={(e) => { setUser(e.target.value); setPage(1); }} />
            <Button variant="outline" className="gap-2" onClick={resetFilters}>
              <RefreshCw className="h-4 w-4" />
              Сбросить
            </Button>
            <Button className="gap-2" onClick={() => setPage(1)}>
              <Search className="h-4 w-4" />
              Применить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">Выгрузка в Excel</p>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="mb-1 text-xs text-muted">Дата от</p>
              <Input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Дата до</p>
              <Input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
            </div>
            <Button className="gap-2 self-end" onClick={exportOrdersByPeriod}>
              <Download className="h-4 w-4" />
              Выгрузка в Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left">№ заказа</th>
                  <th className="px-3 py-3 text-left">Дата</th>
                  <th className="px-3 py-3 text-left">Адрес</th>
                  <th className="px-3 py-3 text-left">Клиент</th>
                  <th className="px-3 py-3 text-left">Телефон</th>
                  <th className="px-3 py-3 text-left">Материалы</th>
                  <th className="px-3 py-3 text-right">Сумма</th>
                  <th className="px-3 py-3 text-right">Установка</th>
                  <th className="px-3 py-3 text-right">Итого цех</th>
                  <th className="px-3 py-3 text-right">Прибыль</th>
                  <th className="px-3 py-3 text-left">Статус</th>
                  <th className="px-3 py-3 text-left">Обновлен</th>
                  <th className="px-3 py-3 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="px-3 py-8 text-center text-muted" colSpan={13}>Загрузка заказов...</td></tr>
                ) : error ? (
                  <tr><td className="px-3 py-8 text-center text-rose-600" colSpan={13}>{error.message}</td></tr>
                ) : !orders.length ? (
                  <tr><td className="px-3 py-8 text-center text-muted" colSpan={13}>Заказы не найдены</td></tr>
                ) : (
                  orders.map((order, index) => {
                    const statusMeta = orderStatusMeta(order.status);
                    const displayIndex = String((pagination.page - 1) * pagination.pageSize + index + 1).padStart(2, "0");
                    return (
                      <tr key={order.id} className="border-t border-border">
                        <td className="px-3 py-3 font-semibold text-ink">{`Заказ №${displayIndex}`}</td>
                        <td className="px-3 py-3">{new Date(order.order_date).toLocaleDateString("ru-RU")}</td>
                        <td className="px-3 py-3">{order.address}</td>
                        <td className="px-3 py-3">{order.client_name || "-"}</td>
                        <td className="px-3 py-3">{order.phone || "-"}</td>
                        <td className="px-3 py-3 text-muted">{order.materials_preview || "-"}</td>
                        <td className="px-3 py-3 text-right font-medium">{formatCurrency(Number(order.total_amount))}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(Number(order.installation_amount))}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(Number(order.workshop_total))}</td>
                        <td className="px-3 py-3 text-right font-semibold text-emerald-700">{formatCurrency(Number(order.gross_profit))}</td>
                        <td className="px-3 py-3">
                          <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-medium", statusMeta.className)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted">{new Date(order.updated_at).toLocaleString("ru-RU")}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Link href={`/orders/${order.id}`}>
                              <Button size="sm" variant="outline" className="gap-1">
                                <FilePenLine className="h-3.5 w-3.5" />
                                Открыть
                              </Button>
                            </Link>
                            {order.status !== "cancelled" ? (
                              <Button size="sm" variant="outline" className="gap-1 text-rose-600" onClick={() => handleStatus(order.id, "cancelled")}>
                                <XCircle className="h-3.5 w-3.5" />
                                Отменить
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => handleDuplicate(order.id)}>
                              Дубль
                            </Button>
                            <a href={`/api/exports/excel?section=orders&order_id=${order.id}`}>
                              <Button size="sm" variant="outline" className="gap-1">
                                <Download className="h-3.5 w-3.5" />
                                Excel
                              </Button>
                            </a>
                            <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => handleDelete(order.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">
            Показано {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} из {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Назад</Button>
            <span className="text-xs text-muted">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((v) => v + 1)}>Вперед</Button>
            <select
              className="h-8 rounded-lg border border-border bg-white px-2 text-xs"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
