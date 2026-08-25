-- Код для сканера: штрихкод с упаковки поставщика или QR с нашей этикетки.
-- Поле необязательное, привязывается к позиции при первом сканировании.
alter table public.stock_items
  add column if not exists barcode text;

-- Один код — одна позиция внутри компании; пустые значения не мешают друг другу.
create unique index if not exists stock_items_company_barcode_key
  on public.stock_items (company_id, barcode)
  where barcode is not null;
