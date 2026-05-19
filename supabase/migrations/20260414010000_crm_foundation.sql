create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'catalog_type') then
    create type catalog_type as enum ('material', 'profile', 'cap', 'fixator');
  end if;

  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'stock_unit') then
    create type stock_unit as enum ('m2', 'meter', 'piece', 'pack');
  end if;

  if not exists (select 1 from pg_type where typname = 'movement_type') then
    create type movement_type as enum ('incoming', 'outgoing', 'transfer', 'writeoff');
  end if;

  if not exists (select 1 from pg_type where typname = 'debt_status') then
    create type debt_status as enum ('unpaid', 'partial', 'paid');
  end if;
end $$;

do $$
begin
  alter type movement_type add value if not exists 'transfer';
  alter type movement_type add value if not exists 'writeoff';
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role app_role not null default 'user',
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_company_email_unique unique (company_id, email)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type catalog_type not null,
  price_per_m2 numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_collections_unique_type_name
on public.collections(company_id, type, lower(name));

create table if not exists public.collection_models (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  model_code text not null,
  created_at timestamptz not null default now(),
  constraint collection_models_unique_model unique (collection_id, model_code)
);

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  collection_model_id uuid references public.collection_models(id) on delete set null,
  quantity numeric(12, 2) not null default 0,
  unit stock_unit not null default 'm2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  movement_type movement_type not null,
  quantity numeric(12, 2) not null,
  created_by uuid references public.users(id) on delete set null,
  comment text,
  created_at timestamptz not null default now()
);

alter table if exists public.stock_movements add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table if exists public.stock_movements add column if not exists stock_item_id uuid references public.stock_items(id) on delete cascade;
alter table if exists public.stock_movements add column if not exists movement_type movement_type;
alter table if exists public.stock_movements add column if not exists comment text;
alter table if exists public.stock_movements add column if not exists created_by uuid references public.users(id) on delete set null;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  debt_balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_company_name_unique unique (company_id, name)
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  last_shipment_at timestamptz,
  payment_status debt_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  section text not null,
  date_from date,
  date_to date,
  file_url text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_collections_company_type on public.collections(company_id, type);
create index if not exists idx_stock_items_collection on public.stock_items(collection_id);
create index if not exists idx_debts_store on public.debts(store_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_movements'
      and column_name = 'stock_item_id'
  ) then
    execute 'create index if not exists idx_stock_movements_item on public.stock_movements(stock_item_id)';
  end if;
end $$;

insert into public.companies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'sun textile')
on conflict (id) do update set name = excluded.name;

insert into public.users (id, company_id, role, full_name, email)
values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'admin', 'Admin User', 'admin@sun-textile.local')
on conflict (id) do nothing;

do $$
declare
  c_blackout uuid;
  c_carmen uuid;
  c_lisbon uuid;
  c_pamela uuid;
  c_sofia uuid;
begin
  insert into public.collections (company_id, name, type, price_per_m2)
  values
    ('00000000-0000-0000-0000-000000000001', 'Black out', 'material', 1300),
    ('00000000-0000-0000-0000-000000000001', 'Кармен', 'material', 1100),
    ('00000000-0000-0000-0000-000000000001', 'Лиссабон', 'material', 800),
    ('00000000-0000-0000-0000-000000000001', 'Памела', 'material', 1000),
    ('00000000-0000-0000-0000-000000000001', 'София', 'material', 1100),
    ('00000000-0000-0000-0000-000000000001', 'Профиль', 'profile', 800),
    ('00000000-0000-0000-0000-000000000001', 'Заглушка', 'cap', 800),
    ('00000000-0000-0000-0000-000000000001', 'Фиксатор', 'fixator', 800)
  on conflict (company_id, type, lower(name)) do nothing;

  select id into c_blackout from public.collections where company_id = '00000000-0000-0000-0000-000000000001' and type = 'material' and name = 'Black out' limit 1;
  select id into c_carmen from public.collections where company_id = '00000000-0000-0000-0000-000000000001' and type = 'material' and name = 'Кармен' limit 1;
  select id into c_lisbon from public.collections where company_id = '00000000-0000-0000-0000-000000000001' and type = 'material' and name = 'Лиссабон' limit 1;
  select id into c_pamela from public.collections where company_id = '00000000-0000-0000-0000-000000000001' and type = 'material' and name = 'Памела' limit 1;
  select id into c_sofia from public.collections where company_id = '00000000-0000-0000-0000-000000000001' and type = 'material' and name = 'София' limit 1;

  insert into public.collection_models (collection_id, model_code)
  select c_blackout, m from unnest(array['02','03','04','05','06']) as m
  on conflict (collection_id, model_code) do nothing;

  insert into public.collection_models (collection_id, model_code)
  select c_carmen, m from unnest(array['01','02','03']) as m
  on conflict (collection_id, model_code) do nothing;

  insert into public.collection_models (collection_id, model_code)
  select c_lisbon, m from unnest(array['01','03','04','05','06','11','12','13','14','17']) as m
  on conflict (collection_id, model_code) do nothing;

  insert into public.collection_models (collection_id, model_code)
  select c_pamela, m from unnest(array['01','07','09']) as m
  on conflict (collection_id, model_code) do nothing;

  insert into public.collection_models (collection_id, model_code)
  select c_sofia, m from unnest(array['01','02','03','04','05']) as m
  on conflict (collection_id, model_code) do nothing;
end $$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.collections enable row level security;
alter table public.collection_models enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stores enable row level security;
alter table public.debts enable row level security;
alter table public.exports enable row level security;

create policy "Authenticated can read companies" on public.companies for select to authenticated using (true);
create policy "Authenticated can read users" on public.users for select to authenticated using (true);
create policy "Authenticated can read collections" on public.collections for select to authenticated using (true);
create policy "Authenticated can read models" on public.collection_models for select to authenticated using (true);
create policy "Authenticated can read stock items" on public.stock_items for select to authenticated using (true);
create policy "Authenticated can read movements" on public.stock_movements for select to authenticated using (true);
create policy "Authenticated can read stores" on public.stores for select to authenticated using (true);
create policy "Authenticated can read debts" on public.debts for select to authenticated using (true);
create policy "Authenticated can read exports" on public.exports for select to authenticated using (true);

create policy "Authenticated can write collections" on public.collections for all to authenticated using (true) with check (true);
create policy "Authenticated can write models" on public.collection_models for all to authenticated using (true) with check (true);
create policy "Authenticated can write stock items" on public.stock_items for all to authenticated using (true) with check (true);
create policy "Authenticated can write movements" on public.stock_movements for all to authenticated using (true) with check (true);
create policy "Authenticated can write stores" on public.stores for all to authenticated using (true) with check (true);
create policy "Authenticated can write debts" on public.debts for all to authenticated using (true) with check (true);
create policy "Authenticated can write exports" on public.exports for all to authenticated using (true) with check (true);

create or replace trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

create or replace trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create or replace trigger collections_set_updated_at
before update on public.collections
for each row
execute function public.set_updated_at();

create or replace trigger stock_items_set_updated_at
before update on public.stock_items
for each row
execute function public.set_updated_at();

create or replace trigger stores_set_updated_at
before update on public.stores
for each row
execute function public.set_updated_at();

create or replace trigger debts_set_updated_at
before update on public.debts
for each row
execute function public.set_updated_at();
