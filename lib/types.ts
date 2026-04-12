export type ProductCategory = "material" | "profile" | "cap" | "fixer";
export type UnitType = "m2" | "meter" | "piece" | "pack";

export type Product = {
  id: string;
  category: ProductCategory;
  title: string;
  collection_name: string | null;
  model: string | null;
  color: string | null;
  price: number;
  unit: UnitType;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductPayload = {
  category: ProductCategory;
  collection_name?: string | null;
  model?: string | null;
  color?: string | null;
  price: number;
  unit: UnitType;
  stock: number;
};

export type StoreDebt = {
  id: string;
  shop_name: string;
  owner_name: string | null;
  phone: string | null;
  debt_amount: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreDebtPayload = {
  shop_name: string;
  owner_name?: string | null;
  phone?: string | null;
  debt_amount: number;
  note?: string | null;
};
