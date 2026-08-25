"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductThumb } from "@/features/media/components/product-thumb";
import { StockListItem } from "@/features/inventory/lib/stock-api";
import { formatSom, formatStockQuantity } from "@/features/inventory/lib/stock-utils";
import { unitLabel } from "@/lib/units";

type LookupResponse = {
  item: StockListItem | null;
  matchedBy: "qr" | "barcode" | "model" | null;
  barcodeUnavailable?: boolean;
  error?: string;
};

type Stage =
  | { kind: "scanning" }
  | { kind: "checking"; code: string }
  | { kind: "found"; code: string; item: StockListItem }
  | { kind: "missing"; code: string; barcodeUnavailable: boolean }
  | { kind: "error"; message: string };

/** Нативный детектор есть в Chrome на Android; в остальных браузерах подключаем zxing. */
type NativeDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

export function BarcodeScannerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppedRef = useRef(false);
  const [stage, setStage] = useState<Stage>({ kind: "scanning" });
  const [manualCode, setManualCode] = useState("");

  const stopCamera = useCallback(() => {
    stoppedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const checkCode = useCallback(
    async (code: string) => {
      stopCamera();
      setStage({ kind: "checking", code });

      try {
        const response = await fetch(`/api/stocks/lookup?code=${encodeURIComponent(code)}`);
        const payload = (await response.json()) as LookupResponse;
        if (!response.ok) throw new Error(payload.error ?? "Не удалось найти позицию");

        if (payload.item) {
          setStage({ kind: "found", code, item: payload.item });
        } else {
          setStage({ kind: "missing", code, barcodeUnavailable: Boolean(payload.barcodeUnavailable) });
        }
      } catch (error) {
        setStage({ kind: "error", message: error instanceof Error ? error.message : "Ошибка запроса" });
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    if (!open) return;

    stoppedRef.current = false;
    setStage({ kind: "scanning" });
    setManualCode("");

    let zxingControls: { stop: () => void } | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStage({ kind: "error", message: "Браузер не даёт доступ к камере. Введите код вручную." });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stoppedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => undefined);
        }

        const DetectorCtor = (window as unknown as { BarcodeDetector?: new (options?: unknown) => NativeDetector })
          .BarcodeDetector;

        if (DetectorCtor) {
          const detector = new DetectorCtor({
            formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf"],
          });

          const tick = async () => {
            if (stoppedRef.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const value = codes[0]?.rawValue?.trim();
              if (value) {
                await checkCode(value);
                return;
              }
            } catch {
              // кадр не распознан — просто пробуем следующий
            }
            requestAnimationFrame(() => void tick());
          };

          void tick();
          return;
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stoppedRef.current) return;

        const reader = new BrowserMultiFormatReader();
        zxingControls = await reader.decodeFromVideoElement(videoRef.current!, (result) => {
          const value = result?.getText()?.trim();
          if (value && !stoppedRef.current) {
            zxingControls?.stop();
            void checkCode(value);
          }
        });
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Доступ к камере запрещён. Разрешите его в настройках браузера или введите код вручную."
            : "Камера недоступна. Введите код вручную.";
        setStage({ kind: "error", message });
      }
    }

    void start();

    return () => {
      zxingControls?.stop();
      stopCamera();
    };
  }, [open, checkCode, stopCamera]);

  useEffect(() => {
    if (!open) stopCamera();
  }, [open, stopCamera]);

  if (!open) return null;

  const openItem = (item: StockListItem) => {
    onClose();
    router.push(`/stocks?item=${item.id}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] text-white">
        <p className="text-base font-semibold">Сканер кода</p>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          aria-label="Закрыть сканер"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />

        {stage.kind === "scanning" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-72 rounded-3xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)]" />
          </div>
        ) : null}

        {stage.kind === "checking" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Ищу позицию...
          </div>
        ) : null}
      </div>

      <div className="space-y-3 bg-white px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
        {stage.kind === "scanning" ? (
          <p className="text-center text-sm text-muted">Наведите камеру на штрихкод или QR-код</p>
        ) : null}

        {stage.kind === "error" ? <p className="text-sm text-rose-600">{stage.message}</p> : null}

        {stage.kind === "found" ? (
          <div className="crm-row flex items-start gap-3">
            <ProductThumb
              src={stage.item.photo_url ?? stage.item.collection_models?.image_url ?? null}
              alt={stage.item.material_name ?? "Товар"}
              className="h-12 w-12 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="crm-row-title truncate">{stage.item.material_name ?? "Товар"}</p>
              <p className="crm-row-sub truncate">
                {[stage.item.model_code, stage.item.color_name].filter(Boolean).join(" · ") || "Без характеристик"}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Остаток {formatStockQuantity(Number(stage.item.quantity_m2 ?? 0))} {unitLabel(stage.item.unit)} ·{" "}
                {stage.item.sale_price_per_m2 == null ? "без цены" : formatSom(Number(stage.item.sale_price_per_m2))}
              </p>
            </div>
          </div>
        ) : null}

        {stage.kind === "missing" ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">Код {stage.code} не найден</p>
            <p className="text-sm text-muted">
              {stage.barcodeUnavailable
                ? "Привязка кодов появится после миграции базы. Пока найти можно только по QR с нашей этикетки или по коду модели."
                : "Откройте нужную позицию на складе и привяжите к ней этот код."}
            </p>
          </div>
        ) : null}

        {stage.kind !== "scanning" && stage.kind !== "checking" ? (
          <div className="flex flex-wrap gap-2">
            {stage.kind === "found" ? (
              <Button className="min-w-[140px] flex-1" onClick={() => openItem(stage.item)}>
                Открыть позицию
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="min-w-[140px] flex-1"
              onClick={() => {
                stopCamera();
                onClose();
              }}
            >
              Закрыть
            </Button>
          </div>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const code = manualCode.trim();
            if (code) void checkCode(code);
          }}
        >
          <Input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Или введите код вручную"
            inputMode="text"
          />
          <Button type="submit" variant="secondary" className="gap-1.5">
            <ScanLine className="h-4 w-4" />
            Найти
          </Button>
        </form>
      </div>
    </div>
  );
}
