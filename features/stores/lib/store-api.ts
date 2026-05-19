import { Payment, Purchase, Store } from "@/types/domain";
import {
  CreatePaymentInput,
  CreatePurchaseInput,
  CreateStoreInput,
  UpdatePurchaseInput,
  UpdateStoreInput,
} from "./schemas";

export type StoreFilter = "all" | "with_debt" | "without_debt" | "inactive";
export type StoreSort = "name" | "debt" | "activity";
export type PurchaseStatusFilter = "all" | "paid" | "partial" | "unpaid";

function qs(params: Record<string, string | number | undefined | null>) {
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      urlParams.set(key, String(value));
    }
  });
  return urlParams.toString();
}

async function safeJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

export async function fetchStores(search: string, filter: StoreFilter, sort: StoreSort): Promise<Store[]> {
  const query = qs({ search, filter, sort });
  const response = await fetch(`/api/stores?${query}`);
  return safeJson(response);
}

export async function fetchStoreById(storeId: string): Promise<Store> {
  const response = await fetch(`/api/stores/${storeId}`);
  return safeJson(response);
}

export async function createStore(payload: CreateStoreInput): Promise<Store> {
  const response = await fetch("/api/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson(response);
}

export async function updateStore(storeId: string, payload: UpdateStoreInput): Promise<Store> {
  const response = await fetch(`/api/stores/${storeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson(response);
}

export async function archiveStore(storeId: string, password: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  await safeJson(response);
}

export async function fetchStorePurchases(
  storeId: string,
  filters: {
    status: PurchaseStatusFilter;
    date_from?: string;
    date_to?: string;
    min_amount?: number;
    max_amount?: number;
  }
): Promise<Purchase[]> {
  const response = await fetch(`/api/stores/${storeId}/purchases?${qs(filters)}`);
  return safeJson(response);
}

export async function createStorePurchase(storeId: string, payload: CreatePurchaseInput): Promise<Purchase> {
  const response = await fetch(`/api/stores/${storeId}/purchases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson(response);
}

export async function updateStorePurchase(
  storeId: string,
  purchaseId: string,
  payload: UpdatePurchaseInput
): Promise<Purchase> {
  const response = await fetch(`/api/stores/${storeId}/purchases/${purchaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson(response);
}

export async function deleteStorePurchase(storeId: string, purchaseId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/purchases/${purchaseId}`, {
    method: "DELETE",
  });
  await safeJson(response);
}

export async function fetchStorePayments(
  storeId: string,
  filters: { date_from?: string; date_to?: string; method?: string }
): Promise<Payment[]> {
  const response = await fetch(`/api/stores/${storeId}/payments?${qs(filters)}`);
  return safeJson(response);
}

export async function createStorePayment(storeId: string, payload: CreatePaymentInput): Promise<Payment> {
  const response = await fetch(`/api/stores/${storeId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return safeJson(response);
}
