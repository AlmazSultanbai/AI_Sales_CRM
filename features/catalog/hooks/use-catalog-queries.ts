"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addModel,
  createCollection,
  deleteCollection,
  fetchCollections,
  updateCollection,
  updateModel,
} from "@/features/catalog/lib/catalog-api";
import { CreateCollectionInput, CreateModelInput, UpdateCollectionInput, UpdateModelInput } from "@/features/catalog/lib/schemas";

export function useCollections(search: string, type: string) {
  return useQuery({
    queryKey: ["collections", search, type],
    queryFn: () => fetchCollections(search, type),
  });
}

export function useCatalogMutations(search: string, type: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
    await queryClient.invalidateQueries({ queryKey: ["collections", search, type] });
  };

  const createCollectionMutation = useMutation({
    mutationFn: (payload: CreateCollectionInput) => createCollection(payload),
    onSuccess: invalidate,
  });

  const updateCollectionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCollectionInput }) =>
      updateCollection(id, payload),
    onSuccess: invalidate,
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => deleteCollection(id, password),
    onSuccess: invalidate,
  });

  const addModelMutation = useMutation({
    mutationFn: ({ collectionId, payload }: { collectionId: string; payload: CreateModelInput }) =>
      addModel(collectionId, payload),
    onSuccess: invalidate,
  });

  const updateModelMutation = useMutation({
    mutationFn: ({ modelId, payload }: { modelId: string; payload: UpdateModelInput }) =>
      updateModel(modelId, payload),
    onSuccess: invalidate,
  });

  return {
    refreshCollections: invalidate,
    createCollectionMutation,
    updateCollectionMutation,
    deleteCollectionMutation,
    addModelMutation,
    updateModelMutation,
  };
}
