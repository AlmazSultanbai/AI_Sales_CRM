"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStockMovement, fetchStockItems, fetchStockMovements } from "@/features/inventory/lib/stock-api";
import { CreateStockMovementInput } from "@/features/inventory/lib/schemas";

export function useStockItems(filters: {
  search?: string;
  material?: string;
  collection_id?: string;
  model_id?: string;
  color?: string;
  low_stock?: boolean;
  in_stock?: "all" | "in_stock" | "out_of_stock";
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["stock-items", filters],
    queryFn: () => fetchStockItems(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useStockMovements(filters: {
  stock_item_id?: string;
  movement_type?: "incoming" | "outgoing" | "transfer" | "adjustment";
  date_from?: string;
  date_to?: string;
  search?: string;
  supplier_or_store?: string;
  created_by?: string;
  material?: string;
  collection?: string;
  model?: string;
  color?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["stock-movements", filters],
    queryFn: () => fetchStockMovements(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useStockMutations() {
  const queryClient = useQueryClient();

  const createMovementMutation = useMutation({
    mutationFn: (payload: CreateStockMovementInput) => createStockMovement(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });

  return {
    createMovementMutation,
  };
}
