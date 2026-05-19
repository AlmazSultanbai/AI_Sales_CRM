"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveStore,
  createStore,
  createStorePayment,
  createStorePurchase,
  deleteStorePurchase,
  fetchStoreById,
  fetchStorePayments,
  fetchStorePurchases,
  fetchStores,
  updateStorePurchase,
  updateStore,
} from "@/features/stores/lib/store-api";
import {
  CreatePaymentInput,
  CreatePurchaseInput,
  CreateStoreInput,
  UpdatePurchaseInput,
  UpdateStoreInput,
} from "@/features/stores/lib/schemas";

export function useStores(search: string, filter: "all" | "with_debt" | "without_debt" | "inactive", sort: "name" | "debt" | "activity") {
  return useQuery({
    queryKey: ["stores", search, filter, sort],
    queryFn: () => fetchStores(search, filter, sort),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useStoreDetails(storeId?: string) {
  return useQuery({
    queryKey: ["store", storeId],
    queryFn: () => fetchStoreById(storeId!),
    enabled: Boolean(storeId),
    staleTime: 20_000,
  });
}

export function useStorePurchases(
  storeId?: string,
  filters?: { status: "all" | "paid" | "partial" | "unpaid"; date_from?: string; date_to?: string; min_amount?: number; max_amount?: number }
) {
  return useQuery({
    queryKey: ["store-purchases", storeId, filters],
    queryFn: () => fetchStorePurchases(storeId!, filters!),
    enabled: Boolean(storeId && filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useStorePayments(storeId?: string, filters?: { date_from?: string; date_to?: string; method?: string }) {
  return useQuery({
    queryKey: ["store-payments", storeId, filters],
    queryFn: () => fetchStorePayments(storeId!, filters!),
    enabled: Boolean(storeId && filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useStoreMutations() {
  const queryClient = useQueryClient();

  const invalidateStoreData = async (storeId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["stores"] });
    if (storeId) {
      await queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["store-purchases", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["store-payments", storeId] });
    }
  };

  const createStoreMutation = useMutation({
    mutationFn: (payload: CreateStoreInput) => createStore(payload),
    onSuccess: async () => invalidateStoreData(),
  });

  const updateStoreMutation = useMutation({
    mutationFn: ({ storeId, payload }: { storeId: string; payload: UpdateStoreInput }) =>
      updateStore(storeId, payload),
    onSuccess: async (store) => invalidateStoreData(store.id),
  });

  const archiveStoreMutation = useMutation({
    mutationFn: ({ storeId, password }: { storeId: string; password: string }) => archiveStore(storeId, password),
    onSuccess: async () => invalidateStoreData(),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: ({ storeId, payload }: { storeId: string; payload: CreatePurchaseInput }) =>
      createStorePurchase(storeId, payload),
    onSuccess: async (purchase) => invalidateStoreData(purchase.store_id),
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: ({
      storeId,
      purchaseId,
      payload,
    }: {
      storeId: string;
      purchaseId: string;
      payload: UpdatePurchaseInput;
    }) => updateStorePurchase(storeId, purchaseId, payload),
    onSuccess: async (purchase) => invalidateStoreData(purchase.store_id),
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: ({ storeId, purchaseId }: { storeId: string; purchaseId: string }) =>
      deleteStorePurchase(storeId, purchaseId),
    onSuccess: async (_result, variables) => invalidateStoreData(variables.storeId),
  });

  const createPaymentMutation = useMutation({
    mutationFn: ({ storeId, payload }: { storeId: string; payload: CreatePaymentInput }) =>
      createStorePayment(storeId, payload),
    onSuccess: async (payment) => invalidateStoreData(payment.store_id),
  });

  return {
    createStoreMutation,
    updateStoreMutation,
    archiveStoreMutation,
    createPurchaseMutation,
    updatePurchaseMutation,
    deletePurchaseMutation,
    createPaymentMutation,
  };
}
