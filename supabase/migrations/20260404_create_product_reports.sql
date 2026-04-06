-- Create product_reports table for user-submitted data quality reports.
-- Safe to run multiple times.

create table if not exists public.product_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  barcode text,
  product_name text not null,
  issue_type text not null check (issue_type in ('missing_ingredients', 'misinformation')),
  details text,
  source_screen text check (source_screen in ('search', 'product'))
);

create index if not exists product_reports_created_at_idx
  on public.product_reports (created_at desc);

create index if not exists product_reports_barcode_idx
  on public.product_reports (barcode);

create index if not exists product_reports_issue_type_idx
  on public.product_reports (issue_type);

create index if not exists product_reports_issue_barcode_idx
  on public.product_reports (issue_type, barcode);

alter table public.product_reports enable row level security;

drop policy if exists product_reports_select_authenticated on public.product_reports;
create policy product_reports_select_authenticated
  on public.product_reports
  for select
  to authenticated
  using (true);

drop policy if exists product_reports_insert_authenticated on public.product_reports;
create policy product_reports_insert_authenticated
  on public.product_reports
  for insert
  to authenticated
  with check (
    user_id is null or user_id = auth.uid()
  );
