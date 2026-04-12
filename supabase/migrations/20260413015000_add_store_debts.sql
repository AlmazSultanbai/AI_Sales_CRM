create table if not exists public.store_debts (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  owner_name text,
  phone text,
  debt_amount numeric(12, 2) not null default 0,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_debts_active on public.store_debts(is_active);
create index if not exists idx_store_debts_amount on public.store_debts(debt_amount desc);
create unique index if not exists idx_store_debts_shop_name on public.store_debts(shop_name);

drop trigger if exists store_debts_set_updated_at on public.store_debts;

create trigger store_debts_set_updated_at
before update on public.store_debts
for each row
execute function public.set_updated_at();

insert into public.store_debts (shop_name, owner_name, phone, debt_amount, note)
values
  ('Магазин Бишкек', 'Айбек', '+996 700 11 22 33', 18500, 'Оплата обещана на этой неделе'),
  ('Салон Жалал-Абад', 'Нуриза', '+996 555 44 55 66', 9200, 'Частичная оплата'),
  ('Точка Ош', 'Руслан', '+996 777 88 99 00', 12600, 'Нужно напомнить по долгу')
on conflict do nothing;

alter table public.store_debts enable row level security;

create policy "Authenticated users can read store debts"
on public.store_debts
for select
to authenticated
using (true);

create policy "Authenticated users can insert store debts"
on public.store_debts
for insert
to authenticated
with check (true);

create policy "Authenticated users can update store debts"
on public.store_debts
for update
to authenticated
using (true)
with check (true);
