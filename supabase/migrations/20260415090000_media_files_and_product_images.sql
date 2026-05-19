alter table if exists public.collections
  add column if not exists image_url text;

alter table if exists public.collection_models
  add column if not exists image_url text;

alter table if exists public.purchase_items
  add column if not exists item_image_url_snapshot text;

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('collection', 'collection_model', 'purchase_item')),
  entity_id uuid not null,
  file_path text not null,
  file_url text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  sort_order int not null default 0,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  uploaded_by uuid references public.users(id) on delete set null
);

create index if not exists idx_media_files_company_entity on public.media_files(company_id, entity_type, entity_id);
create unique index if not exists idx_media_files_primary_per_entity
on public.media_files(company_id, entity_type, entity_id, is_primary)
where is_primary = true;

alter table public.media_files enable row level security;

drop policy if exists "Authenticated can read media files" on public.media_files;
create policy "Authenticated can read media files"
on public.media_files for select to authenticated using (true);

drop policy if exists "Authenticated can write media files" on public.media_files;
create policy "Authenticated can write media files"
on public.media_files for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
