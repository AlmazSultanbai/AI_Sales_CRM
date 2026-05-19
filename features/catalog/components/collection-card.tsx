"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Collection } from "@/types/domain";
import { CreateModelInput, UpdateCollectionInput, UpdateModelInput } from "@/features/catalog/lib/schemas";
import { ProductDetailsCard } from "@/features/catalog/components/product-details-card";
import { AddModelDialog } from "@/features/catalog/components/add-model-dialog";
import { EditModelDialog } from "@/features/catalog/components/edit-model-dialog";
import { CollectionDialog } from "@/features/catalog/components/collection-dialog";
import { Button } from "@/components/ui/button";

export function CollectionCard({
  collection,
  onDelete,
  onUpdate,
  onAddModel,
  onUpdateModel,
  onMediaChanged,
  disabled,
}: {
  collection: Collection;
  onDelete: (id: string, password: string) => Promise<void>;
  onAddModel: (collectionId: string, payload: CreateModelInput) => Promise<void>;
  onUpdateModel: (modelId: string, payload: UpdateModelInput) => Promise<void>;
  onUpdate: (id: string, payload: UpdateCollectionInput) => Promise<void>;
  onMediaChanged?: () => Promise<void>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(collection.collection_models[0]?.id);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const activeVariant = useMemo(
    () => collection.collection_models.find((item) => item.id === selectedVariantId) ?? collection.collection_models[0],
    [collection.collection_models, selectedVariantId]
  );

  return (
    <div className="space-y-2">
      <ProductDetailsCard
        material={collection.name}
        collectionType={collection.type}
        variants={collection.collection_models}
        selectedVariantId={selectedVariantId}
        onVariantChange={(variant) => setSelectedVariantId(variant.id)}
        onAddModelClick={() => setIsAddDialogOpen(true)}
        onEditPriceClick={() => setIsEditDialogOpen(true)}
        onGoToStock={(variant) => {
          const params = new URLSearchParams();
          params.set("collectionId", collection.id);
          params.set("modelId", variant.id);
          if (variant.sku) params.set("sku", variant.sku);
          router.push(`/stocks?${params.toString()}`);
        }}
      />

      <div className="flex items-center gap-2">
        <CollectionDialog
          mode="edit"
          initial={collection}
          onUpdate={onUpdate}
          onDelete={onDelete}
          disabled={disabled}
          trigger={
            <Button variant="outline" className="h-5 gap-1 rounded-md px-2 text-[10px]" disabled={disabled}>
              <Pencil className="h-2.5 w-2.5" />
              Коллекция
            </Button>
          }
        />

        <AddModelDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          hideTrigger
          onSubmit={async (payload) => {
            await onAddModel(collection.id, {
              ...payload,
              sort_order: payload.sort_order ?? collection.collection_models.length,
            });
          }}
        />

        {activeVariant ? (
          <EditModelDialog
            model={activeVariant}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            hideTrigger
            onSubmit={async (payload) => {
              await onUpdateModel(activeVariant.id, payload);
            }}
            onMediaChanged={onMediaChanged}
            trigger={<span />}
          />
        ) : null}
        {activeVariant ? (
          <Button
            variant="outline"
            className="h-5 gap-1 rounded-md px-2 text-[10px]"
            disabled={disabled}
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Pencil className="h-2.5 w-2.5" />
            Модель
          </Button>
        ) : null}
      </div>
    </div>
  );
}
