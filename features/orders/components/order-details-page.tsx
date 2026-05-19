"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Plus, Save, Trash2, X, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToaster } from "@/components/ui/toaster";
import { useCollections } from "@/features/catalog/hooks/use-catalog-queries";
import { useOrder, useOrderMutations, useOrders, useOrderStockOptions } from "@/features/orders/hooks/use-orders-queries";
import { OrderFeedTable } from "@/features/orders/components/order-feed-table";
import { OrderPreviewDialog } from "@/features/orders/components/order-preview-dialog";
import { useStores } from "@/features/stores/hooks/use-stores-queries";
import { formatCurrency, formatOrderNumber } from "@/features/orders/lib/view-utils";
import { ItemUnit, unitLabel } from "@/lib/units";
import { CatalogType, OrderStatus } from "@/types/domain";

type MaterialRow = {
  id?: string;
  stock_item_id: string | null;
  collection_id: string | null;
  collection_model_id: string | null;
  material_name_snapshot: string;
  model_snapshot: string | null;
  color_snapshot: string | null;
  sku_snapshot: string | null;
  unit: ItemUnit;
  quantity_m2: number;
  sale_price_per_m2: number;
  cost_price_per_m2: number;
};

type AddressBlock = {
  id: string;
  title: string;
  address: string;
  phone: string;
  installation: boolean;
  advance_enabled: boolean;
  advance_amount: number;
  items: MaterialRow[];
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeMaterial(): MaterialRow {
  return {
    stock_item_id: null,
    collection_id: null,
    collection_model_id: null,
    material_name_snapshot: "",
    model_snapshot: null,
    color_snapshot: null,
    sku_snapshot: null,
    unit: "m2",
    quantity_m2: 0,
    sale_price_per_m2: 0,
    cost_price_per_m2: 0,
  };
}

function makeAddress(index: number): AddressBlock {
  return {
    id: `new-${Date.now()}-${index}`,
    title: `Заказ №${index + 1}`,
    address: "",
    phone: "",
    installation: false,
    advance_enabled: false,
    advance_amount: 0,
    items: [makeMaterial()],
  };
}

export function OrderDetailsPage({ orderId }: { orderId: string }) {
  const isCreateMode = orderId === "new";
  const searchParams = useSearchParams();
  const { toast } = useToaster();
  const { data: order, isLoading } = useOrder(isCreateMode ? undefined : orderId);
  const { data: stockOptions = [] } = useOrderStockOptions();
  const { data: collections = [] } = useCollections("", "all");
  const { data: stores = [] } = useStores("", "all", "name");
  const { createOrderMutation, updateOrderMutation, statusOrderMutation } = useOrderMutations();

  const [orderDate, setOrderDate] = useState(todayISO());
  const [clientName, setClientName] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<OrderStatus>("draft");
  const [installationAmount, setInstallationAmount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number | "">("");
  const [workshopTotal, setWorkshopTotal] = useState<number | "">("");
  const [blocks, setBlocks] = useState<AddressBlock[]>([makeAddress(0)]);
  const [prefilledFromStore, setPrefilledFromStore] = useState(false);
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] = useState<string | null>(null);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const { data: previousOrdersData, isLoading: previousOrdersLoading } = useOrders({
    page: 1,
    page_size: 40,
    status: "all",
    date_to: orderDate || undefined,
  });

  useEffect(() => {
    if (!order) return;
    const restoredBlocks: AddressBlock[] = [
      {
        id: `order-${order.id}-0`,
        title: "Заказ №1",
        address: order.address ?? "",
        phone: order.phone ?? "",
        installation: Number(order.installation_amount ?? 0) > 0,
        advance_enabled: false,
        advance_amount: 0,
        items: (order.order_items ?? []).length
          ? (order.order_items ?? []).map((item) => ({
              id: item.id,
              stock_item_id: item.stock_item_id,
              collection_id: item.collection_id,
              collection_model_id: item.collection_model_id,
              material_name_snapshot: item.material_name_snapshot,
              model_snapshot: item.model_snapshot ?? null,
              color_snapshot: item.color_snapshot ?? null,
              sku_snapshot: item.sku_snapshot ?? null,
              unit: item.unit,
              quantity_m2: toNumber(item.quantity_m2),
              sale_price_per_m2: toNumber(item.sale_price_per_m2),
              cost_price_per_m2: toNumber(item.cost_price_per_m2),
            }))
          : [makeMaterial()],
      },
    ];

    setOrderDate(order.order_date);
    setClientName(order.client_name ?? "");
    const matchedStore = stores.find((store) => store.name === (order.client_name ?? ""));
    setSelectedStoreId(matchedStore?.id ?? "");
    setComment(order.comment ?? "");
    setStatus(order.status);
    setInstallationAmount(toNumber(order.installation_amount));
    setTotalAmount(toNumber(order.total_amount));
    setWorkshopTotal(toNumber(order.workshop_total));
    setBlocks(restoredBlocks);
  }, [order, stores]);

  useEffect(() => {
    if (!isCreateMode || prefilledFromStore) return;
    const storeIdFromQuery = searchParams.get("storeId");
    if (!storeIdFromQuery || !stores.length) return;

    const matchedStore = stores.find((store) => store.id === storeIdFromQuery);
    if (!matchedStore) return;

    setSelectedStoreId(matchedStore.id);
    setClientName((prev) => prev || matchedStore.name);
    setPrefilledFromStore(true);
  }, [isCreateMode, prefilledFromStore, searchParams, stores]);

  const flatItems = useMemo(() => blocks.flatMap((block) => block.items), [blocks]);
  const installationBlocks = useMemo(() => blocks.filter((block) => block.installation).length, [blocks]);
  const installationPerAddress = installationBlocks > 0 ? installationAmount / installationBlocks : 0;
  const orderMaterialsTotal = useMemo(
    () => flatItems.reduce((acc, item) => acc + item.quantity_m2 * item.sale_price_per_m2, 0),
    [flatItems]
  );
  const orderAdvanceTotal = useMemo(
    () => blocks.reduce((acc, block) => acc + (block.advance_enabled ? block.advance_amount : 0), 0),
    [blocks]
  );
  const orderNetTotal = useMemo(
    () => Math.max(orderMaterialsTotal + installationAmount, 0),
    [orderMaterialsTotal, installationAmount]
  );

  const previousOrders = useMemo(() => {
    const currentId = isCreateMode ? null : orderId;
    return (previousOrdersData?.items ?? [])
      .filter((item) => (currentId ? item.id !== currentId : true))
      .filter((item) => {
        if (!selectedStoreId) return true;
        const selectedStore = stores.find((store) => store.id === selectedStoreId);
        if (!selectedStore?.name) return true;
        return (item.client_name ?? "").trim().toLowerCase() === selectedStore.name.trim().toLowerCase();
      });
  }, [isCreateMode, orderId, previousOrdersData?.items, selectedStoreId, stores]);

  const collectionOptionsByType = useMemo(() => {
    const toOptions = (type: CatalogType) =>
      collections
        .filter((collection) => collection.type === type)
        .map((collection) => ({
          key: collection.id,
          label: collection.name,
          collection,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return {
      material: toOptions("material"),
      profile: toOptions("profile"),
      cap: toOptions("cap"),
      fixator: toOptions("fixator"),
    } as const;
  }, [collections]);

  const otherTypeOptions = useMemo(
    () => [
      { type: "profile" as CatalogType, label: "Профиль" },
      { type: "cap" as CatalogType, label: "Заглушка" },
      { type: "fixator" as CatalogType, label: "Фиксатор" },
    ],
    []
  );

  const collectionsById = useMemo(() => {
    return new Map(collections.map((collection) => [collection.id, collection]));
  }, [collections]);

  const canEdit = isCreateMode || status === "draft" || status === "cancelled";

  function patchBlock(index: number, patch: Partial<AddressBlock>) {
    setBlocks((prev) => prev.map((block, idx) => (idx === index ? { ...block, ...patch } : block)));
  }

  function patchMaterial(blockIndex: number, itemIndex: number, patch: Partial<MaterialRow>) {
    setBlocks((prev) =>
      prev.map((block, idx) => {
        if (idx !== blockIndex) return block;
        return {
          ...block,
          items: block.items.map((item, itemIdx) => (itemIdx === itemIndex ? { ...item, ...patch } : item)),
        };
      })
    );
  }

  function addAddress() {
    setBlocks((prev) => [...prev, makeAddress(prev.length)]);
  }

  function removeAddress(index: number) {
    setBlocks((prev) =>
      prev.length <= 1
        ? prev
        : prev.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, title: `Заказ №${idx + 1}` }))
    );
  }

  function addMaterial(blockIndex: number) {
    setBlocks((prev) =>
      prev.map((block, idx) => (idx === blockIndex ? { ...block, items: [...block.items, makeMaterial()] } : block))
    );
  }

  function detectItemType(item: MaterialRow): CatalogType {
    if (item.collection_id) {
      const collection = collectionsById.get(item.collection_id);
      if (collection) return collection.type;
    }
    return "material";
  }

  function makeMaterialFromCollectionType(type: CatalogType): MaterialRow | null {
    const collection = collections.find((item) => item.type === type);
    if (!collection) return null;
    const model = (collection.collection_models ?? [])
      .filter((item) => item.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

    const stock = stockOptions.find(
      (stockItem) =>
        stockItem.collection_model_id === model?.id ||
        (model?.sku && stockItem.sku === model.sku) ||
        (stockItem.collection_id === collection.id &&
          stockItem.model_code === model?.model_code &&
          stockItem.color_name === model?.color_name)
    );

    return {
      stock_item_id: stock?.id ?? null,
      collection_id: collection.id,
      collection_model_id: model?.id ?? null,
      material_name_snapshot: collection.name,
      model_snapshot: model?.model_code ?? null,
      color_snapshot: model?.color_name ?? null,
      sku_snapshot: stock?.sku ?? model?.sku ?? null,
      unit: stock?.unit ?? "m2",
      quantity_m2: 0,
      sale_price_per_m2: toNumber(model?.price_per_m2 ?? collection.price_per_m2 ?? 0),
      cost_price_per_m2: toNumber(stock?.purchase_price_per_m2 ?? model?.price_per_m2 ?? collection.price_per_m2 ?? 0),
    };
  }

  function addOtherByType(blockIndex: number, type: CatalogType) {
    const nextItem = makeMaterialFromCollectionType(type);
    if (!nextItem) {
      toast({
        title: "Нет коллекций",
        description: "Для выбранного типа пока нет коллекций в каталоге",
        variant: "error",
      });
      return;
    }

    setBlocks((prev) =>
      prev.map((block, idx) => (idx === blockIndex ? { ...block, items: [...block.items, nextItem] } : block))
    );
  }

  function removeMaterial(blockIndex: number, itemIndex: number) {
    setBlocks((prev) =>
      prev.map((block, idx) => {
        if (idx !== blockIndex) return block;
        if (block.items.length <= 1) return block;
        return { ...block, items: block.items.filter((_, i) => i !== itemIndex) };
      })
    );
  }

  async function saveOrder() {
    const primaryAddress = blocks[0]?.address?.trim() ?? "";
    const trimmedClient = clientName.trim();

    if (!orderDate) {
      toast({ title: "Ошибка валидации", description: "Укажите дату заказа", variant: "error" });
      return;
    }

    if (!trimmedClient) {
      toast({ title: "Ошибка валидации", description: "Укажите клиента", variant: "error" });
      return;
    }

    if (!primaryAddress) {
      toast({ title: "Ошибка валидации", description: "Укажите адрес", variant: "error" });
      return;
    }

    const payloadItems = flatItems.filter((item) => item.material_name_snapshot.trim() && item.quantity_m2 > 0);
    if (!payloadItems.length) {
      toast({ title: "Ошибка валидации", description: "Добавьте хотя бы один материал", variant: "error" });
      return;
    }

    const extraAddresses = blocks.slice(1).filter((block) => block.address.trim());
    const advances = blocks
      .filter((block) => block.advance_enabled && block.advance_amount > 0)
      .map((block, index) => `Заказ №${index + 1}: ${block.advance_amount}`)
      .join("; ");

    const composedComment = [
      comment,
      extraAddresses.length ? `Доп. адреса: ${extraAddresses.map((b) => `${b.address} (${b.phone || "-"})`).join("; ")}` : "",
      advances ? `Предоплата: ${advances}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      order_date: orderDate,
      address: primaryAddress,
      client_name: trimmedClient,
      phone: blocks[0]?.phone || null,
      total_amount: totalAmount === "" ? orderNetTotal : toNumber(totalAmount),
      installation_amount: toNumber(installationAmount),
      workshop_total: workshopTotal === "" ? null : toNumber(workshopTotal),
      comment: composedComment || null,
      status,
      items: payloadItems.map((item) => ({
        ...item,
        quantity_m2: toNumber(item.quantity_m2),
        sale_price_per_m2: toNumber(item.sale_price_per_m2),
        cost_price_per_m2: toNumber(item.cost_price_per_m2),
      })),
    };

    const isConfirmed = window.confirm(
      isCreateMode ? "Подтвердите сохранение нового заказа" : "Подтвердите сохранение изменений по заказу"
    );
    if (!isConfirmed) return;

    try {
      if (isCreateMode) {
        await createOrderMutation.mutateAsync(payload);
        toast({ title: "Заказ успешно создан", description: "Изменения сохранены", variant: "success" });
        setClientName("");
        setSelectedStoreId("");
        setComment("");
        setStatus("draft");
        setInstallationAmount(0);
        setTotalAmount("");
        setWorkshopTotal("");
        setBlocks([makeAddress(0)]);
      } else {
        await updateOrderMutation.mutateAsync({ orderId, payload });
        toast({ title: "Изменения сохранены", description: "Заказ успешно обновлен", variant: "success" });
      }
    } catch (requestError) {
      toast({
        title: "Ошибка сохранения",
        description: requestError instanceof Error ? requestError.message : "Не удалось сохранить заказ",
        variant: "error",
      });
    }
  }

  async function setOrderStatus(nextStatus: OrderStatus) {
    if (isCreateMode) {
      setStatus(nextStatus);
      return;
    }
    try {
      await statusOrderMutation.mutateAsync({ orderId, status: nextStatus });
      setStatus(nextStatus);
      toast({
        title: "Успешно сохранено",
        description:
          nextStatus === "cancelled"
            ? "Заказ отменен, остатки возвращены"
            : nextStatus === "confirmed"
              ? "Заказ подтвержден, материалы списаны"
              : "Статус заказа обновлен",
        variant: "success",
      });
    } catch (requestError) {
      toast({
        title: "Ошибка статуса",
        description: requestError instanceof Error ? requestError.message : "Не удалось изменить статус",
        variant: "error",
      });
    }
  }

  function exportOrdersByPeriod() {
    if (!exportDateFrom || !exportDateTo) {
      toast({
        title: "Ошибка выгрузки",
        description: "Выберите период: дата от и дата до",
        variant: "error",
      });
      return;
    }

    const params = new URLSearchParams({
      section: "orders",
      date_from: exportDateFrom,
      date_to: exportDateTo,
    });
    window.location.href = `/api/exports/excel?${params.toString()}`;
  }

  if (!isCreateMode && isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted">Загрузка заказа...</CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{isCreateMode ? "Новый заказ" : formatOrderNumber(order?.order_number)}</h1>
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((block, blockIndex) => {
          const blockMaterialTotal = block.items.reduce((acc, item) => acc + item.quantity_m2 * item.sale_price_per_m2, 0);
          const blockInstallationTotal = block.installation ? installationPerAddress : 0;
          const blockAdvanceTotal = block.advance_enabled ? block.advance_amount : 0;
          const blockTotal = blockMaterialTotal + blockInstallationTotal;
          return (
            <Card key={block.id} className="border border-border">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-semibold text-ink">{block.title}</h3>
                  <Button variant="outline" size="icon" onClick={() => removeAddress(blockIndex)} disabled={!canEdit || blocks.length === 1}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {blockIndex === 0 ? (
                  <div className="grid gap-3 border-b border-border pb-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs text-muted">Дата</p>
                      <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted">Магазин</p>
                      <select
                        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                        value={selectedStoreId}
                        onChange={(e) => {
                          const storeId = e.target.value;
                          const store = stores.find((item) => item.id === storeId);
                          setSelectedStoreId(storeId);
                          setClientName(store?.name ?? "");
                        }}
                      >
                        <option value="">Выберите магазин</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted">Статус</p>
                      <select
                        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as OrderStatus)}
                      >
                        <option value="draft">Черновик</option>
                        <option value="confirmed">Подтвержден</option>
                        <option value="completed">Выполнен</option>
                        <option value="cancelled">Отменен</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="Адрес клиента" value={block.address} onChange={(e) => patchBlock(blockIndex, { address: e.target.value })} />
                  <Input placeholder="Номер телефона" value={block.phone} onChange={(e) => patchBlock(blockIndex, { phone: e.target.value })} />
                </div>

                <div className="border-t border-border pt-3">
                  {block.items.map((item, itemIndex) => {
                    const selectedStock = stockOptions.find((stock) => stock.id === item.stock_item_id);
                    const itemType = detectItemType(item);
                    const rowMaterialOptions = collectionOptionsByType[itemType];
                    const materialKey = item.collection_id ?? "";
                    const selectedMaterial = rowMaterialOptions.find((option) => option.key === materialKey) ?? null;
                    const selectedCollection = selectedMaterial?.collection ?? (materialKey ? collectionsById.get(materialKey) ?? null : null);
                    const visibleMaterialOptions = selectedMaterial
                      ? rowMaterialOptions
                      : selectedCollection
                        ? [
                            ...rowMaterialOptions,
                            { key: selectedCollection.id, label: selectedCollection.name, collection: selectedCollection },
                          ]
                        : rowMaterialOptions;
                    const colorOptions = (selectedCollection?.collection_models ?? [])
                      .filter((model) => model.is_active !== false)
                      .slice()
                      .sort((a, b) => (a.color_name ?? "").localeCompare(b.color_name ?? ""));

                    return (
                      <div key={`${item.id ?? "new"}-${itemIndex}`} className="mb-2 grid gap-2 md:grid-cols-[2fr_1.8fr_0.8fr_auto]">
                        <select
                          className="h-10 rounded-xl border border-border bg-white px-3 text-sm"
                          value={materialKey}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const nextMaterialKey = e.target.value || "";
                            const material = rowMaterialOptions.find((option) => option.key === nextMaterialKey);
                            const collection = material?.collection;
                            const model = collection?.collection_models?.[0];
                            const stock = stockOptions.find(
                              (stockItem) =>
                                stockItem.collection_model_id === model?.id ||
                                (model?.sku && stockItem.sku === model.sku) ||
                                (stockItem.collection_id === collection?.id &&
                                  stockItem.model_code === model?.model_code &&
                                  stockItem.color_name === model?.color_name)
                            );
                            patchMaterial(blockIndex, itemIndex, {
                              stock_item_id: stock?.id ?? null,
                              collection_id: collection?.id ?? null,
                              collection_model_id: model?.id ?? null,
                              material_name_snapshot: collection?.name ?? "",
                              model_snapshot: model?.model_code ?? null,
                              color_snapshot: model?.color_name ?? null,
                              sku_snapshot: stock?.sku ?? model?.sku ?? null,
                              unit: stock?.unit ?? "m2",
                              sale_price_per_m2: toNumber(model?.price_per_m2 ?? collection?.price_per_m2 ?? 0),
                              cost_price_per_m2: toNumber(
                                stock?.purchase_price_per_m2 ?? model?.price_per_m2 ?? collection?.price_per_m2 ?? 0
                              ),
                            });
                          }}
                        >
                          <option value="">Материал</option>
                          {visibleMaterialOptions.map((material) => {
                            const selectedColorModelForThisCollection =
                              material.key === materialKey
                                ? colorOptions.find((model) => model.id === item.collection_model_id)
                                : null;
                            const displayPrice = toNumber(
                              selectedColorModelForThisCollection?.price_per_m2 ?? material.collection.price_per_m2 ?? 0
                            );

                            return (
                              <option key={material.key} value={material.key}>
                                {material.label} {displayPrice ? `— ${displayPrice} c/${unitLabel("m2")}` : ""}
                              </option>
                            );
                          })}
                        </select>

                        <select
                          className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-ink"
                          value={item.collection_model_id ?? ""}
                          disabled={!canEdit || !selectedCollection}
                          onChange={(e) => {
                            const modelId = e.target.value || null;
                            const model = colorOptions.find((x) => x.id === modelId);
                            if (!model) return;
                            const stock = stockOptions.find(
                              (stockItem) =>
                                stockItem.collection_model_id === model.id ||
                                (model.sku && stockItem.sku === model.sku) ||
                                (stockItem.collection_id === selectedCollection?.id &&
                                  stockItem.model_code === model.model_code &&
                                  stockItem.color_name === model.color_name)
                            );
                            patchMaterial(blockIndex, itemIndex, {
                              stock_item_id: stock?.id ?? null,
                              collection_id: selectedCollection?.id ?? null,
                              collection_model_id: model.id,
                              material_name_snapshot: selectedCollection?.name ?? "",
                              model_snapshot: model.model_code ?? null,
                              color_snapshot: model.color_name ?? null,
                              sku_snapshot: stock?.sku ?? model.sku ?? null,
                              unit: stock?.unit ?? "m2",
                              sale_price_per_m2: toNumber(model.price_per_m2 ?? selectedCollection?.price_per_m2 ?? 0),
                              cost_price_per_m2: toNumber(
                                stock?.purchase_price_per_m2 ?? model.price_per_m2 ?? selectedCollection?.price_per_m2 ?? 0
                              ),
                            });
                          }}
                        >
                          <option value="">{selectedCollection ? "Цвет" : "Сначала материал"}</option>
                          {colorOptions.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.model_code || "—"}
                            </option>
                          ))}
                        </select>

                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.quantity_m2 === 0 ? "" : item.quantity_m2}
                          disabled={!canEdit}
                          onChange={(e) => patchMaterial(blockIndex, itemIndex, { quantity_m2: toNumber(e.target.value) })}
                        />

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted">{unitLabel(item.unit || selectedStock?.unit || "m2")}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600"
                            onClick={() => removeMaterial(blockIndex, itemIndex)}
                            disabled={!canEdit || block.items.length === 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    variant="outline"
                    className="h-10 px-4"
                    onClick={() => addMaterial(blockIndex)}
                    disabled={!canEdit}
                  >
                    + материал
                  </Button>

                  <select
                    defaultValue=""
                    disabled={!canEdit}
                    className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-ink"
                    onChange={(e) => {
                      const nextType = e.target.value as CatalogType;
                      if (!nextType) return;
                      addOtherByType(blockIndex, nextType);
                      e.currentTarget.value = "";
                    }}
                  >
                    <option value="">+ другое</option>
                    {otherTypeOptions.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={block.installation}
                      disabled={!canEdit}
                      onChange={(e) => patchBlock(blockIndex, { installation: e.target.checked })}
                    />
                    Установка
                  </label>

                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-10 w-44"
                    placeholder="Сумма установки"
                    value={installationAmount === 0 ? "" : installationAmount}
                    disabled={!canEdit || !block.installation}
                    onChange={(e) => setInstallationAmount(toNumber(e.target.value))}
                  />

                  <label className="inline-flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={block.advance_enabled}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchBlock(blockIndex, {
                          advance_enabled: e.target.checked,
                          advance_amount: e.target.checked ? block.advance_amount : 0,
                        })
                      }
                    />
                    Предоплата
                  </label>

                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-10 w-44"
                    placeholder="Сумма предоплаты"
                    value={block.advance_amount === 0 ? "" : block.advance_amount}
                    disabled={!canEdit || !block.advance_enabled}
                    onChange={(e) =>
                      patchBlock(blockIndex, {
                        advance_amount: Number(e.target.value || 0),
                      })
                    }
                  />
                </div>

                <div className="border-t border-border pt-2 text-sm text-muted">
                  Материал: <b className="text-ink">{formatCurrency(blockMaterialTotal)}</b> · Установка:{" "}
                  <b className="text-ink">{formatCurrency(blockInstallationTotal)}</b> · Предоплата:{" "}
                  <b className="text-ink">{formatCurrency(blockAdvanceTotal)}</b> · Итого:{" "}
                  <b className="text-ink">{formatCurrency(blockTotal)}</b>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end justify-end gap-3">
        <div className="w-full max-w-[160px]">
          <p className="mb-1 text-xs text-muted">Дата от</p>
          <Input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} />
        </div>
        <div className="w-full max-w-[160px]">
          <p className="mb-1 text-xs text-muted">Дата до</p>
          <Input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} />
        </div>
        <Button
          variant="outline"
          className="gap-2 px-5"
          onClick={exportOrdersByPeriod}
        >
          <Download className="h-4 w-4" />
          Выгрузка в Excel
        </Button>
        <Button variant="outline" className="px-5" onClick={addAddress} disabled={!canEdit}>
          + Добавить заказ
        </Button>
        <Button className="gap-1" onClick={saveOrder}>
          <Save className="h-4 w-4" />
          Сохранить
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {previousOrdersLoading ? (
            <p className="py-6 text-center text-sm text-muted">Загрузка заказов...</p>
          ) : (
            <OrderFeedTable
              title="Все заказы"
              items={previousOrders}
              onOpen={(id) => setSelectedHistoryOrderId(id)}
            />
          )}
        </CardContent>
      </Card>

      {!isCreateMode ? (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4">
            <Button variant="outline" className="gap-1" onClick={() => setOrderStatus("confirmed")}>
              <CheckCircle2 className="h-4 w-4" />
              Подтвердить
            </Button>
            <Button variant="outline" className="gap-1 text-rose-600" onClick={() => setOrderStatus("cancelled")}>
              <XCircle className="h-4 w-4" />
              Отменить
            </Button>
            <Button variant="outline" onClick={() => setOrderStatus("completed")}>Выполнен</Button>
          </CardContent>
        </Card>
      ) : null}

      <OrderPreviewDialog orderId={selectedHistoryOrderId} open={Boolean(selectedHistoryOrderId)} onClose={() => setSelectedHistoryOrderId(null)} />
    </section>
  );
}
