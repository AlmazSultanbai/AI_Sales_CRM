"use client";

import { useMemo, useState } from "react";
import { Download, Filter, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { useDebounce } from "@/hooks/use-debounce";
import { useStockMovements } from "@/features/inventory/hooks/use-stock-queries";
import { formatSom, formatStockQuantity, movementTypeLabel } from "@/features/inventory/lib/stock-utils";
import { unitLabel } from "@/lib/units";
import { countWithWord } from "@/lib/format";

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
  const [showFilters, setShowFilters] = useState(false);

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="crm-title">Движения</h1>
          <p className="crm-section-subtitle">
            {countWithWord(summary.total, ["операция", "операции", "операций"])} · приход {summary.incoming} · расход {summary.outgoing}
          </p>
        </div>
        <a href={exportLink} className="shrink-0">
          <Button variant="outline" className="gap-1.5 rounded-2xl px-4">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </a>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          className="crm-search"
          placeholder="Поиск: товар, модель..."
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="crm-chips">
        {(
          [
            { value: "all", label: "Все типы" },
            { value: "incoming", label: "Приход" },
            { value: "outgoing", label: "Расход" },
            { value: "transfer", label: "Перемещение" },
            { value: "adjustment", label: "Корректировка" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setMovementType(option.value);
              setPage(1);
            }}
            className={
              movementType === option.value
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
              <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Дата до</p>
              <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
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

          <div className="grid gap-2 sm:grid-cols-2">
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
                className="min-w-[120px] flex-1 sm:flex-none"
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
              <Button className="min-w-[120px] flex-1 gap-2 sm:flex-none">
                <Filter className="h-4 w-4" />
                Применить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Приход</p>
          <p className="mt-1 text-2xl font-bold leading-none text-emerald-700">{summary.incoming}</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Расход</p>
          <p className="mt-1 text-2xl font-bold leading-none text-rose-600">{summary.outgoing}</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Перемещение</p>
          <p className="mt-1 text-2xl font-bold leading-none text-blue-700">{summary.transfer}</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Корректировка</p>
          <p className="mt-1 text-2xl font-bold leading-none text-amber-600">{summary.adjustment}</p>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-5 text-sm text-rose-600">{error.message}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted">Загрузка движений...</CardContent>
        </Card>
      ) : !items.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted">Движения не найдены по текущим фильтрам.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((movement) => {
            const stock = movement.stock_items as
              | {
                  material_name?: string | null;
                  model_code?: string | null;
                  color_name?: string | null;
                  photo_url?: string | null;
                  unit?: "m2" | "meter" | "piece" | "pack" | null;
                }
              | null
              | undefined;
            const source = (movement as { source_name?: string | null }).source_name;
            const destination = (movement as { destination_name?: string | null }).destination_name;
            const creatorName = (movement as { creator_name?: string | null }).creator_name;
            const created = new Date(movement.created_at);
            const route = [source ? `От: ${source}` : null, destination ? `Кому: ${destination}` : null]
              .filter(Boolean)
              .join(" · ");
            // В базе расход хранится с минусом. Показываем модуль количества,
            // а направление даём знаком и цветом — так читается однозначно.
            const rawQuantity = Number(movement.quantity_m2 ?? movement.quantity ?? 0);
            const isOutgoing = movement.movement_type === "outgoing" || movement.movement_type === "writeoff";
            const isIncoming = movement.movement_type === "incoming";
            const quantitySign = isOutgoing || rawQuantity < 0 ? "−" : isIncoming ? "+" : "";
            const quantityClass = isOutgoing || rawQuantity < 0 ? "text-rose-600" : isIncoming ? "text-emerald-700" : "text-ink";

            return (
              <div key={movement.id} className="crm-row crm-row-link">
                <div className="flex items-start gap-3">
                  <ProductThumb
                    src={stock?.photo_url ?? null}
                    alt={stock?.material_name ?? "Товар"}
                    className="h-12 w-12 shrink-0 rounded-xl"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="crm-row-title truncate">{stock?.material_name ?? "Товар"}</p>
                        <p className="crm-row-sub truncate">
                          {[stock?.model_code, stock?.color_name].filter(Boolean).join(" · ") || "Без характеристик"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className={`crm-row-amount ${quantityClass}`}>
                          {quantitySign}
                          {formatStockQuantity(Math.abs(rawQuantity))} {unitLabel(stock?.unit)}
                        </p>
                        <p className="crm-row-amount-sub">{formatSom(Number(movement.total_amount ?? 0))}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ${movementBadge(movement.movement_type)}`}>
                        {movementTypeLabel(movement.movement_type)}
                      </Badge>
                      <span className="crm-pill crm-pill-soft">
                        {created.toLocaleDateString("ru-RU")},{" "}
                        {created.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {stock?.color_name ? (
                        <span className="crm-pill crm-pill-soft">
                          <span className={`h-2.5 w-2.5 rounded-full ${dotColor(stock.color_name)}`} />
                          {stock.color_name}
                        </span>
                      ) : null}
                    </div>

                    {route || movement.supplier_name || movement.comment ? (
                      <p className="mt-2 truncate text-[13px] text-muted">
                        {[route, movement.supplier_name ? `Поставщик: ${movement.supplier_name}` : null, movement.comment]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}

                    <p className="mt-1 text-[12px] text-slate-400">{creatorName ?? "admin"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
      </div>
    </section>
  );
}
