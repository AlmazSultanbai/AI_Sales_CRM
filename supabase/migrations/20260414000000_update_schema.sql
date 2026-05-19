-- Rename store_debts to shops
alter table if exists public.store_debts rename to shops;

alter index if exists idx_store_debts_active rename to idx_shops_active;
alter index if exists idx_store_debts_amount rename to idx_shops_amount;
alter index if exists idx_store_debts_shop_name rename to idx_shops_shop_name;

alter table if exists public.shops rename column shop_name to name;
alter table if exists public.shops rename column owner_name to contact_name;
alter table if exists public.shops rename column debt_amount to debt;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'movement_type') then
    create type movement_type as enum ('incoming', 'outgoing', 'return');
  end if;
end $$;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  type movement_type not null,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12, 2) not null,
  shop_id uuid references public.shops(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product_id on public.stock_movements(product_id);
create index if not exists idx_stock_movements_shop_id on public.stock_movements(shop_id);

alter table public.stock_movements enable row level security;

create policy "Authenticated users can read stock movements"
on public.stock_movements for select to authenticated using (true);

create policy "Authenticated users can insert stock movements"
on public.stock_movements for insert to authenticated with check (true);

create policy "Authenticated users can update stock movements"
on public.stock_movements for update to authenticated using (true) with check (true);


create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  amount numeric(12, 2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_shop_id on public.payments(shop_id);

alter table public.payments enable row level security;

create policy "Authenticated users can read payments"
on public.payments for select to authenticated using (true);

create policy "Authenticated users can insert payments"
on public.payments for insert to authenticated with check (true);

create policy "Authenticated users can update payments"
on public.payments for update to authenticated using (true) with check (true);
