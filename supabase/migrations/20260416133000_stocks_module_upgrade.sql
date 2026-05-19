do $$
begin
  alter type movement_type add value if not exists 'adjustment';
exception
  when duplicate_object then null;
end $$;

alter table if exists public.stock_items add column if not exists material_name text;
alter table if exists public.stock_items add column if not exists model_code text;
alter table if exists public.stock_items add column if not exists color_name text;
alter table if exists public.stock_items add column if not exists sku text;
alter table if exists public.stock_items add column if not exists photo_url text;
alter table if exists public.stock_items add column if not exists quantity_m2 numeric(12, 2) not null default 0;
alter table if exists public.stock_items add column if not exists purchase_price_per_m2 numeric(12, 2) not null default 0;
alter table if exists public.stock_items add column if not exists low_stock_threshold numeric(12, 2) not null default 10;
alter table if exists public.stock_items add column if not exists last_movement_at timestamptz;

alter table if exists public.stock_movements add column if not exists quantity_m2 numeric(12, 2);
alter table if exists public.stock_movements add column if not exists unit_price numeric(12, 2);
alter table if exists public.stock_movements add column if not exists total_amount numeric(12, 2);
alter table if exists public.stock_movements add column if not exists supplier_name text;
alter table if exists public.stock_movements add column if not exists source_store_id uuid references public.stores(id) on delete set null;
alter table if exists public.stock_movements add column if not exists destination_store_id uuid references public.stores(id) on delete set null;
alter table if exists public.stock_movements add column if not exists movement_date date not null default current_date;

update public.stock_items
set quantity_m2 = coalesce(quantity_m2, quantity, 0),
    last_movement_at = coalesce(last_movement_at, updated_at, created_at)
where true;

update public.stock_items si
set material_name = coalesce(si.material_name, src.collection_name),
    model_code = coalesce(si.model_code, src.model_code),
    color_name = coalesce(si.color_name, src.model_color, 'Не указан'),
    photo_url = coalesce(si.photo_url, src.model_image_url, src.collection_image_url),
    sku = coalesce(
      nullif(si.sku, ''),
      nullif(src.model_sku, ''),
      regexp_replace(lower(src.collection_name), '\s+', '-', 'g') || '-' || coalesce(src.model_code, '00')
    )
from (
  select
    c.id as collection_id,
    c.name as collection_name,
    c.image_url as collection_image_url,
    cm.id as model_id,
    cm.model_code as model_code,
    cm.color_name as model_color,
    cm.image_url as model_image_url,
    cm.sku as model_sku
  from public.collections c
  left join public.collection_models cm on cm.collection_id = c.id
) src
where si.collection_id = src.collection_id
  and si.collection_model_id is not distinct from src.model_id;

update public.stock_movements
set quantity_m2 = coalesce(quantity_m2, quantity, 0),
    movement_date = coalesce(movement_date, created_at::date),
    total_amount = coalesce(total_amount, coalesce(unit_price, 0) * coalesce(quantity_m2, quantity, 0))
where true;

create index if not exists idx_stock_items_company_sku on public.stock_items(company_id, sku);
create index if not exists idx_stock_items_company_qty on public.stock_items(company_id, quantity_m2);
create index if not exists idx_stock_items_company_last_move on public.stock_items(company_id, last_movement_at desc);
create index if not exists idx_stock_items_company_collection_model on public.stock_items(company_id, collection_id, collection_model_id);
create index if not exists idx_stock_movements_company_date on public.stock_movements(company_id, movement_date desc);
create index if not exists idx_stock_movements_item_date on public.stock_movements(stock_item_id, created_at desc);
