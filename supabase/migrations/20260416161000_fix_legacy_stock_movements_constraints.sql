do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_movements'
      and column_name = 'product_id'
  ) then
    begin
      execute 'alter table public.stock_movements alter column product_id drop not null';
    exception
      when undefined_column then null;
    end;

    if exists (
      select 1
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'stock_movements'
        and constraint_name = 'stock_movements_product_id_fkey'
    ) then
      execute 'alter table public.stock_movements drop constraint stock_movements_product_id_fkey';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_movements'
      and column_name = 'notes'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_movements'
      and column_name = 'comment'
  ) then
    execute 'update public.stock_movements set comment = coalesce(comment, notes) where notes is not null';
  end if;
end $$;

