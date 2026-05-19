export type ItemUnit = "m2" | "meter" | "piece" | "pack";
export type CatalogUnitType = "material" | "profile" | "cap" | "fixator";

export function defaultUnitByCollectionType(type?: string | null): ItemUnit {
  if (type === "profile") return "meter";
  if (type === "cap" || type === "fixator") return "pack";
  return "m2";
}

export function normalizeUnitByCollectionType(
  type?: string | null,
  fallback?: ItemUnit | null
): ItemUnit {
  if (type === "profile" || type === "cap" || type === "fixator" || type === "material") {
    return defaultUnitByCollectionType(type);
  }
  return fallback ?? "m2";
}

export function unitLabel(unit?: ItemUnit | null): string {
  switch (unit) {
    case "meter":
      return "м";
    case "pack":
      return "пачка";
    case "piece":
      return "шт";
    case "m2":
    default:
      return "м²";
  }
}

export function unitLabelLong(unit?: ItemUnit | null): string {
  switch (unit) {
    case "meter":
      return "метр";
    case "pack":
      return "пачка";
    case "piece":
      return "шт";
    case "m2":
    default:
      return "м²";
  }
}

