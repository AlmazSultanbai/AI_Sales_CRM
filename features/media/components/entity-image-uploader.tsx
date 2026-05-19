"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { deleteEntityImage, uploadEntityImage, UploadEntityType } from "@/features/media/lib/media-api";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

type Status = "idle" | "uploading" | "deleting";

export function EntityImageUploader({
  entityType,
  entityId,
  imageUrl,
  onChange,
  compact,
}: {
  entityType: UploadEntityType;
  entityId: string;
  imageUrl?: string | null;
  onChange: (url: string | null) => void;
  compact?: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const disabled = status !== "idle";

  const validateFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Разрешены только JPG, PNG или WEBP";
    if (file.size > MAX_SIZE) return "Файл должен быть не больше 5 MB";
    return null;
  };

  const handleUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("uploading");
    setError(null);
    try {
      const uploaded = await uploadEntityImage(entityType, entityId, file);
      onChange(uploaded.file_url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Ошибка загрузки");
    } finally {
      setStatus("idle");
    }
  };

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
    event.target.value = "";
  };

  const onDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (disabled) return;
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleUpload(file);
  };

  const handleDelete = async () => {
    setStatus("deleting");
    setError(null);
    try {
      await deleteEntityImage(entityType, entityId);
      onChange(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Ошибка удаления");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onInputChange}
      />

      {imageUrl ? (
        <div className={cn("space-y-2", compact ? "" : "rounded-2xl border border-border p-3")}>
          <ProductThumb
            src={imageUrl}
            alt="Фото товара"
            className={compact ? "h-16 w-16" : "h-36 w-full"}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              {status === "uploading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Заменить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={handleDelete}
              disabled={disabled}
            >
              {status === "deleting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Удалить
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "w-full rounded-2xl border border-dashed p-4 text-left transition",
            dragActive ? "border-slate-700 bg-slate-100" : "border-border bg-slate-50",
            compact ? "h-20" : ""
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            {status === "uploading" ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            ) : (
              <UploadCloud className="h-5 w-5 text-slate-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {compact ? "Загрузить фото" : "Перетащите фото или нажмите для выбора"}
              </p>
              <p className="text-xs text-muted">JPG / PNG / WEBP, до 5 MB</p>
            </div>
          </div>
        </button>
      )}

      {!imageUrl && compact ? (
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          <ImagePlus className="h-3.5 w-3.5" />
          Нет фото
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
