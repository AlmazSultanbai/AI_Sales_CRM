"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CircleDollarSign, Filter, Plus, Sheet } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useCollections } from "@/features/catalog/hooks/use-catalog-queries";
import { useOrders } from "@/features/orders/hooks/use-orders-queries";
import { OrderFeedTable } from "@/features/orders/components/order-feed-table";
import { OrderPreviewDialog } from "@/features/orders/components/order-preview-dialog";
import { StoreListPanel } from "@/features/stores/components/store-list-panel";
import { StoreSummaryCards } from "@/features/stores/components/store-summary-cards";
import { StoreFormDialog } from "@/features/stores/components/store-form-dialog";
import { PaymentFormDialog } from "@/features/stores/components/payment-form-dialog";
import { PurchaseDetailsDialog } from "@/features/stores/components/purchase-details-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useStoreDetails, useStoreMutations, useStorePayments, useStorePurchases, useStores } from "@/features/stores/hooks/use-stores-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToaster } from "@/components/ui/toaster";
import { Purchase, Store } from "@/types/domain";
import { debtRiskByDays, formatCurrency, formatPurchaseId } from "@/features/stores/lib/view-utils";

type StoreFilter = "all" | "with_debt" | "without_debt" | "inactive";
type StoreSort = "name" | "debt" | "activity";
type OrderStatusFilter = "all" | "draft" | "confirmed" | "completed" | "cancelled";
type PaymentMethodFilter = "all" | "cash" | "bank" | "card" | "transfer";

function exportStoreCsv(store: Store, purchases: Purchase[]) {
  const rows = [
    ["Номер закупки", "Дата", "Сумма", "Оплачено", "Долг", "Статус"],
    ...purchases.map((purchase) => [
      purchase.purchase_number,
      purchase.purchase_date,
      String(purchase.total_amount),
      String(purchase.paid_amount),
      String(purchase.debt_amount),
      purchase.payment_status,
    ]),
  ];

  const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `store-history-${store.name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function StoresPage() {
  const router = useRouter();
  const { toast } = useToaster();
  const [searchValue, setSearchValue] = useState("");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [storeSort, setStoreSort] = useState<StoreSort>("activity");
  const [selectedStoreId, setSelectedStoreId] = useState<string>();
  const [activeTab, setActiveTab] = useState("purchases");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase>();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [orderStatus, setOrderStatus] = useState<OrderStatusFilter>("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");

  const [paymentDateFrom, setPaymentDateFrom] = useState("");
  const [paymentDateTo, setPaymentDateTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>("all");

  const search = useDebounce(searchValue, 250);
  const { data: stores = [], isLoading: storesLoading, error: storesError } = useStores(search, storeFilter, storeSort);
  const { data: selectedStore } = useStoreDetails(selectedStoreId);
  const activeStore = selectedStore ?? stores.find((store) => store.id === selectedStoreId);
  const { data: collections = [] } = useCollections("", "all");

  const paymentFilters = useMemo(
    () => ({
      date_from: paymentDateFrom || undefined,
      date_to: paymentDateTo || undefined,
      method: paymentMethod,
    }),
    [paymentDateFrom, paymentDateTo, paymentMethod]
  );

  const { data: purchases = [] } = useStorePurchases(selectedStoreId);
  const { data: payments = [], isLoading: paymentsLoading } = useStorePayments(selectedStoreId, paymentFilters);
  const {
    data: ordersData,
    isLoading: ordersLoading,
  } = useOrders({
    page: 1,
    page_size: 80,
    status: orderStatus,
    date_from: orderDateFrom || undefined,
    date_to: orderDateTo || undefined,
    client: activeStore?.name || undefined,
  }, {
    enabled: Boolean(activeStore?.id) && activeTab === "purchases",
  });
  const {
    createStoreMutation,
    updateStoreMutation,
    archiveStoreMutation,
    createPurchaseMutation,
    updatePurchaseMutation,
    deletePurchaseMutation,
    createPaymentMutation,
  } = useStoreMutations();

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId(undefined);
      return;
    }

    const exists = stores.some((store) => store.id === selectedStoreId);
    if (!selectedStoreId || !exists) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const isPending =
    createStoreMutation.isPending ||
    updateStoreMutation.isPending ||
    archiveStoreMutation.isPending ||
    createPurchaseMutation.isPending ||
    updatePurchaseMutation.isPending ||
    deletePurchaseMutation.isPending ||
    createPaymentMutation.isPending;

  const totalPurchases = Number(activeStore?.total_purchases_sum ?? 0);
  const totalPaid = Number(activeStore?.total_paid_sum ?? 0);
  const totalDebt = Number(activeStore?.current_debt_sum ?? activeStore?.debt_balance ?? 0);

  const openDebts = purchases.filter((purchase) => Number(purchase.debt_amount) > 0);
  const storeOrders = useMemo(() => {
    const items = ordersData?.items ?? [];
    const storeName = (activeStore?.name ?? "").trim().toLowerCase();
    const storePhone = (activeStore?.phone ?? "").trim();
    if (!storeName && !storePhone) return items;

    return items.filter((order) => {
      const orderClient = (order.client_name ?? "").trim().toLowerCase();
      const orderPhone = (order.phone ?? "").trim();
      const byName = !!storeName && orderClient === storeName;
      const byPhone = !!storePhone && !!orderPhone && orderPhone === storePhone;
      return byName || byPhone;
    });
  }, [ordersData?.items, activeStore?.name, activeStore?.phone]);

  const storeOrdersExportHref = useMemo(() => {
    if (!activeStore?.name || !orderDateFrom || !orderDateTo) return "";
    const params = new URLSearchParams({
      section: "orders",
      date_from: orderDateFrom,
      date_to: orderDateTo,
      store_name: activeStore.name,
    });
    return `/api/exports/excel?${params.toString()}`;
  }, [activeStore?.name, orderDateFrom, orderDateTo]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Магазины</h1>
          <p className="mt-2 text-sm text-muted">Учет закупок, оплат и долгов по каждому магазину</p>
        </div>

        <StoreFormDialog
          mode="create"
          onCreate={async (payload) => {
            await createStoreMutation.mutateAsync(payload);
          }}
          disabled={isPending}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Магазин
            </Button>
          }
        />
      </div>

      {storesError ? (
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">{storesError.message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <StoreListPanel
          stores={stores}
          selectedStoreId={selectedStoreId}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          filter={storeFilter}
          onFilterChange={setStoreFilter}
          sort={storeSort}
          onSortChange={setStoreSort}
          onSelectStore={setSelectedStoreId}
        />

        <div className="space-y-4">
          {storesLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted">Загрузка магазинов...</CardContent>
            </Card>
          ) : null}

          {!storesLoading && !activeStore ? (
            <Card>
              <CardContent className="p-10 text-center text-muted">Выберите магазин из списка или создайте новый.</CardContent>
            </Card>
          ) : null}

          {activeStore ? (
            <>
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-ink">{activeStore.name}</h2>
                      <div className="mt-2 grid gap-1 text-sm text-muted">
                        <p>Контакт: {activeStore.contact_person || "не указан"}</p>
                        <p>Телефон: {activeStore.phone || "не указан"}</p>
                        <p>Адрес: {activeStore.address || "не указан"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button className="gap-2" onClick={() => router.push(`/orders/new?storeId=${activeStore.id}`)}>
                        <Plus className="h-4 w-4" />
                        Заказ
                      </Button>

                      <PaymentFormDialog
                        purchases={purchases}
                        onCreate={async (payload) => {
                          await createPaymentMutation.mutateAsync({ storeId: activeStore.id, payload });
                        }}
                        disabled={isPending}
                        trigger={
                          <Button className="gap-2 border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700">
                            <CircleDollarSign className="h-4 w-4" />
                            Оплата
                          </Button>
                        }
                      />

                      <StoreFormDialog
                        mode="edit"
                        initialStore={activeStore}
                        onUpdate={async (payload) => {
                          await updateStoreMutation.mutateAsync({ storeId: activeStore.id, payload });
                        }}
                        disabled={isPending}
                        trigger={<Button variant="outline">Редактировать</Button>}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => setActiveTab("debts")}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Все долги магазина
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => exportStoreCsv(activeStore, purchases)}
                    >
                      <Sheet className="h-3.5 w-3.5" />
                      Выгрузить Excel (CSV)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={async () => {
                        const firstConfirm = window.confirm("Удалить магазин?");
                        if (!firstConfirm) return;
                        const secondConfirm = window.confirm("Вы точно хотите удалить этот магазин?");
                        if (!secondConfirm) return;

                        const password = window.prompt("Введите пароль для подтверждения удаления магазина");
                        if (!password) return;

                        try {
                          await archiveStoreMutation.mutateAsync({ storeId: activeStore.id, password });
                          toast({
                            title: "Успешно сохранено",
                            description: "Магазин удален",
                            variant: "success",
                            duration: 3000,
                          });
                        } catch (error) {
                          toast({
                            title: "Ошибка удаления",
                            description: error instanceof Error ? error.message : "Не удалось удалить магазин",
                            variant: "error",
                            duration: 4000,
                          });
                        }
                      }}
                    >
                      Удалить магазин
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <StoreSummaryCards totalPurchases={totalPurchases} totalPaid={totalPaid} currentDebt={totalDebt} />

              <Card>
                <CardContent className="p-5">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="w-full overflow-x-auto">
                        <TabsList className="min-w-max">
                          <TabsTrigger value="purchases">Заказы</TabsTrigger>
                          <TabsTrigger value="payments">Платежи</TabsTrigger>
                          <TabsTrigger value="debts">Долги</TabsTrigger>
                          <TabsTrigger value="info">Информация</TabsTrigger>
                        </TabsList>
                      </div>
                    </div>

                    <TabsContent value="purchases" className="space-y-4">
                      <div className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 lg:grid-cols-6">
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-muted">Статус</label>
                          <select
                            className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                            value={orderStatus}
                            onChange={(event) => setOrderStatus(event.target.value as OrderStatusFilter)}
                          >
                            <option value="all">Все</option>
                            <option value="draft">Черновик</option>
                            <option value="confirmed">Подтвержден</option>
                            <option value="completed">Выполнен</option>
                            <option value="cancelled">Отменен</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">Дата от</label>
                          <Input type="date" value={orderDateFrom} onChange={(event) => setOrderDateFrom(event.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">Дата до</label>
                          <Input type="date" value={orderDateTo} onChange={(event) => setOrderDateTo(event.target.value)} />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-muted">Выгрузка</label>
                          <Button
                            variant="outline"
                            className="mt-0.5 h-10 w-full justify-center whitespace-nowrap px-3 text-center text-sm font-medium leading-none [border-width:1.15px]"
                            onClick={() => {
                              if (!activeStore?.name) {
                                toast({
                                  title: "Выберите магазин",
                                  description: "Сначала выберите магазин для выгрузки",
                                  variant: "error",
                                  duration: 3000,
                                });
                                return;
                              }
                              if (!orderDateFrom || !orderDateTo) {
                                toast({
                                  title: "Выберите период",
                                  description: "Укажите дату от и дату до для выгрузки",
                                  variant: "error",
                                  duration: 3000,
                                });
                                return;
                              }
                              window.location.href = storeOrdersExportHref;
                            }}
                          >
                            Выгрузка в Excel
                          </Button>
                        </div>
                      </div>

                      {ordersLoading ? (
                        <p className="py-6 text-center text-sm text-muted">Загрузка заказов...</p>
                      ) : null}

                      {!ordersLoading ? (
                        <OrderFeedTable
                          title="Лента заказов (сделанных до выбранной даты)"
                          items={storeOrders}
                          onOpen={(id) => setSelectedOrderId(id)}
                        />
                      ) : null}
                    </TabsContent>

                    <TabsContent value="payments" className="space-y-4">
                      <div className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">Дата от</label>
                          <Input type="date" value={paymentDateFrom} onChange={(event) => setPaymentDateFrom(event.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">Дата до</label>
                          <Input type="date" value={paymentDateTo} onChange={(event) => setPaymentDateTo(event.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">Способ оплаты</label>
                          <select
                            className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodFilter)}
                          >
                            <option value="all">Все</option>
                            <option value="cash">Наличные</option>
                            <option value="bank">Банк</option>
                            <option value="card">Карта</option>
                            <option value="transfer">Перевод</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <Button variant="outline" className="w-full gap-2">
                            <Filter className="h-4 w-4" />
                            Фильтр применен
                          </Button>
                        </div>
                      </div>

                      {paymentsLoading ? (
                        <p className="py-6 text-center text-sm text-muted">Загрузка платежей...</p>
                      ) : (
                        <div className="space-y-3">
                          {payments.map((payment) => (
                            <div key={payment.id} className="rounded-2xl border border-border bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-ink">
                                    {new Date(payment.payment_date).toLocaleDateString("ru-RU")}
                                  </p>
                                  <p className="mt-1 text-xs text-muted">
                                    Способ: {payment.payment_method}
                                    {payment.purchase_id ? ` • Закупка: ${formatPurchaseId(purchases.find((p) => p.id === payment.purchase_id)?.purchase_number ?? "-")}` : ""}
                                  </p>
                                  {payment.comment ? <p className="mt-1 text-xs text-muted">{payment.comment}</p> : null}
                                </div>
                                <p className="text-lg font-bold text-emerald-700">{formatCurrency(Number(payment.amount))}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!payments.length && !paymentsLoading ? (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                          Платежей пока нет
                        </div>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="debts" className="space-y-3">
                      {openDebts.map((purchase) => {
                        const daysOverdue = differenceInCalendarDays(new Date(), parseISO(purchase.purchase_date));
                        const risk = debtRiskByDays(daysOverdue);

                        return (
                          <div key={purchase.id} className="rounded-2xl border border-border bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">{formatPurchaseId(purchase.purchase_number)}</p>
                                <p className="text-xs text-muted">
                                  {new Date(purchase.purchase_date).toLocaleDateString("ru-RU")} • Просрочка: {daysOverdue} дн.
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge className={risk.className}>{risk.label}</Badge>
                                <span className="text-sm font-semibold text-rose-700">
                                  {formatCurrency(Number(purchase.debt_amount))}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {!openDebts.length ? (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-emerald-700">
                          У магазина нет открытых долгов
                        </div>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="info">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Контакты</p>
                          <div className="mt-3 space-y-1 text-sm text-ink">
                            <p>Контакт: {activeStore.contact_person || "-"}</p>
                            <p>Телефон: {activeStore.phone || "-"}</p>
                            <p>Адрес: {activeStore.address || "-"}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Метрики</p>
                          <div className="mt-3 space-y-1 text-sm text-ink">
                            <p>Всего закупок: {formatCurrency(totalPurchases)}</p>
                            <p>Оплачено: {formatCurrency(totalPaid)}</p>
                            <p>Текущий долг: {formatCurrency(totalDebt)}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-white p-4 md:col-span-2">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Заметки</p>
                          <p className="mt-2 text-sm text-ink">{activeStore.notes || "Нет заметок"}</p>
                          <p className="mt-3 text-xs text-muted">
                            Создан: {activeStore.created_at ? new Date(activeStore.created_at).toLocaleString("ru-RU") : "-"} • Последняя активность:{" "}
                            {activeStore.last_activity_at ? new Date(activeStore.last_activity_at).toLocaleString("ru-RU") : "-"}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <PurchaseDetailsDialog
        purchase={selectedPurchase}
        collections={collections}
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        onCreatePayment={async (payload) => {
          if (!activeStore) return;
          await createPaymentMutation.mutateAsync({ storeId: activeStore.id, payload });
        }}
        onUpdatePurchase={async (payload) => {
          if (!activeStore || !selectedPurchase) return;
          await updatePurchaseMutation.mutateAsync({
            storeId: activeStore.id,
            purchaseId: selectedPurchase.id,
            payload,
          });
        }}
        onDeletePurchase={async () => {
          if (!activeStore || !selectedPurchase) return;
          await deletePurchaseMutation.mutateAsync({
            storeId: activeStore.id,
            purchaseId: selectedPurchase.id,
          });
        }}
        pending={isPending}
      />
      <OrderPreviewDialog orderId={selectedOrderId} open={Boolean(selectedOrderId)} onClose={() => setSelectedOrderId(null)} />
    </section>
  );
}
