import { CatalogType } from "@/types/domain";

export const catalogTypeLabels: Record<CatalogType, string> = {
  material: "Материал",
  profile: "Профиль",
  cap: "Заглушка",
  fixator: "Фиксатор",
};

export const catalogTypeOptions: CatalogType[] = ["material", "profile", "cap", "fixator"];
