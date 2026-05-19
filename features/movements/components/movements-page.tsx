"use client";

import { useMemo, useState } from "react";
import { Download, Filter, Search, UserCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { useDebounce } from "@/hooks/use-debounce";
import { useStockMovements } from "@/features/inventory/hooks/use-stock-queries";
import { formatSom, formatStockQuantity, movementTypeLabel } from "@/features/inventory/lib/stock-utils";
import { unitLabel } from "@/lib/units";

function movementBadge(type: string) {
  if (type === "incoming") return "bg-emerald-100 text-emerald-700";
  if (type === "outgoing" || type === "writeoff") return "bg-rose-100 text-rose-700";
  if (type === "transfer") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

function dotColor(name?: string | null) {
  const value = (name ?? "").toLowerCase();
  if (value.includes("синий")) return "bg-blue-700";
  if (value.includes("графит")) return "bg-slate-700";
  if (value.includes("сер")) return "bg-slate-400";
  if (value.includes("беж")) return "bg-amber-200";
  if (value.includes("чер")) return "bg-black";
  if (value.includes("бел")) return "bg-slate-200";
  if (value.includes("олив")) return "bg-emerald-700";
  return "bg-slate-500";
}

export function MovementsPage() {
  const [movementType, setMovementType] = useState<"all" | "incoming" | "outgoing" | "transfer" | "adjustment">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [material, setMaterial] = useState("");
  const [collection, setCollection] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [supplierOrStore, setSupplierOrStore] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const search = useDebounce(searchValue, 250);
  const materialDebounced = useDebounce(material, 250);
  const collectionDebounced = useDebounce(collection, 250);
  const modelDebounced = useDebounce(model, 250);
  const colorDebounced = useDebounce(color, 250);
  const sourceFilter = useDebounce(supplierOrStore, 250);
  const createdByFilter = useDebounce(createdBy, 250);

  const filters = useMemo(
    () => ({
      movement_type: movementType === "all" ? undefined : movementType,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search || undefined,
      material: materialDebounced || undefined,
      collection: collectionDebounced || undefined,
      model: modelDebounced || undefined,
      color: colorDebounced || undefined,
      supplier_or_store: sourceFilter || undefined,
      created_by: createdByFilter || undefined,
      page,
      page_size: pageSize,
    }),
    [
      movementType,
      dateFrom,
      dateTo,
      search,
      materialDebounced,
      collectionDebounced,
      modelDebounced,
      colorDebounced,
      sourceFilter,
      createdByFilter,
      page,
      pageSize,
    ]
  );

  const { data, isLoading, error } = useStockMovements(filters);
  const items = data?.items ?? [];
  const summary = data?.summary ?? { total: 0, incoming: 0, outgoing: 0, transfer: 0, adjustment: 0 };
  const pagination = data?.pagination ?? { page: 1, pageSize, total: 0, totalPages: 1 };

  const exportLink = useMemo(() => {
    const params = new URLSearchParams();
    params.set("section", "movements");
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return `/api/exports/excel?${params.toString()}`;
  }, [dateFrom, dateTo]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Движения</h1>
          <p className="mt-1 text-sm text-muted">Полная история всех операций по складу.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <a href={exportLink}>
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <Download className="h-4 w-4" />
              Выгрузить в Excel
            </Button>
          </a>
          <Button variant="outline" size="icon" aria-label="Профиль" className="hidden sm:inline-flex">
            <UserCircle2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(240px,auto)]">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Тип операции</p>
              <select
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={movementType}
                onChange={(event) => {
                  setMovementType(event.target.value as typeof movementType);
                  setPage(1);
                }}
              >
                <option value="all">Все типы</option>
                <option value="incoming">Приход</option>
                <option value="outgoing">Расход</option>
                <option value="transfer">Перемещение</option>
                <option value="adjustment">Корректировка</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Период</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
                <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Поиск</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Товар, SKU, модель..."
                  value={searchValue}
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Материал</p>
              <Input value={material} onChange={(event) => { setMaterial(event.target.value); setPage(1); }} placeholder="Все материалы" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Коллекция</p>
              <Input value={collection} onChange={(event) => { setCollection(event.target.value); setPage(1); }} placeholder="Все коллекции" />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Модель</p>
              <Input value={model} onChange={(event) => { setModel(event.target.value); setPage(1); }} placeholder="Все модели" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Цвет</p>
              <Input value={color} onChange={(event) => { setColor(event.target.value); setPage(1); }} placeholder="Все цвета" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Поставщик / Магазин</p>
              <Input
                value={supplierOrStore}
                onChange={(event) => {
                  setSupplierOrStore(event.target.value);
                  setPage(1);
                }}
                placeholder="Все"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Пользователь</p>
              <Input
                value={createdBy}
                onChange={(event) => {
                  setCreatedBy(event.target.value);
                  setPage(1);
                }}
                placeholder="Все"
              />
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setMovementType("all");
                  setDateFrom("");
                  setDateTo("");
                  setSearchValue("");
                  setMaterial("");
                  setCollection("");
                  setModel("");
                  setColor("");
                  setSupplierOrStore("");
                  setCreatedBy("");
                  setPage(1);
                }}
              >
                Сбросить
              </Button>
              <Button className="w-full gap-2 sm:w-auto">
                <Filter className="h-4 w-4" />
                Применить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-2 p-4 md:grid-cols-5">
          <div className="rounded-xl border border-border bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Всего операций</p>
            <p className="mt-1 text-2xl font-bold text-ink">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-emerald-50 px-3 py-2">
            <p className="text-xs text-emerald-700">Приход</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.incoming}</p>
          </div>
          <div className="rounded-xl border border-border bg-rose-50 px-3 py-2">
            <p className="text-xs text-rose-700">Расход</p>
            <p className="mt-1 text-2xl font-bold text-rose-700">{summary.outgoing}</p>
          </div>
          <div className="rounded-xl border border-border bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-700">Перемещение</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{summary.transfer}</p>
          </div>
          <div className="rounded-xl border border-border bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">Корректировка</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{summary.adjustment}</p>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-5 text-sm text-rose-600">{error.message}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="hidden px-2 py-3 text-left lg:table-cell"><input type="checkbox" /></th>
                  <th className="px-2 py-3 text-left font-semibold">Дата и время</th>
                  <th className="px-2 py-3 text-left font-semibold">Тип операции</th>
                  <th className="px-2 py-3 text-left font-semibold">Товар / Материал</th>
                  <th className="hidden px-2 py-3 text-left font-semibold xl:table-cell">Модель</th>
                  <th className="hidden px-2 py-3 text-left font-semibold 2xl:table-cell">Цвет</th>
                  <th className="px-2 py-3 text-left font-semibold">SKU</th>
                  <th className="px-2 py-3 text-left font-semibold">Количество</th>
                  <th className="hidden px-2 py-3 text-left font-semibold lg:table-cell">Сумма</th>
                  <th className="hidden px-2 py-3 text-left font-semibold 2xl:table-cell">Источник / Получатель</th>
                  <th className="hidden px-2 py-3 text-left font-semibold 2xl:table-cell">Комментарий</th>
                  <th className="hidden px-2 py-3 text-left font-semibold xl:table-cell">Пользователь</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td className="px-2 py-8 text-center text-muted" colSpan={12}>
                      Загрузка движений...
                    </td>
                  </tr>
                ) : null}

                {!isLoading && !items.length ? (
                  <tr>
                    <td className="px-2 py-8 text-center text-muted" colSpan={12}>
                      Движения не найдены по текущим фильтрам.
                    </td>
                  </tr>
                ) : null}

                {!isLoading
                  ? items.map((movement) => {
                      const stock = movement.stock_items as
                        | {
                            material_name?: string | null;
                            model_code?: string | null;
                            color_name?: string | null;
                            sku?: string | null;
                            photo_url?: string | null;
                            unit?: "m2" | "meter" | "piece" | "pack" | null;
                          }
                        | null
                        | undefined;
                      const source = (movement as { source_name?: string | null }).source_name;
                      const destination = (movement as { destination_name?: string | null }).destination_name;
                      const creatorName = (movement as { creator_name?: string | null }).creator_name;

                      return (
                        <tr key={movement.id} className="transition hover:bg-slate-50/70">
                          <td className="hidden px-2 py-2.5 lg:table-cell"><input type="checkbox" /></td>
                          <td className="px-2 py-2.5 text-xs text-slate-700">
                            <p>{new Date(movement.created_at).toLocaleDateString("ru-RU")}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {new Date(movement.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>
                          <td className="px-2 py-2.5">
                            <Badge className={movementBadge(movement.movement_type)}>
                              {movementTypeLabel(movement.movement_type)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-2">
                              <ProductThumb src={stock?.photo_url ?? null} alt={stock?.material_name ?? "Товар"} className="h-8 w-8 rounded-md" />
                              <span className="font-semibold text-ink">{stock?.material_name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="hidden px-2 py-2.5 text-slate-700 xl:table-cell">{stock?.model_code ?? "—"}</td>
                          <td className="hidden px-2 py-2.5 text-slate-700 2xl:table-cell">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`h-2.5 w-2.5 rounded-full ${dotColor(stock?.color_name)}`} />
                              {stock?.color_name ?? "—"}
                            </span>
                          </td>
                          <td className="max-w-[170px] px-2 py-2.5 font-medium text-slate-700">
                            <span className="block truncate">{stock?.sku ?? "—"}</span>
                          </td>
                          <td className="px-2 py-2.5 font-semibold text-ink">
                            {formatStockQuantity(Number(movement.quantity_m2 ?? movement.quantity ?? 0))} {unitLabel(stock?.unit)}
                          </td>
                          <td className="hidden px-2 py-2.5 text-slate-700 lg:table-cell">{formatSom(Number(movement.total_amount ?? 0))}</td>
                          <td className="hidden px-2 py-2.5 text-xs text-slate-700 2xl:table-cell">
                            {source || destination
                              ? [source ? `От: ${source}` : null, destination ? `Кому: ${destination}` : null].filter(Boolean).join(" · ")
                              : "—"}
                            {movement.supplier_name ? <div className="mt-1 text-[11px] text-slate-500">Поставщик: {movement.supplier_name}</div> : null}
                          </td>
                          <td className="hidden px-2 py-2.5 text-xs text-slate-700 2xl:table-cell">{movement.comment ?? "—"}</td>
                          <td className="hidden px-2 py-2.5 text-xs text-slate-700 xl:table-cell">{creatorName ?? "admin"}</td>
                        </tr>
                      );
                    })
                  : null}
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
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Назад
            </Button>
            <span className="text-xs text-muted">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Вперед
            </Button>
            <select
              className="h-8 rounded-lg border border-border bg-white px-2 text-xs"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
