"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CatalogType } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogTypeLabels, catalogTypeOptions } from "@/features/catalog/lib/labels";
import { useDebounce } from "@/hooks/use-debounce";
import { useCatalogMutations, useCollections } from "@/features/catalog/hooks/use-catalog-queries";
import { CatalogStats } from "@/features/catalog/components/catalog-stats";
import { CollectionCard } from "@/features/catalog/components/collection-card";
import { CollectionDialog } from "@/features/catalog/components/collection-dialog";
import { CreateCollectionInput, CreateModelInput, UpdateCollectionInput, UpdateModelInput } from "@/features/catalog/lib/schemas";
import { useToaster } from "@/components/ui/toaster";

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
  } = useCatalogMutations(search, activeType);

  const isMutating = useMemo(
    () =>
      createCollectionMutation.isPending ||
      updateCollectionMutation.isPending ||
      deleteCollectionMutation.isPending ||
      addModelMutation.isPending ||
      updateModelMutation.isPending,
    [
      createCollectionMutation.isPending,
      updateCollectionMutation.isPending,
      deleteCollectionMutation.isPending,
      addModelMutation.isPending,
      updateModelMutation.isPending,
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Каталог</h1>
        <p className="mt-2 text-sm text-muted">Управление коллекциями, моделями и ценами</p>
      </div>

      <CatalogStats collections={data} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <Tabs value={activeType} onValueChange={(value) => setActiveType(value as "all" | CatalogType)}>
              <div className="w-full overflow-x-auto">
                <TabsList className="min-w-max">
                  {catalogTypeOptions.map((type) => (
                    <TabsTrigger value={type} key={type}>
                      {catalogTypeLabels[type]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>

            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
              <Input
                className="sm:w-64"
                placeholder="Поиск коллекции..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />

              <CollectionDialog
                mode="create"
                onCreate={handleCreate}
                trigger={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Коллекция
                  </Button>
                }
                disabled={isMutating}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onDelete={handleDelete}
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
