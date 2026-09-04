"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Download, Filter, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOrders, useOrderMutations } from "@/features/orders/hooks/use-orders-queries";
import { useStores } from "@/features/stores/hooks/use-stores-queries";
import { formatCurrency, formatOrderNumber, orderPaymentStatusMeta, orderStatusMeta } from "@/features/orders/lib/view-utils";
import { useToaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { countWithWord } from "@/lib/format";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function OrdersPage() {
  const router = useRouter();
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
  const [showFilters, setShowFilters] = useState(false);
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
  // Долг клиента целиком: считается на сервере по заказам, тянем список клиентов один раз.
  const { data: storesForDebt = [] } = useStores("", "all", "name");
  const clientDebtByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const store of storesForDebt) {
      const key = String(store.name ?? "").trim().toLowerCase();
      if (key) map.set(key, Number(store.current_debt_sum ?? store.debt_balance ?? 0));
    }
    return map;
  }, [storesForDebt]);
  const summary = data?.summary ?? {
    totalOrders: 0,
    totalAmount: 0,
    installationTotal: 0,
    workshopTotal: 0,
    profitTotal: 0,
    totalPaid: 0,
    totalDebt: 0,
    cancelled: 0,
    draft: 0,
  };
  const pagination = data?.pagination ?? { page: 1, pageSize, total: 0, totalPages: 1 };
  const orders = data?.items ?? [];

  // Группировка страницы по дням: чип дня = разделитель + мини-итог.
  const groupedOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
      const byDate = String(b.order_date).localeCompare(String(a.order_date));
      if (byDate !== 0) return byDate;
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const groups: Array<{ key: string; label: string; total: number; positions: number; orders: typeof orders }> = [];
    for (const order of sorted) {
      const key = String(order.order_date);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        const label =
          key === today ? "Сегодня" : key === yesterday ? "Вчера" : new Date(key).toLocaleDateString("ru-RU");
        group = { key, label, total: 0, positions: 0, orders: [] };
        groups.push(group);
      }
      group.orders.push(order);
      group.total += Number(order.total_amount ?? 0);
      group.positions += (order as { order_items?: Array<unknown> }).order_items?.length ?? 0;
    }
    return groups;
  }, [orders]);

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
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="crm-title">Заказы</h1>
          <p className="crm-section-subtitle">
            {countWithWord(summary.totalOrders, ["заказ", "заказа", "заказов"])} на {formatCurrency(summary.totalAmount)}
          </p>
        </div>
        <Link href="/orders/new" className="shrink-0">
          <Button className="gap-1.5 rounded-2xl px-4">
            <Plus className="h-4 w-4" />
            Заказ
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          className="crm-search"
          placeholder="Поиск: номер, адрес, телефон..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Оплачено</p>
          <p className="mt-1 break-words text-xl font-bold leading-tight text-emerald-700">{formatCurrency(summary.totalPaid)}</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Долг</p>
          <p className="mt-1 break-words text-xl font-bold leading-tight text-rose-600">{formatCurrency(summary.totalDebt)}</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Прибыль</p>
          <p className="mt-1 break-words text-xl font-bold leading-tight text-emerald-700">{formatCurrency(summary.profitTotal)}</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Отменено / черновики</p>
          <p className="mt-1 text-xl font-bold leading-tight text-slate-700">
            {summary.cancelled} / {summary.draft}
          </p>
        </div>
      </div>

      <div className="crm-chips">
        {(
          [
            { value: "all", label: "Все статусы" },
            { value: "draft", label: "Черновик" },
            { value: "confirmed", label: "Подтвержден" },
            { value: "completed", label: "Выполнен" },
            { value: "cancelled", label: "Отменен" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setStatus(option.value);
              setPage(1);
            }}
            className={
              status === option.value
                ? "shrink-0 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white"
                : "shrink-0 rounded-xl border border-border bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {option.label}
          </button>
        ))}

        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 rounded-xl"
          onClick={() => setShowFilters((value) => !value)}
        >
          <Filter className="h-3.5 w-3.5" />
          Фильтр
        </Button>
      </div>

      <Card className={showFilters ? "" : "hidden"}>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Дата от</p>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Дата до</p>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>
            <Input placeholder="Клиент" value={client} onChange={(e) => { setClient(e.target.value); setPage(1); }} />
            <Input placeholder="Материал" value={material} onChange={(e) => { setMaterial(e.target.value); setPage(1); }} />
            <Input placeholder="Телефон" value={phone} onChange={(e) => { setPhone(e.target.value); setPage(1); }} />
            <Input placeholder="Адрес" value={address} onChange={(e) => { setAddress(e.target.value); setPage(1); }} />
            <Input placeholder="Пользователь" value={user} onChange={(e) => { setUser(e.target.value); setPage(1); }} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-w-[130px] flex-1 gap-2 sm:flex-none" onClick={resetFilters}>
              <RefreshCw className="h-4 w-4" />
              Сбросить
            </Button>
            <Button className="min-w-[130px] flex-1 gap-2 sm:flex-none" onClick={() => setPage(1)}>
              <Search className="h-4 w-4" />
              Применить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-3 sm:p-4">
          <p className="text-sm font-semibold text-ink">Выгрузка в Excel</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="mb-1 text-xs text-muted">Дата от</p>
              <Input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Дата до</p>
              <Input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
            </div>
            <Button className="w-full gap-2 self-end sm:col-span-2 lg:col-span-1 lg:w-auto" onClick={exportOrdersByPeriod}>
              <Download className="h-4 w-4" />
              Выгрузка в Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted">Загрузка заказов...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-rose-600">{error.message}</CardContent>
        </Card>
      ) : !orders.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted">Заказы не найдены</CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {groupedOrders.map((group) => (
            <div key={group.key} className="space-y-2.5">
              {/* Чип дня — разделитель и мини-отчёт сразу: как в KerbenPro. */}
              <div className="flex flex-wrap items-baseline gap-x-2 rounded-xl bg-accent/10 px-3.5 py-2 text-[13px] font-medium text-slate-600">
                <span className="font-semibold text-ink">{group.label}</span>
                <span>
                  · {countWithWord(group.orders.length, ["заказ", "заказа", "заказов"])} на{" "}
                  <b className="text-accent">{formatCurrency(group.total)}</b>
                  {group.positions > 0 ? ` · ${countWithWord(group.positions, ["позиция", "позиции", "позиций"])}` : ""}
                </span>
              </div>

              {group.orders.map((order) => {
                const paymentMeta = orderPaymentStatusMeta(
                  order.payment_status,
                  Number(order.paid_amount),
                  Number(order.total_amount)
                );
                // Долг считаем от суммы и оплат: в части старых заказов debt_amount в базе не пересчитан
                // и хранит 0 при нулевой оплате — брать его напрямую нельзя.
                const debt = Math.max(Number(order.total_amount) - Number(order.paid_amount), 0);
                const total = Number(order.total_amount);
                const paidShare = total > 0 ? Math.min(100, Math.round((Number(order.paid_amount) / total) * 100)) : 0;
                const clientDebt = clientDebtByName.get(String(order.client_name ?? "").trim().toLowerCase());

                return (
                  <div
                    key={order.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(`/orders/${order.id}`);
                    }}
                    className="crm-row crm-row-link cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="crm-row-title truncate">{order.client_name || order.address || formatOrderNumber(order.order_number)}</p>
                        <p className="crm-row-sub truncate">
                          {`${formatOrderNumber(order.order_number)} · ${new Date(order.order_date).toLocaleDateString("ru-RU")}`}
                          {order.phone ? ` · ${order.phone}` : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="crm-row-amount">{formatCurrency(total)}</p>
                        <p className="crm-row-amount-sub">
                          {debt > 0 ? `долг ${formatCurrency(debt)}` : "оплачен полностью"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Статус — дропдауном: «Отменить» живёт внутри него. */}
                        <select
                          aria-label="Статус заказа"
                          value={order.status}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            const next = event.target.value as typeof order.status;
                            if (next === "cancelled" && !window.confirm("Отменить заказ? Остатки будут возвращены на склад.")) {
                              event.target.value = order.status;
                              return;
                            }
                            void handleStatus(order.id, next);
                          }}
                          className={cn(
                            "appearance-none rounded-lg border px-2.5 py-1 pr-6 text-[12px] font-semibold leading-none outline-none",
                            "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22%3E%3Cpath d=%22M1 1l4 4 4-4%22 stroke=%22currentColor%22 stroke-width=%221.5%22 fill=%22none%22/%3E%3C/svg%3E')] bg-[position:right_8px_center] bg-no-repeat",
                            orderStatusMeta(order.status).className
                          )}
                        >
                          <option value="draft">Черновик</option>
                          <option value="confirmed">Подтвержден</option>
                          <option value="completed">Выполнен</option>
                          <option value="cancelled">Отменен</option>
                        </select>
                        <span className={cn("inline-flex rounded-lg border px-2.5 py-1 text-[12px] font-semibold leading-none", paymentMeta.className)}>
                          {paymentMeta.label}
                        </span>
                      </div>

                      <ActionMenu
                        ariaLabel="Действия с заказом"
                        items={[
                          { label: "Дубль заказа", icon: <Copy className="h-4 w-4" />, onSelect: () => void handleDuplicate(order.id) },
                          {
                            label: "Excel по заказу",
                            icon: <Download className="h-4 w-4" />,
                            onSelect: () => window.open(`/api/exports/excel?section=orders&order_id=${order.id}`, "_blank"),
                          },
                          { label: "Удалить заказ", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => void handleDelete(order.id) },
                        ]}
                      />
                    </div>

                    {order.materials_preview ? (
                      <p className="mt-2 line-clamp-2 text-[13px] text-muted">{order.materials_preview}</p>
                    ) : null}

                    <div className="mt-2.5 border-t border-border pt-2.5 text-[13px]">
                      <div className="flex items-baseline justify-between gap-2 text-muted">
                        <span>
                          Оплачено {paidShare}% · <b className="text-emerald-700">{formatCurrency(Number(order.paid_amount))}</b>
                        </span>
                        {debt > 0 ? <b className="text-rose-600">Долг {formatCurrency(debt)}</b> : null}
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                        <i className="block h-full rounded-full bg-emerald-600" style={{ width: `${paidShare}%` }} />
                      </div>
                      {clientDebt != null && clientDebt > 0.009 ? (
                        <p className="mt-1.5 text-[12px] text-muted">
                          Весь долг клиента: <b className="text-rose-600">{formatCurrency(clientDebt)}</b>
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
      </div>
    </section>
  );
}
