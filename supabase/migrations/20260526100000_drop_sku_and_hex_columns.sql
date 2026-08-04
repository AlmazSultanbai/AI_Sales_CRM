-- Physically remove legacy SKU/HEX fields after app migration away from them.
-- Safe to run multiple times.

drop index if exists idx_stock_items_company_sku;
drop index if exists public.idx_stock_items_company_sku;

alter table if exists public.order_items
  drop column if exists sku_snapshot;

alter table if exists public.stock_items
  drop column if exists sku;

alter table if exists public.collection_models
  drop column if exists sku,
  drop column if exists color_hex;
