import { Collection } from "@/types/domain";
import { CreateCollectionInput, CreateModelInput, UpdateCollectionInput, UpdateModelInput } from "./schemas";

function buildQuery(search?: string, type?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (type) params.set("type", type);
  return params.toString();
}

export async function fetchCollections(search?: string, type?: string): Promise<Collection[]> {
  const query = buildQuery(search, type);
  const response = await fetch(`/api/catalog/collections${query ? `?${query}` : ""}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось получить коллекции");
  }

  return data;
}

export async function createCollection(payload: CreateCollectionInput): Promise<Collection> {
  const response = await fetch("/api/catalog/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось создать коллекцию");
  }

  return data;
}

export async function updateCollection(id: string, payload: UpdateCollectionInput): Promise<Collection> {
  const response = await fetch(`/api/catalog/collections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось обновить коллекцию");
  }

  return data;
}

export async function deleteCollection(id: string, password: string): Promise<void> {
  const response = await fetch(`/api/catalog/collections/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось удалить коллекцию");
  }
}

export async function addModel(collectionId: string, payload: CreateModelInput) {
  const response = await fetch(`/api/catalog/collections/${collectionId}/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось добавить модель");
  }

  return data;
}

export async function updateModel(modelId: string, payload: UpdateModelInput) {
  const response = await fetch(`/api/catalog/models/${modelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось обновить модель");
  }

  return data;
}
