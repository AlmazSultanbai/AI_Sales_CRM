do $$
begin
  create type public.order_status as enum ('draft', 'confirmed', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_number text not null,
  order_date date not null default current_date,
  address text not null,
  client_name text,
  phone text,
  total_amount numeric(14, 2) not null default 0,
  installation_amount numeric(14, 2) not null default 0,
  workshop_total numeric(14, 2) not null default 0,
  materials_sale_total numeric(14, 2) not null default 0,
  materials_cost_total numeric(14, 2) not null default 0,
  total_expenses numeric(14, 2) not null default 0,
  gross_profit numeric(14, 2) not null default 0,
  margin_percent numeric(8, 2) not null default 0,
  comment text,
  status public.order_status not null default 'draft',
  stock_applied boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_company_number_unique unique (company_id, order_number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  collection_model_id uuid references public.collection_models(id) on delete set null,
  material_name_snapshot text not null,
  model_snapshot text,
  color_snapshot text,
  sku_snapshot text,
  unit text not null default 'm2',
  quantity_m2 numeric(12, 2) not null default 0,
  sale_price_per_m2 numeric(12, 2) not null default 0,
  sale_amount numeric(14, 2) not null default 0,
  cost_price_per_m2 numeric(12, 2) not null default 0,
  cost_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table if exists public.stock_movements
  add column if not exists linked_order_id uuid references public.orders(id) on delete set null;

alter table if exists public.stock_movements
  add column if not exists linked_order_item_id uuid references public.order_items(id) on delete set null;

create index if not exists idx_orders_company_date on public.orders(company_id, order_date desc);
create index if not exists idx_orders_company_status on public.orders(company_id, status);
create index if not exists idx_orders_company_updated on public.orders(company_id, updated_at desc);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_stock_item on public.order_items(stock_item_id);
create index if not exists idx_stock_movements_order on public.stock_movements(linked_order_id, created_at desc);

