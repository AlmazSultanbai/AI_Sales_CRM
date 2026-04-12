create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_category') then
    create type product_category as enum ('material', 'profile', 'cap', 'fixer');
  end if;

  if not exists (select 1 from pg_type where typname = 'unit_type') then
    create type unit_type as enum ('m2', 'meter', 'piece', 'pack');
  end if;
end $$;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category product_category not null,
  title text not null,
  collection_name text,
  model text,
  color text,
  price numeric(12, 2) not null default 0,
  unit unit_type not null,
  stock numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_material_rule check (
    (category = 'material' and collection_name is not null and model is not null)
    or
    (category <> 'material')
  ),
  constraint products_non_material_rule check (
    (category in ('profile', 'cap', 'fixer') and color is not null)
    or
    (category = 'material')
  )
);

create index if not exists idx_products_category on products(category);
create index if not exists idx_products_collection on products(collection_name);
create index if not exists idx_products_color on products(color);
create unique index if not exists idx_products_unique_item
on products(category, title, unit);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on products;

create trigger products_set_updated_at
before update on products
for each row
execute function set_updated_at();

insert into products (category, title, collection_name, model, color, price, unit, stock)
values
  ('material', 'Лиссабон 01', 'Лиссабон', '01', null, 800, 'm2', 0),
  ('material', 'Лиссабон 03', 'Лиссабон', '03', null, 800, 'm2', 0),
  ('material', 'Лиссабон 04', 'Лиссабон', '04', null, 800, 'm2', 0),
  ('material', 'Лиссабон 05', 'Лиссабон', '05', null, 800, 'm2', 0),
  ('material', 'Лиссабон 06', 'Лиссабон', '06', null, 800, 'm2', 0),
  ('material', 'Лиссабон 11', 'Лиссабон', '11', null, 800, 'm2', 0),
  ('material', 'Лиссабон 12', 'Лиссабон', '12', null, 800, 'm2', 0),
  ('material', 'Лиссабон 13', 'Лиссабон', '13', null, 800, 'm2', 0),
  ('material', 'Лиссабон 14', 'Лиссабон', '14', null, 800, 'm2', 0),
  ('material', 'Лиссабон 17', 'Лиссабон', '17', null, 800, 'm2', 0),
  ('material', 'София 01', 'София', '01', null, 1100, 'm2', 0),
  ('material', 'София 02', 'София', '02', null, 1100, 'm2', 0),
  ('material', 'София 03', 'София', '03', null, 1100, 'm2', 0),
  ('material', 'София 04', 'София', '04', null, 1100, 'm2', 0),
  ('material', 'София 05', 'София', '05', null, 1100, 'm2', 0),
  ('material', 'Кармен 01', 'Кармен', '01', null, 1100, 'm2', 0),
  ('material', 'Кармен 02', 'Кармен', '02', null, 1100, 'm2', 0),
  ('material', 'Кармен 03', 'Кармен', '03', null, 1100, 'm2', 0),
  ('material', 'Кармен 05', 'Кармен', '05', null, 1100, 'm2', 0),
  ('material', 'Памела 01', 'Памела', '01', null, 1000, 'm2', 0),
  ('material', 'Памела 07', 'Памела', '07', null, 1000, 'm2', 0),
  ('material', 'Памела 09', 'Памела', '09', null, 1000, 'm2', 0),
  ('material', 'Black out 01', 'Black out', '01', null, 1300, 'm2', 0),
  ('material', 'Black out 02', 'Black out', '02', null, 1300, 'm2', 0),
  ('material', 'Black out 03', 'Black out', '03', null, 1300, 'm2', 0),
  ('material', 'Black out 04', 'Black out', '04', null, 1300, 'm2', 0),
  ('material', 'Black out 05', 'Black out', '05', null, 1300, 'm2', 0),
  ('material', 'Black out 06', 'Black out', '06', null, 1300, 'm2', 0),
  ('profile', 'Профиль антрацит', null, null, 'антрацит', 800, 'meter', 0),
  ('profile', 'Профиль белый', null, null, 'белый', 800, 'meter', 0),
  ('profile', 'Профиль коричневый', null, null, 'коричневый', 800, 'meter', 0),
  ('profile', 'Профиль серый', null, null, 'серый', 800, 'meter', 0),
  ('cap', 'Заглушка антрацит', null, null, 'антрацит', 800, 'piece', 0),
  ('cap', 'Заглушка белый', null, null, 'белый', 800, 'piece', 0),
  ('cap', 'Заглушка коричневый', null, null, 'коричневый', 800, 'piece', 0),
  ('cap', 'Заглушка серый', null, null, 'серый', 800, 'piece', 0),
  ('fixer', 'Фиксатор антрацит', null, null, 'антрацит', 800, 'piece', 0),
  ('fixer', 'Фиксатор белый', null, null, 'белый', 800, 'piece', 0),
  ('fixer', 'Фиксатор коричневый', null, null, 'коричневый', 800, 'piece', 0),
  ('fixer', 'Фиксатор серый', null, null, 'серый', 800, 'piece', 0)
on conflict do nothing;
