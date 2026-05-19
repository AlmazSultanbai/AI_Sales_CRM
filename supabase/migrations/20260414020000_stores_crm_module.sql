do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('paid', 'partial', 'unpaid');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('cash', 'bank', 'card', 'transfer');
  end if;
end $$;

alter table if exists public.stores add column if not exists contact_person text;
alter table if exists public.stores add column if not exists address text;
alter table if exists public.stores add column if not exists notes text;
alter table if exists public.stores add column if not exists is_active boolean not null default true;
alter table if exists public.stores add column if not exists total_purchases_sum numeric(12, 2) not null default 0;
alter table if exists public.stores add column if not exists total_paid_sum numeric(12, 2) not null default 0;
alter table if exists public.stores add column if not exists current_debt_sum numeric(12, 2) not null default 0;
alter table if exists public.stores add column if not exists last_activity_at timestamptz;

update public.stores
set contact_person = coalesce(contact_person, contact_name)
where contact_person is null and contact_name is not null;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  purchase_number text not null,
  purchase_date date not null default current_date,
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  debt_amount numeric(12, 2) not null default 0,
  payment_status payment_status not null default 'unpaid',
  comment text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_company_number_unique unique (company_id, purchase_number)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  collection_model_id uuid references public.collection_models(id) on delete set null,
  item_name_snapshot text not null,
  quantity numeric(12, 2) not null default 0,
  unit stock_unit not null default 'm2',
  unit_price numeric(12, 2) not null default 0,
  total_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  amount numeric(12, 2) not null default 0,
  payment_date date not null default current_date,
  payment_method payment_method not null default 'cash',
  comment text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.payments add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table if exists public.payments add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.payments add column if not exists purchase_id uuid references public.purchases(id) on delete set null;
alter table if exists public.payments add column if not exists payment_date date not null default current_date;
alter table if exists public.payments add column if not exists payment_method payment_method not null default 'cash';
alter table if exists public.payments add column if not exists comment text;
alter table if exists public.payments add column if not exists created_by uuid references public.users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'shop_id'
  ) then
    execute 'update public.payments set shop_id = coalesce(shop_id, store_id) where shop_id is null';
    execute 'alter table public.payments alter column shop_id drop not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'shop_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'store_id'
  ) then
    execute 'alter table public.payments rename column shop_id to store_id';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'notes'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'comment'
  ) then
    execute 'alter table public.payments rename column notes to comment';
  end if;
end $$;

create index if not exists idx_stores_company_active on public.stores(company_id, is_active);
create index if not exists idx_stores_company_debt on public.stores(company_id, current_debt_sum desc);
create index if not exists idx_purchases_store_date on public.purchases(store_id, purchase_date desc);
create index if not exists idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index if not exists idx_payments_store_date on public.payments(store_id, payment_date desc);
create index if not exists idx_payments_purchase on public.payments(purchase_id);

create or replace function public.recalculate_purchase(p_purchase_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_debt numeric(12, 2);
begin
  select coalesce(sum(total_price), 0) into v_total
  from public.purchase_items
  where purchase_id = p_purchase_id;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where purchase_id = p_purchase_id;

  v_debt := greatest(v_total - v_paid, 0);

  update public.purchases
  set total_amount = v_total,
      paid_amount = v_paid,
      debt_amount = v_debt,
      payment_status = case
        when v_debt <= 0 and v_total > 0 then 'paid'::payment_status
        when v_paid > 0 and v_debt > 0 then 'partial'::payment_status
        else 'unpaid'::payment_status
      end
  where id = p_purchase_id;
end;
$$;

create or replace function public.recalculate_store(p_store_id uuid)
returns void
language plpgsql
as $$
declare
  v_total_purchases numeric(12, 2);
  v_total_paid numeric(12, 2);
  v_current_debt numeric(12, 2);
  v_last_purchase timestamptz;
  v_last_payment timestamptz;
begin
  select coalesce(sum(total_amount), 0), coalesce(sum(debt_amount), 0), max(created_at)
  into v_total_purchases, v_current_debt, v_last_purchase
  from public.purchases
  where store_id = p_store_id;

  select coalesce(sum(amount), 0), max(created_at)
  into v_total_paid, v_last_payment
  from public.payments
  where store_id = p_store_id;

  update public.stores
  set total_purchases_sum = v_total_purchases,
      total_paid_sum = v_total_paid,
      current_debt_sum = v_current_debt,
      debt_balance = v_current_debt,
      last_activity_at = greatest(coalesce(v_last_purchase, 'epoch'::timestamptz), coalesce(v_last_payment, 'epoch'::timestamptz))
  where id = p_store_id;
end;
$$;

create or replace function public.tg_purchase_items_recalculate()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_purchase(coalesce(new.purchase_id, old.purchase_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.tg_payments_recalculate()
returns trigger
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_store_id uuid;
begin
  v_purchase_id := coalesce(new.purchase_id, old.purchase_id);
  v_store_id := coalesce(new.store_id, old.store_id);

  if v_purchase_id is not null then
    perform public.recalculate_purchase(v_purchase_id);
  end if;

  if v_store_id is not null then
    perform public.recalculate_store(v_store_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.tg_purchases_recalculate()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_store(coalesce(new.store_id, old.store_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_purchase_items_recalculate on public.purchase_items;
create trigger trg_purchase_items_recalculate
after insert or update or delete on public.purchase_items
for each row execute function public.tg_purchase_items_recalculate();

drop trigger if exists trg_payments_recalculate on public.payments;
create trigger trg_payments_recalculate
after insert or update or delete on public.payments
for each row execute function public.tg_payments_recalculate();

drop trigger if exists trg_purchases_recalculate on public.purchases;
create trigger trg_purchases_recalculate
after insert or update or delete on public.purchases
for each row execute function public.tg_purchases_recalculate();

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Authenticated can read purchases" on public.purchases;
create policy "Authenticated can read purchases" on public.purchases for select to authenticated using (true);
drop policy if exists "Authenticated can write purchases" on public.purchases;
create policy "Authenticated can write purchases" on public.purchases for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated can read purchase items" on public.purchase_items;
create policy "Authenticated can read purchase items" on public.purchase_items for select to authenticated using (true);
drop policy if exists "Authenticated can write purchase items" on public.purchase_items;
create policy "Authenticated can write purchase items" on public.purchase_items for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated can read payments" on public.payments;
create policy "Authenticated can read payments" on public.payments for select to authenticated using (true);
drop policy if exists "Authenticated can write payments" on public.payments;
create policy "Authenticated can write payments" on public.payments for all to authenticated using (true) with check (true);

do $$
declare
  s_aigul uuid;
  s_asel uuid;
  s_arzan uuid;
  s_nur uuid;
  s_vostok uuid;
  p_1001 uuid;
  p_1002 uuid;
  p_1003 uuid;
begin
  insert into public.stores (company_id, name, contact_person, phone, address, notes, is_active)
  values
    ('00000000-0000-0000-0000-000000000001', 'Магазин Айгуль', 'Айгуль Раимбекова', '+996 700 123 456', 'мкр Южный, ул. 3, д.15', null, true),
    ('00000000-0000-0000-0000-000000000001', 'Магазин Асель', 'Асель Токтогулова', '+996 701 222 333', 'ул. Логвиненко, 28', null, true),
    ('00000000-0000-0000-0000-000000000001', 'Минимаркет Арзан', 'Гульмира Осмонова', '+996 555 111 222', 'Токольдош, 4', null, true),
    ('00000000-0000-0000-0000-000000000001', 'Продукты Нур', 'Нурлан Бейшеев', '+996 703 888 999', 'ул. Ахунбаева, 115', null, true),
    ('00000000-0000-0000-0000-000000000001', 'ТД Восток', 'Бакыт Джумалиев', '+996 557 444 555', 'ул. Киевская, 92', null, true)
  on conflict (company_id, name) do nothing;

  select id into s_aigul from public.stores where company_id = '00000000-0000-0000-0000-000000000001' and name = 'Магазин Айгуль' limit 1;
  select id into s_asel from public.stores where company_id = '00000000-0000-0000-0000-000000000001' and name = 'Магазин Асель' limit 1;
  select id into s_arzan from public.stores where company_id = '00000000-0000-0000-0000-000000000001' and name = 'Минимаркет Арзан' limit 1;
  select id into s_nur from public.stores where company_id = '00000000-0000-0000-0000-000000000001' and name = 'Продукты Нур' limit 1;
  select id into s_vostok from public.stores where company_id = '00000000-0000-0000-0000-000000000001' and name = 'ТД Восток' limit 1;

  insert into public.purchases (company_id, store_id, purchase_number, purchase_date, comment, created_by)
  values
    ('00000000-0000-0000-0000-000000000001', s_aigul, 'PUR-1001', current_date - interval '12 day', 'Первая закупка', '00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000001', s_asel, 'PUR-1002', current_date - interval '8 day', 'Пополнение ассортимента', '00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000001', s_arzan, 'PUR-1003', current_date - interval '4 day', 'Тестовая отгрузка', '00000000-0000-0000-0000-000000000101')
  on conflict (company_id, purchase_number) do nothing;

  select id into p_1001 from public.purchases where company_id = '00000000-0000-0000-0000-000000000001' and purchase_number = 'PUR-1001' limit 1;
  select id into p_1002 from public.purchases where company_id = '00000000-0000-0000-0000-000000000001' and purchase_number = 'PUR-1002' limit 1;
  select id into p_1003 from public.purchases where company_id = '00000000-0000-0000-0000-000000000001' and purchase_number = 'PUR-1003' limit 1;

  insert into public.purchase_items (purchase_id, item_name_snapshot, quantity, unit, unit_price, total_price)
  values
    (p_1001, 'Лиссабон 01', 8, 'm2', 800, 6400),
    (p_1001, 'София 02', 5, 'm2', 1100, 5500),
    (p_1002, 'Black out 03', 7, 'm2', 1300, 9100),
    (p_1002, 'Памела 07', 3, 'm2', 1000, 3000),
    (p_1003, 'Кармен 01', 6, 'm2', 1100, 6600)
  on conflict do nothing;

  insert into public.payments (company_id, store_id, purchase_id, amount, payment_date, payment_method, comment, created_by)
  values
    ('00000000-0000-0000-0000-000000000001', s_aigul, p_1001, 3000, current_date - interval '9 day', 'cash', 'Аванс', '00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000001', s_asel, p_1002, 12100, current_date - interval '5 day', 'bank', 'Полная оплата', '00000000-0000-0000-0000-000000000101')
  on conflict do nothing;

  perform public.recalculate_purchase(p_1001);
  perform public.recalculate_purchase(p_1002);
  perform public.recalculate_purchase(p_1003);

  perform public.recalculate_store(s_aigul);
  perform public.recalculate_store(s_asel);
  perform public.recalculate_store(s_arzan);
  perform public.recalculate_store(s_nur);
  perform public.recalculate_store(s_vostok);
end $$;
