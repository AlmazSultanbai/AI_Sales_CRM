export const exportSections = [
  { value: "catalog", label: "Каталог" },
  { value: "stocks", label: "Склад" },
  { value: "movements", label: "Движения" },
  { value: "stores", label: "Магазины" },
  { value: "orders", label: "Заказы" },
  { value: "purchases", label: "Закупки" },
  { value: "payments", label: "Платежи" },
  { value: "debts", label: "Долги" },
] as const;

export type ExportSection = (typeof exportSections)[number]["value"];

export function exportSectionLabel(section: ExportSection) {
  return exportSections.find((item) => item.value === section)?.label ?? section;
}
