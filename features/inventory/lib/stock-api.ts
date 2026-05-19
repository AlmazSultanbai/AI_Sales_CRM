import { CreateStockMovementInput } from "@/features/inventory/lib/schemas";
import { StockItem, StockMovement } from "@/types/domain";

type StockFilters = {
  search?: string;
  material?: string;
  collection_id?: string;
  model_id?: string;
  color?: string;
  low_stock?: boolean;
  in_stock?: "all" | "in_stock" | "out_of_stock";
  page?: number;
  page_size?: number;
};

function qs(params: Record<string, string | number | boolean | undefined>) {
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      urlParams.set(key, String(value));
    }
  });
  return urlParams.toString();
}

async function safeJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data as T;
}

export type StockListItem = StockItem & {
  lastMovement?: {
    created_at: string;
    movement_type: string;
    supplier_name: string | null;
    source_store_id: string | null;
    destination_store_id: string | null;
  } | null;
};

export type StockListResponse = {
  items: StockListItem[];
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalAmount: number;
    lowStockItems: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type StockHistoryResponse = {
  items: StockMovement[];
  summary?: {
    total: number;
    incoming: number;
    outgoing: number;
    transfer: number;
    adjustment: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function fetchStockItems(filters: StockFilters): Promise<StockListResponse> {
  const response = await fetch(`/api/stocks?${qs({
    ...filters,
    low_stock: filters.low_stock ? "true" : undefined,
  })}`);
  return safeJson<StockListResponse>(response);
}

export async function fetchStockMovements(filters: {
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
}): Promise<StockHistoryResponse> {
  const response = await fetch(`/api/stocks/movements?${qs(filters)}`);
  return safeJson<StockHistoryResponse>(response);
}

export async function createStockMovement(payload: CreateStockMovementInput) {
  const response = await fetch("/api/stocks/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson<{ movement: StockMovement; stock_item: StockItem }>(response);
}
