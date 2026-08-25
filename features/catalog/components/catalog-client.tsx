"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CatalogType } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogTypeLabels, catalogTypeOptions } from "@/features/catalog/lib/labels";
import { useDebounce } from "@/hooks/use-debounce";
import { useCatalogMutations, useCollections } from "@/features/catalog/hooks/use-catalog-queries";
import { CatalogStats } from "@/features/catalog/components/catalog-stats";
import { CollectionCard } from "@/features/catalog/components/collection-card";
import { CollectionDialog } from "@/features/catalog/components/collection-dialog";
import { CreateCollectionInput, CreateModelInput, UpdateCollectionInput, UpdateModelInput } from "@/features/catalog/lib/schemas";
import { useToaster } from "@/components/ui/toaster";
import { countWithWord } from "@/lib/format";

export function CatalogClient() {
  const { toast } = useToaster();
  const [searchValue, setSearchValue] = useState("");
  const [activeType, setActiveType] = useState<"all" | CatalogType>("material");
  const search = useDebounce(searchValue, 300);

  const { data = [], isLoading, error } = useCollections(search, activeType);
  const {
    refreshCollections,
    createCollectionMutation,
    updateCollectionMutation,
    deleteCollectionMutation,
    addModelMutation,
    updateModelMutation,
    deleteModelMutation,
  } = useCatalogMutations(search, activeType);

  const isMutating = useMemo(
    () =>
      createCollectionMutation.isPending ||
      updateCollectionMutation.isPending ||
      deleteCollectionMutation.isPending ||
      addModelMutation.isPending ||
      updateModelMutation.isPending ||
      deleteModelMutation.isPending,
    [
      createCollectionMutation.isPending,
      updateCollectionMutation.isPending,
      deleteCollectionMutation.isPending,
      addModelMutation.isPending,
      updateModelMutation.isPending,
      deleteModelMutation.isPending,
    ]
  );

  const handleCreate = async (payload: CreateCollectionInput) => {
    try {
      await createCollectionMutation.mutateAsync(payload);
      toast({
        title: "Успешно сохранено",
        description: "Коллекция успешно создана",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось создать коллекцию",
        variant: "error",
        duration: 4000,
      });
      throw error;
    }
  };

  const handleUpdate = async (id: string, payload: UpdateCollectionInput) => {
    try {
      await updateCollectionMutation.mutateAsync({ id, payload });
      toast({
        title: "Успешно сохранено",
        description: "Коллекция успешно обновлена",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось обновить коллекцию",
        variant: "error",
        duration: 4000,
      });
      throw error;
    }
  };

  const handleDelete = async (id: string, password: string) => {
    try {
      await deleteCollectionMutation.mutateAsync({ id, password });
      toast({
        title: "Успешно сохранено",
        description: "Коллекция удалена",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Ошибка удаления",
        description: error instanceof Error ? error.message : "Не удалось удалить коллекцию",
        variant: "error",
        duration: 4000,
      });
      throw error;
    }
  };

  const handleAddModel = async (collectionId: string, payload: CreateModelInput) => {
    try {
      await addModelMutation.mutateAsync({ collectionId, payload });
      toast({
        title: "Успешно сохранено",
        description: "Модель успешно добавлена",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось добавить модель",
        variant: "error",
        duration: 4000,
      });
      throw error;
    }
  };

  const handleUpdateModel = async (modelId: string, payload: UpdateModelInput) => {
    await updateModelMutation.mutateAsync({ modelId, payload });
  };

  const handleDeleteModel = async (modelId: string, password: string) => {
    try {
      await deleteModelMutation.mutateAsync({ modelId, password });
      toast({
        title: "Успешно удалено",
        description: "Модель удалена",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Ошибка удаления",
        description: error instanceof Error ? error.message : "Не удалось удалить модель",
        variant: "error",
        duration: 4000,
      });
      throw error;
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="crm-title">Каталог</h1>
          <p className="crm-section-subtitle">Всего: {countWithWord(data.length, ["коллекция", "коллекции", "коллекций"])}</p>
        </div>

        <CollectionDialog
          mode="create"
          onCreate={handleCreate}
          trigger={
            <Button className="shrink-0 gap-1.5 rounded-2xl px-4">
              <Plus className="h-4 w-4" />
              Коллекция
            </Button>
          }
          disabled={isMutating}
        />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          className="crm-search"
          placeholder="Поиск: коллекция, модель..."
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </div>

      <Tabs value={activeType} onValueChange={(value) => setActiveType(value as "all" | CatalogType)}>
        <div className="crm-chips w-full">
          <TabsList className="min-w-max rounded-2xl">
            {catalogTypeOptions.map((type) => (
              <TabsTrigger value={type} key={type} className="rounded-xl px-4 py-2 text-[13px]">
                {catalogTypeLabels[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <CatalogStats collections={data} />

      {error ? (
        <Card>
          <CardContent className="p-8 text-center text-rose-600">{error.message}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted">Загрузка каталога...</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onDelete={handleDelete}
                onDeleteModel={handleDeleteModel}
                onAddModel={handleAddModel}
                onUpdateModel={handleUpdateModel}
                onUpdate={handleUpdate}
                onMediaChanged={refreshCollections}
                disabled={isMutating}
              />
            ))}

          </div>

          {!data.length ? (
            <Card>
              <CardContent className="p-10 text-center text-muted">
                Коллекции не найдены. Добавьте первую коллекцию.
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
}
