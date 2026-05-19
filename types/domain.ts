export type CatalogType = "material" | "profile" | "cap" | "fixator";
export type UserRole = "admin" | "user";
export type MovementType = "incoming" | "outgoing" | "transfer" | "writeoff" | "adjustment";

export type CollectionModel = {
  id: string;
  collection_id: string;
  model_code: string;
  color_name: string;
  color_hex: string;
  price_per_m2: number;
  image_url?: string | null;
  sku?: string | null;
  is_active?: boolean;
  sort_order?: number;
  stock_items?: {
    quantity: number;
    unit: "m2" | "meter" | "piece" | "pack";
  }[];
  created_at: string;
};

export type Collection = {
  id: string;
  company_id: string;
  name: string;
  type: CatalogType;
  price_per_m2: number;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  collection_models: CollectionModel[];
};

export type Company = {
  id: string;
  name: string;
  created_at: string;
};

export type AppUser = {
  id: string;
  company_id: string;
  role: UserRole;
  full_name: string;
  email: string;
};

export type StockItem = {
  id: string;
  company_id: string;
  collection_id: string;
  collection_model_id: string | null;
  material_name?: string | null;
  model_code?: string | null;
  color_name?: string | null;
  sku?: string | null;
  photo_url?: string | null;
  quantity: number;
  quantity_m2?: number;
  purchase_price_per_m2?: number;
  sale_price_per_m2?: number | null;
  low_stock_threshold?: number;
  last_movement_at?: string | null;
  unit: "m2" | "meter" | "piece" | "pack";
  created_at?: string;
  updated_at?: string;
  collections?: {
    id: string;
    name: string;
    type: CatalogType;
  } | null;
  collection_models?: {
    id: string;
    model_code: string;
    color_name: string;
    color_hex: string;
    image_url?: string | null;
    sku?: string | null;
  } | null;
};

export type StockMovement = {
  id: string;
  company_id?: string;
  stock_item_id?: string;
  movement_type: MovementType;
  quantity: number;
  quantity_m2?: number;
  unit_price?: number | null;
  total_amount?: number | null;
  supplier_name?: string | null;
  source_store_id?: string | null;
  destination_store_id?: string | null;
  movement_date?: string;
  comment: string | null;
  created_by?: string | null;
  created_at: string;
  stock_items?: StockItem | null;
};

export type Store = {
  id: string;
  company_id?: string;
  name: string;
  contact_name?: string | null;
  contact_person?: string | null;
  phone: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  debt_balance: number;
  total_purchases_sum?: number;
  total_paid_sum?: number;
  current_debt_sum?: number;
  last_activity_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Debt = {
  id: string;
  store_id: string;
  amount: number;
  last_shipment_at: string | null;
  payment_status: "unpaid" | "partial" | "paid";
};

export type PurchaseStatus = "paid" | "partial" | "unpaid";
export type PaymentMethod = "cash" | "bank" | "card" | "transfer";
export type OrderStatus = "draft" | "confirmed" | "completed" | "cancelled";

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  collection_id: string | null;
  collection_model_id: string | null;
  item_name_snapshot: string;
  item_image_url_snapshot?: string | null;
  quantity: number;
  unit: "m2" | "meter" | "piece" | "pack";
  unit_price: number;
  total_price: number;
  created_at: string;
};

export type Payment = {
  id: string;
  company_id: string;
  store_id: string;
  purchase_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  comment: string | null;
  created_by: string | null;
  created_at: string;
};

export type Purchase = {
  id: string;
  company_id: string;
  store_id: string;
  purchase_number: string;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  payment_status: PurchaseStatus;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  purchase_items?: PurchaseItem[];
  payments?: Payment[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  stock_item_id: string | null;
  collection_id: string | null;
  collection_model_id: string | null;
  material_name_snapshot: string;
  model_snapshot: string | null;
  color_snapshot: string | null;
  sku_snapshot: string | null;
  unit: "m2" | "meter" | "piece" | "pack";
  quantity_m2: number;
  sale_price_per_m2: number;
  sale_amount: number;
  cost_price_per_m2: number;
  cost_amount: number;
  created_at: string;
};

export type Order = {
  id: string;
  company_id: string;
  order_number: string;
  order_date: string;
  address: string;
  client_name: string | null;
  phone: string | null;
  total_amount: number;
  installation_amount: number;
  workshop_total: number;
  materials_sale_total: number;
  materials_cost_total: number;
  total_expenses: number;
  gross_profit: number;
  margin_percent: number;
  comment: string | null;
  status: OrderStatus;
  stock_applied: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};
