"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { CollectionModel } from "@/types/domain";
import { normalizeUnitByCollectionType, unitLabel } from "@/lib/units";

export type ProductDetailsCardProps = {
  material: string;
  collectionType?: "material" | "profile" | "cap" | "fixator";
  variants: CollectionModel[];
  selectedVariantId?: string;
  onVariantChange?: (variant: CollectionModel) => void;
  onAddModelClick?: () => void;
  onEditPriceClick?: (variant: CollectionModel) => void;
  onGoToStock?: (variant: CollectionModel) => void;
  className?: string;
};

function formatSom(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatStockQuantity(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function sortVariants(variants: CollectionModel[]) {
  return [...variants].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.model_code.localeCompare(b.model_code, "ru");
  });
}

export function ProductDetailsCard({
  material,
  collectionType,
  variants,
  selectedVariantId,
  onVariantChange,
  onAddModelClick,
  onEditPriceClick,
  onGoToStock,
  className = "",
}: ProductDetailsCardProps) {
  const orderedVariants = useMemo(() => sortVariants(variants).filter((item) => item.is_active !== false), [variants]);
  const firstVariant = orderedVariants[0];
  const isControlled = selectedVariantId !== undefined;
  const [internalSelectedId, setInternalSelectedId] = useState(firstVariant?.id ?? "");
  const currentVariantId = isControlled ? selectedVariantId : internalSelectedId;

  const activeVariant = useMemo(
    () => orderedVariants.find((item) => item.id === currentVariantId) ?? firstVariant,
    [orderedVariants, currentVariantId, firstVariant]
  );
  const activeStockItems = activeVariant?.stock_items ?? [];
  const stockQuantity = activeStockItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const normalizedUnit = normalizeUnitByCollectionType(collectionType, activeStockItems[0]?.unit);
  const stockUnit = unitLabel(normalizedUnit);

  useEffect(() => {
    if (isControlled) return;
    if (!orderedVariants.length) return;
    const exists = orderedVariants.some((item) => item.id === internalSelectedId);
    if (!exists) {
      setInternalSelectedId(orderedVariants[0].id);
    }
  }, [orderedVariants, internalSelectedId, isControlled]);

  const handleVariantClick = (variant: CollectionModel) => {
    if (!isControlled) setInternalSelectedId(variant.id);
    onVariantChange?.(variant);
  };

  const handleAddModel = () => {
    if (onAddModelClick) {
      onAddModelClick();
    }
  };

  return (
    <article className={`w-full rounded-2xl border border-neutral-200 bg-white p-2.5 md:p-3 ${className}`}>
      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-neutral-100">
        {activeVariant?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeVariant.image_url}
            alt={`${material} ${activeVariant.model_code}`}
            className="h-[112px] w-full object-cover md:h-[128px]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-[112px] w-full items-center justify-center text-xs text-neutral-400 md:h-[128px]">
            Нет фото
          </div>
        )}
      </div>

      <div className="mt-2 divide-y divide-neutral-200">
        <div className="grid grid-cols-[52px_1fr] items-center gap-1.5 py-1">
          <span className="text-[10px] text-neutral-400">Материал:</span>
          <span className="text-xs font-semibold text-neutral-900 md:text-sm">{material}</span>
        </div>

        <div className="grid grid-cols-[52px_1fr] items-start gap-1.5 py-1">
          <span className="pt-0.5 text-[10px] text-neutral-400">Модель:</span>
          <div className="flex flex-wrap gap-1">
            {orderedVariants.map((variant) => {
              const isActive = activeVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => handleVariantClick(variant)}
                  className={[
                    "min-w-[25px] rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium leading-4 transition",
                    isActive
                      ? "bg-accent text-white"
                      : "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400",
                  ].join(" ")}
                >
                  {variant.model_code}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleAddModel}
              className="min-w-[25px] rounded-[6px] border border-dashed border-neutral-300 bg-white px-1.5 py-0.5 text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-700"
              aria-label="Добавить модель"
            >
              <Plus className="mx-auto h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[52px_1fr] items-center gap-1.5 py-1">
          <span className="text-[10px] text-neutral-400">Цвет:</span>
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full border border-neutral-200"
              style={{ backgroundColor: activeVariant?.color_hex ?? "#1E3A8A" }}
            />
            <span className="text-xs font-semibold text-neutral-900 md:text-sm">
              {activeVariant?.color_name ?? "Темно-синий"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[52px_1fr] items-center gap-1.5 py-1">
          <span className="text-[10px] text-neutral-400">Склад:</span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-900 md:text-sm">
              {formatStockQuantity(stockQuantity)} {stockUnit}
            </span>
            {activeVariant && onGoToStock ? (
              <button
                type="button"
                onClick={() => onGoToStock(activeVariant)}
                className="rounded-md border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                На склад
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-[52px_1fr] items-start gap-1.5 py-1">
          <span className="text-[10px] text-neutral-400">Примеч:</span>
          <p className="text-[10px] leading-4 text-neutral-500">
            Изменение остатков только через модуль Склад.
          </p>
        </div>

        <div className="grid grid-cols-[52px_1fr_auto] items-end gap-1.5 py-1">
          <span className="text-[10px] text-neutral-400">Цена:</span>
          <div className="text-neutral-900">
            <span className="text-base font-bold leading-none md:text-lg">
              {formatSom(Number(activeVariant?.price_per_m2 ?? 0))}
            </span>
            <span className="ml-1 text-[10px] font-medium leading-none md:text-xs">сом / {stockUnit}</span>
          </div>
          <button
            type="button"
            onClick={() => activeVariant && onEditPriceClick?.(activeVariant)}
            className="rounded-md p-0.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Редактировать"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
    </article>
  );
}
