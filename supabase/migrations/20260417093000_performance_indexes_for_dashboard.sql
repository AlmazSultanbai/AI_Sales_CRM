create index if not exists idx_stock_items_company_updated_at
on public.stock_items(company_id, updated_at desc);

create index if not exists idx_stock_movements_company_created_at
on public.stock_movements(company_id, created_at desc);

create index if not exists idx_stock_movements_company_type_created
on public.stock_movements(company_id, movement_type, created_at desc);

create index if not exists idx_purchases_company_store_date
on public.purchases(company_id, store_id, purchase_date desc);

create index if not exists idx_payments_company_store_date
on public.payments(company_id, store_id, payment_date desc);
