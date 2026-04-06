-- Favorite products saved by user from product and search screens.

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text not null,
  product_name text,
  product_type text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, barcode)
);

create index if not exists favorites_user_created_at_idx
  on public.favorites (user_id, created_at desc);

create index if not exists favorites_barcode_idx
  on public.favorites (barcode);

alter table public.favorites enable row level security;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);
