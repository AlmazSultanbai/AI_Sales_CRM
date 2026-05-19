import { Order, StockItem } from "@/types/domain";
import { CreateOrderInput, UpdateOrderInput } from "@/features/orders/lib/schemas";

function qs(params: Record<string, string | number | undefined | null | boolean>) {
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    urlParams.set(key, String(value));
  }
  return urlParams.toString();
}

async function safeJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data as T;
}

export type OrdersFilter = {
  page?: number;
  page_size?: number;
  status?: "all" | "draft" | "confirmed" | "completed" | "cancelled";
  date_from?: string;
  date_to?: string;
  search?: string;
  client?: string;
  phone?: string;
  address?: string;
  material?: string;
  user?: string;
};

export type OrdersListResponse = {
  items: Array<
    Order & {
      materials_preview?: string;
      creator_name?: string | null;
      order_items?: Array<{
        id: string;
        material_name_snapshot: string;
        model_snapshot: string | null;
        sku_snapshot: string | null;
      }>;
    }
  >;
  summary: {
    totalOrders: number;
    totalAmount: number;
    installationTotal: number;
    workshopTotal: number;
    profitTotal: number;
    cancelled: number;
    draft: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function fetchOrders(filters: OrdersFilter): Promise<OrdersListResponse> {
  const response = await fetch(`/api/orders?${qs(filters)}`);
  return safeJson<OrdersListResponse>(response);
}

export async function fetchOrderById(orderId: string): Promise<Order & { movements?: unknown[] }> {
  const response = await fetch(`/api/orders/${orderId}`);
  return safeJson<Order & { movements?: unknown[] }>(response);
}

export async function createOrder(payload: CreateOrderInput): Promise<Order> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson<Order>(response);
}

export async function updateOrder(orderId: string, payload: UpdateOrderInput): Promise<Order> {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson<Order>(response);
}

export async function duplicateOrder(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "duplicate" }),
  });
  return safeJson<Order>(response);
}

export async function changeOrderStatus(orderId: string, status: "draft" | "confirmed" | "completed" | "cancelled") {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", status }),
  });
  return safeJson<{ ok: boolean }>(response);
}

export async function deleteOrder(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
  });
  return safeJson<{ ok: boolean }>(response);
}

export async function fetchOrderStockOptions(): Promise<StockItem[]> {
  const response = await fetch("/api/stocks?lite=1&page=1&page_size=300");
  const data = await safeJson<{ items: StockItem[] }>(response);
  return data.items ?? [];
}
