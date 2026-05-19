alter table if exists public.stock_items
add column if not exists sale_price_per_m2 numeric(12, 2);

create index if not exists idx_stock_items_company_sale_price
on public.stock_items(company_id, sale_price_per_m2);
