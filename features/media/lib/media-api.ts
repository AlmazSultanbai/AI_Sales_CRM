export type UploadEntityType = "collection" | "collection_model";

export async function uploadEntityImage(entityType: UploadEntityType, entityId: string, file: File) {
  const formData = new FormData();
  formData.append("entity_type", entityType);
  formData.append("entity_id", entityId);
  formData.append("file", file);

  const response = await fetch("/api/media/product-image", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось загрузить изображение");
  }

  return data as { file_url: string };
}

export async function deleteEntityImage(entityType: UploadEntityType, entityId: string) {
  const params = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
  });

  const response = await fetch(`/api/media/product-image?${params.toString()}`, {
    method: "DELETE",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось удалить изображение");
  }

  return data;
}
