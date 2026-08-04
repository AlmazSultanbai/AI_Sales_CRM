-- Keep order payments as an auditable ledger. The order aggregates are refreshed
-- by triggers so UI retries and concurrent requests cannot create a negative debt.

do $$
begin
  create type public.order_payment_status as enum ('unpaid', 'partial', 'paid');
exception
  when duplicate_object then null;
end $$;

alter table public.orders
  add column if not exists paid_amount numeric(14, 2) not null default 0,
  add column if not exists debt_amount numeric(14, 2) not null default 0,
  add column if not exists payment_status public.order_payment_status not null default 'unpaid';

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank', 'card', 'transfer')),
  comment text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_payments_company_order_date
  on public.order_payments(company_id, order_id, payment_date desc);

create or replace function public.refresh_order_payment_summary(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
begin
  select total_amount into v_total
  from public.orders
  where id = p_order_id;

  if not found then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.order_payments
  where order_id = p_order_id;

  update public.orders
  set
    paid_amount = v_paid,
    debt_amount = greatest(v_total - v_paid, 0),
    payment_status = case
      when v_total <= 0 then 'unpaid'::public.order_payment_status
      when v_paid >= v_total then 'paid'::public.order_payment_status
      when v_paid > 0 then 'partial'::public.order_payment_status
      else 'unpaid'::public.order_payment_status
    end,
    updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.validate_order_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14, 2);
  v_existing_paid numeric(14, 2);
begin
  select total_amount into v_total
  from public.orders
  where id = new.order_id
  for update;

  if not found then
    raise exception 'Заказ не найден';
  end if;

  select coalesce(sum(amount), 0) into v_existing_paid
  from public.order_payments
  where order_id = new.order_id
    and (tg_op <> 'UPDATE' or id <> new.id);

  if v_existing_paid + new.amount > v_total + 0.01 then
    raise exception 'Сумма оплаты не может превышать остаток долга';
  end if;

  return new;
end;
$$;

create or replace function public.after_order_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_order_payment_summary(old.order_id);
    return old;
  end if;

  perform public.refresh_order_payment_summary(new.order_id);
  return new;
end;
$$;

create or replace function public.after_order_total_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_order_payment_summary(new.id);
  return new;
end;
$$;

drop trigger if exists trg_validate_order_payment_amount on public.order_payments;
create trigger trg_validate_order_payment_amount
before insert or update of amount, order_id on public.order_payments
for each row execute function public.validate_order_payment_amount();

drop trigger if exists trg_after_order_payment_change on public.order_payments;
create trigger trg_after_order_payment_change
after insert or update or delete on public.order_payments
for each row execute function public.after_order_payment_change();

drop trigger if exists trg_after_order_total_change on public.orders;
create trigger trg_after_order_total_change
after update of total_amount on public.orders
for each row execute function public.after_order_total_change();

-- Existing orders did not have a payment ledger. Keep their balance equal to the
-- full order amount; future payments and newly created prepayments are recorded
-- in order_payments and recalculate these fields automatically.
update public.orders
set
  paid_amount = 0,
  debt_amount = greatest(total_amount, 0),
  payment_status = case
    when total_amount > 0 then 'unpaid'::public.order_payment_status
    else 'unpaid'::public.order_payment_status
  end
where paid_amount = 0 and debt_amount = 0;
