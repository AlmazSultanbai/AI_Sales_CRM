"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeOrderStatus,
  createOrder,
  deleteOrder,
  duplicateOrder,
  fetchOrderById,
  fetchOrders,
  fetchOrderStockOptions,
  OrdersFilter,
  updateOrder,
} from "@/features/orders/lib/orders-api";
import { CreateOrderInput, UpdateOrderInput } from "@/features/orders/lib/schemas";

export function useOrders(filters: OrdersFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: () => fetchOrders(filters),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useOrder(orderId?: string) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId as string),
    enabled: Boolean(orderId),
    staleTime: 20_000,
  });
}

export function useOrderStockOptions() {
  return useQuery({
    queryKey: ["order-stock-options"],
    queryFn: () => fetchOrderStockOptions(),
    staleTime: 20_000,
  });
}

export function useOrderMutations() {
  const queryClient = useQueryClient();

  const createOrderMutation = useMutation({
    mutationFn: (payload: CreateOrderInput) => createOrder(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: UpdateOrderInput }) => updateOrder(orderId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order", variables.orderId] });
      await queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });

  const statusOrderMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "draft" | "confirmed" | "completed" | "cancelled" }) =>
      changeOrderStatus(orderId, status),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order", variables.orderId] });
      await queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });

  const duplicateOrderMutation = useMutation({
    mutationFn: (orderId: string) => duplicateOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });

  return {
    createOrderMutation,
    updateOrderMutation,
    statusOrderMutation,
    duplicateOrderMutation,
    deleteOrderMutation,
  };
}
