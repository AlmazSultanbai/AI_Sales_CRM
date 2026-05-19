"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, History, PencilRuler, Plus, RefreshCw, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCollections } from "@/features/catalog/hooks/use-catalog-queries";
import { useStockItems, useStockMutations } from "@/features/inventory/hooks/use-stock-queries";
import { StockTable } from "@/features/inventory/components/stock-table";
import { StockHistoryDialog } from "@/features/inventory/components/stock-history-dialog";
import { StockMovementDrawer } from "@/features/inventory/components/stock-movement-drawer";
import { formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToaster } from "@/components/ui/toaster";
import { MovementType } from "@/types/domain";

export function InventoryPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [modelId, setModelId] = useState<string>("");
  const [colorFilter, setColorFilter] = useState("");
  const [inStockFilter, setInStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeMovementType, setActiveMovementType] = useState<MovementType>("incoming");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>();

  const { data: collections = [] } = useCollections("", "all");
  const { createMovementMutation } = useStockMutations();
  const { toast } = useToaster();

  const movementToastMap: Record<
    "incoming" | "outgoing" | "transfer" | "adjustment",
    { title: string; description: string }
  > = {
    incoming: {
      title: "Приход сохранен",
      description: "Движение добавлено, остаток на складе обновлен",
    },
    outgoing: {
      title: "Расход сохранен",
      description: "Остаток на складе обновлен",
    },
    transfer: {
      title: "Перемещение сохранено",
      description: "Движение успешно зафиксировано",
    },
    adjustment: {
      title: "Корректировка сохранена",
      description: "Остаток обновлен",
    },
  };

  useEffect(() => {
    const collection = searchParams.get("collectionId") ?? "";
    const model = searchParams.get("modelId") ?? "";
    const sku = searchParams.get("sku") ?? "";
    if (collection) setCollectionId(collection);
    if (model) setModelId(model);
    if (sku) setSearch(sku);
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      material: materialFilter || undefined,
      collection_id: collectionId || undefined,
      model_id: modelId || undefined,
      color: colorFilter || undefined,
      low_stock: lowStockOnly || undefined,
      in_stock: inStockFilter,
      page,
      page_size: pageSize,
    }),
    [search, materialFilter, collectionId, modelId, colorFilter, lowStockOnly, inStockFilter, page, pageSize]
  );

  const { data, isLoading, error } = useStockItems(filters);
  const items = data?.items ?? [];
  const summary = data?.summary ?? { totalItems: 0, totalQuantity: 0, totalAmount: 0, lowStockItems: 0 };
  const pagination = data?.pagination ?? { page: 1, pageSize, total: 0, totalPages: 1 };

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const selectedCollection = collections.find((collection) => collection.id === collectionId);
  const selectedModels = selectedCollection?.collection_models ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Склад</h1>
        <p className="mt-2 text-sm text-muted">Учет остатков и движение товаров на складе.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Всего товаров</p>
            <p className="text-3xl font-bold text-ink">{summary.totalItems}</p>
            <p className="text-xs text-muted">SKU</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Общее количество</p>
            <p className="text-3xl font-bold text-ink">{formatStockQuantity(summary.totalQuantity)}</p>
            <p className="text-xs text-muted">по всем единицам</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">На сумму</p>
            <p className="text-3xl font-bold text-ink">{formatSom(summary.totalAmount)}</p>
            <p className="text-xs text-muted">по закупочным ценам</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Низкий остаток</p>
            <p className="text-3xl font-bold text-rose-600">{summary.lowStockItems}</p>
            <p className="text-xs text-muted">товаров</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-1.5" onClick={() => { setActiveMovementType("incoming"); setDrawerOpen(true); }}>
                <Plus className="h-4 w-4" />
                Приход
              </Button>
              <Button variant="secondary" className="gap-1.5" onClick={() => { setActiveMovementType("outgoing"); setDrawerOpen(true); }}>
                <Truck className="h-4 w-4" />
                Расход
              </Button>
              <Button variant="secondary" className="gap-1.5" onClick={() => { setActiveMovementType("transfer"); setDrawerOpen(true); }}>
                <RefreshCw className="h-4 w-4" />
                Перемещение
              </Button>
              <Button variant="secondary" className="gap-1.5" onClick={() => { setActiveMovementType("adjustment"); setDrawerOpen(true); }}>
                <PencilRuler className="h-4 w-4" />
                Корректировка
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
                <History className="h-4 w-4" />
                История движений
              </Button>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                className="sm:w-64"
                placeholder="Поиск по складу..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <Button variant="outline" className="gap-1.5" onClick={() => setShowFilters((value) => !value)}>
                <Filter className="h-4 w-4" />
                Фильтр
              </Button>
            </div>
          </div>

          {showFilters ? (
            <div className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-6">
              <Input
                placeholder="Материал"
                value={materialFilter}
                onChange={(event) => {
                  setMaterialFilter(event.target.value);
                  setPage(1);
                }}
              />

              <select
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={collectionId}
                onChange={(event) => {
                  setCollectionId(event.target.value);
                  setModelId("");
                  setPage(1);
                }}
              >
                <option value="">Все коллекции</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>

              <select
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={modelId}
                onChange={(event) => {
                  setModelId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все модели</option>
                {selectedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model_code}
                  </option>
                ))}
              </select>

              <Input
                placeholder="Цвет"
                value={colorFilter}
                onChange={(event) => {
                  setColorFilter(event.target.value);
                  setPage(1);
                }}
              />

              <select
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={inStockFilter}
                onChange={(event) => {
                  setInStockFilter(event.target.value as "all" | "in_stock" | "out_of_stock");
                  setPage(1);
                }}
              >
                <option value="all">Все остатки</option>
                <option value="in_stock">В наличии</option>
                <option value="out_of_stock">Нет остатка</option>
              </select>

              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(event) => {
                    setLowStockOnly(event.target.checked);
                    setPage(1);
                  }}
                />
                Только низкий остаток
              </label>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">{error.message}</CardContent>
        </Card>
      ) : null}

      <StockTable
        items={items}
        isLoading={isLoading}
        onOpenHistory={(item) => {
          setSelectedItemId(item.id);
          setHistoryOpen(true);
        }}
        onOpenDetails={(item) => {
          setSelectedItemId(item.id);
          setActiveMovementType("incoming");
          setDrawerOpen(true);
        }}
      />

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
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={20}>20</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-100 bg-sky-50/40">
        <CardContent className="space-y-2 p-5">
          <p className="text-sm font-semibold text-sky-900">Важно</p>
          <p className="text-sm text-sky-800">
            Остатки на складе изменяются только через движения товара: приход, расход, перемещение, корректировка.
            Прямое редактирование остатков запрещено.
          </p>
        </CardContent>
      </Card>

      <StockMovementDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        collections={collections}
        selectedStockItem={selectedItem}
        movementType={activeMovementType}
        isPending={createMovementMutation.isPending}
        onSubmit={async (payload) => {
          try {
            await createMovementMutation.mutateAsync(payload);
            const toastContent = movementToastMap[payload.movement_type];
            toast({
              title: toastContent.title,
              description: toastContent.description,
              duration: 3000,
              variant: "success",
            });
            setDrawerOpen(false);
          } catch (error) {
            console.error(error);
            toast({
              title: "Ошибка сохранения",
              description: "Не удалось сохранить движение. Попробуйте снова.",
              duration: 3500,
              variant: "error",
            });
          }
        }}
      />

      <StockHistoryDialog
        open={historyOpen}
        onOpenChange={(open) => setHistoryOpen(open)}
        item={selectedItem}
      />
    </section>
  );
}
