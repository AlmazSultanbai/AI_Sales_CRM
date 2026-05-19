import { MovementType, StockItem } from "@/types/domain";

export function movementTypeLabel(type: MovementType) {
  if (type === "incoming") return "Приход";
  if (type === "outgoing") return "Расход";
  if (type === "transfer") return "Перемещение";
  if (type === "adjustment") return "Корректировка";
  return "Списание";
}

export function stockStatusClass(item: StockItem) {
  const quantity = Number(item.quantity_m2 ?? item.quantity ?? 0);
  const threshold = Number(item.low_stock_threshold ?? 10);

  if (quantity <= 0) return "text-rose-600";
  if (quantity <= threshold) return "text-amber-600";
  return "text-emerald-600";
}

export function formatStockQuantity(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

export function formatSom(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} сом`;
}

export function generateSku(material: string, model: string, color: string) {
  const clean = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9А-ЯЁ-]/gi, "");

  return `${clean(material)}-${clean(model)}-${clean(color)}`;
}

