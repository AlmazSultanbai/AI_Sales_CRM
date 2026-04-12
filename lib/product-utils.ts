import { ProductCategory, ProductPayload, UnitType } from "@/lib/types";

export const categoryLabels: Record<ProductCategory, string> = {
  material: "Материалы",
  profile: "Профиль",
  cap: "Заглушка",
  fixer: "Фиксатор",
};

export const baseTitles: Record<Exclude<ProductCategory, "material">, string> = {
  profile: "Профиль",
  cap: "Заглушка",
  fixer: "Фиксатор",
};

export const unitLabels: Record<UnitType, string> = {
  m2: "м2",
  meter: "метр",
  piece: "шт",
  pack: "пачка",
};

export function allowedUnits(category: ProductCategory): UnitType[] {
  if (category === "material") return ["m2", "meter"];
  if (category === "profile") return ["meter"];
  return ["piece", "pack"];
}

export function buildTitle(input: {
  category: ProductCategory;
  collection_name?: string | null;
  model?: string | null;
  color?: string | null;
}) {
  if (input.category === "material") {
    return `${input.collection_name?.trim() ?? ""} ${input.model?.trim() ?? ""}`.trim();
  }

  return `${baseTitles[input.category]} ${input.color?.trim() ?? ""}`.trim();
}

export function normalizeText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function validateNewProduct(input: Partial<ProductPayload>) {
  const category = input.category;
  const price = Number(input.price);
  const stock = Number(input.stock);
  const unit = input.unit;

  if (!category) {
    return "Категория обязательна";
  }

  if (!allowedUnits(category).includes(unit as UnitType)) {
    return "Неверная единица измерения для этой категории";
  }

  if (Number.isNaN(price) || price < 0) {
    return "Цена должна быть числом больше или равна 0";
  }

  if (Number.isNaN(stock) || stock < 0) {
    return "Остаток должен быть числом больше или равен 0";
  }

  if (category === "material") {
    if (!normalizeText(input.collection_name)) {
      return "Для материала нужно указать коллекцию";
    }

    if (!normalizeText(input.model)) {
      return "Для материала нужно указать модель";
    }
  } else if (!normalizeText(input.color)) {
    return "Для этой категории нужно указать цвет";
  }

  return null;
}
