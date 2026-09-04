"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Filter, Grid2X2, History, PencilRuler, Plus, RefreshCw, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCollections } from "@/features/catalog/hooks/use-catalog-queries";
import { useStockItemByCode, useStockItems, useStockMutations } from "@/features/inventory/hooks/use-stock-queries";
import { StockTable } from "@/features/inventory/components/stock-table";
import { StockHistoryDialog } from "@/features/inventory/components/stock-history-dialog";
import { StockMovementDrawer } from "@/features/inventory/components/stock-movement-drawer";
import { ItemActionSheet } from "@/features/inventory/components/item-action-sheet";
import { ExportDialog } from "@/features/exports/components/export-dialog";
import { formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToaster } from "@/components/ui/toaster";
import { MovementType } from "@/types/domain";
import { countWithWord } from "@/lib/format";

export function InventoryPage() {
  const router = useRouter();
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
  const [exportOpen, setExportOpen] = useState(false);
  const [sheetItemId, setSheetItemId] = useState<string>();
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

  const scannedCode = searchParams.get("item") ?? "";
  const { data: scannedResult, isLoading: scannedLoading } = useStockItemByCode(scannedCode || undefined);
  const scannedItem = scannedResult?.item ?? null;

  useEffect(() => {
    const collection = searchParams.get("collectionId") ?? "";
    const model = searchParams.get("modelId") ?? "";
    if (collection) setCollectionId(collection);
    if (model) setModelId(model);
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

  const selectedItem = [...items, ...(scannedItem ? [scannedItem] : [])].find((item) => item.id === selectedItemId);
  const selectedCollection = collections.find((collection) => collection.id === collectionId);
  const selectedModels = selectedCollection?.collection_models ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="crm-title">Склад</h1>
          <p className="crm-section-subtitle">
            {countWithWord(summary.totalItems, ["позиция", "позиции", "позиций"])} · остаток {formatStockQuantity(summary.totalQuantity)}
            <span className="hidden sm:inline"> · на {formatSom(summary.totalAmount)}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            className="gap-1.5 rounded-2xl px-4"
            onClick={() => {
              setActiveMovementType("incoming");
              setDrawerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Приход
          </Button>

          {/* Все прежние действия панели живут здесь — ничего не удалено. */}
          <ActionMenu
            size="md"
            ariaLabel="Действия склада"
            items={[
              { label: "Каталог", icon: <Grid2X2 className="h-4 w-4" />, onSelect: () => router.push("/catalog") },
              {
                label: "Расход",
                icon: <Truck className="h-4 w-4" />,
                onSelect: () => {
                  setSelectedItemId(undefined);
                  setActiveMovementType("outgoing");
                  setDrawerOpen(true);
                },
              },
              {
                label: "Перемещение",
                icon: <RefreshCw className="h-4 w-4" />,
                onSelect: () => {
                  setSelectedItemId(undefined);
                  setActiveMovementType("transfer");
                  setDrawerOpen(true);
                },
              },
              {
                label: "Корректировка",
                icon: <PencilRuler className="h-4 w-4" />,
                onSelect: () => {
                  setSelectedItemId(undefined);
                  setActiveMovementType("adjustment");
                  setDrawerOpen(true);
                },
              },
              {
                label: "История движений",
                icon: <History className="h-4 w-4" />,
                onSelect: () => {
                  setSelectedItemId(undefined);
                  setHistoryOpen(true);
                },
              },
              { label: "Выгрузка в Excel", icon: <FileSpreadsheet className="h-4 w-4" />, onSelect: () => setExportOpen(true) },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="crm-search"
            placeholder="Поиск: материал, модель, цвет..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button
          variant="outline"
          className="h-12 shrink-0 gap-1.5 rounded-2xl px-4"
          onClick={() => setShowFilters((value) => !value)}
        >
          <Filter className="h-4 w-4" />
          Фильтр
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Низкий остаток</p>
          <p className="mt-1 text-2xl font-bold leading-none text-rose-600">{summary.lowStockItems}</p>
          <p className="mt-1 text-xs text-muted">товаров</p>
        </div>
        <div className="crm-row">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Всего позиций</p>
          <p className="mt-1 text-2xl font-bold leading-none text-ink">{summary.totalItems}</p>
          <p className="mt-1 text-xs text-muted">на складе</p>
        </div>
      </div>

      <Card className={showFilters ? "" : "hidden"}>
        <CardContent className="p-3 sm:p-4">
          {showFilters ? (
            <div className="grid gap-2 sm:grid-cols-2">
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

      {scannedCode ? (
        <div className="space-y-2.5 rounded-2xl border-2 border-emerald-600/40 bg-emerald-50/50 p-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[13px] font-semibold text-emerald-800">Найдено сканером</p>
            <Link href="/stocks" className="text-[13px] font-medium text-emerald-800 underline">
              Весь склад
            </Link>
          </div>

          {scannedLoading ? (
            <p className="px-1 pb-1 text-sm text-muted">Загрузка позиции...</p>
          ) : scannedItem ? (
            <StockTable items={[scannedItem]} onOpenItem={(item) => setSheetItemId(item.id)} />
          ) : (
            <p className="px-1 pb-1 text-sm text-muted">Позиция по коду не найдена.</p>
          )}
        </div>
      ) : null}

      <StockTable
        items={items}
        isLoading={isLoading}
        onOpenItem={(item) => setSheetItemId(item.id)}
      />

      {/* Шторка позиции: все движения и история — по тапу на карточку. */}
      <ItemActionSheet
        item={[...items, ...(scannedItem ? [scannedItem] : [])].find((row) => row.id === sheetItemId)}
        onClose={() => setSheetItemId(undefined)}
        onAction={(item, action) => {
          setSheetItemId(undefined);
          setSelectedItemId(item.id);
          if (action === "history") {
            setHistoryOpen(true);
            return;
          }
          setActiveMovementType(action);
          setDrawerOpen(true);
        }}
      />

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
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>

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
              description: error instanceof Error ? error.message : "Не удалось сохранить движение. Попробуйте снова.",
              duration: 3500,
              variant: "error",
            });
            throw error;
          }
        }}
      />

      <StockHistoryDialog
        open={historyOpen}
        onOpenChange={(open) => setHistoryOpen(open)}
        item={selectedItem}
      />

      <ExportDialog defaultSection="stocks" open={exportOpen} onOpenChange={setExportOpen} />
    </section>
  );
}
