alter table if exists public.collection_models
  add column if not exists color_name text;

alter table if exists public.collection_models
  add column if not exists color_hex text;

alter table if exists public.collection_models
  add column if not exists price_per_m2 numeric(12, 2);

alter table if exists public.collection_models
  add column if not exists sku text;

alter table if exists public.collection_models
  add column if not exists is_active boolean not null default true;

alter table if exists public.collection_models
  add column if not exists sort_order int not null default 0;

update public.collection_models m
set color_name = coalesce(m.color_name, 'Темно-синий'),
    color_hex = coalesce(m.color_hex, '#1E3A8A'),
    price_per_m2 = coalesce(m.price_per_m2, c.price_per_m2, 0),
    is_active = coalesce(m.is_active, true)
from public.collections c
where c.id = m.collection_id;

with ordered as (
  select id, row_number() over (partition by collection_id order by model_code) - 1 as rn
  from public.collection_models
)
update public.collection_models m
set sort_order = o.rn
from ordered o
where o.id = m.id and (m.sort_order is null or m.sort_order = 0);

alter table public.collection_models
  alter column color_name set not null;

alter table public.collection_models
  alter column color_hex set not null;

alter table public.collection_models
  alter column price_per_m2 set not null;

alter table public.collection_models
  alter column price_per_m2 set default 0;

create index if not exists idx_collection_models_collection_sort
on public.collection_models(collection_id, sort_order, model_code);
