-- Relax product_reports RLS so anonymous users can submit reports safely.
-- Authenticated users can still submit with their own user_id.

alter table public.product_reports enable row level security;

drop policy if exists product_reports_insert_authenticated on public.product_reports;
drop policy if exists product_reports_select_authenticated on public.product_reports;

-- Allow authenticated and anon clients to read rows (needed for report-count badges).
drop policy if exists product_reports_select_all_clients on public.product_reports;
create policy product_reports_select_all_clients
  on public.product_reports
  for select
  to anon, authenticated
  using (true);

-- Authenticated users: insert allowed when user_id is null or matches auth.uid().
drop policy if exists product_reports_insert_authenticated_own_or_null on public.product_reports;
create policy product_reports_insert_authenticated_own_or_null
  on public.product_reports
  for insert
  to authenticated
  with check (
    user_id is null or user_id = auth.uid()
  );

-- Anonymous users: insert allowed only with null user_id.
drop policy if exists product_reports_insert_anon_null_user on public.product_reports;
create policy product_reports_insert_anon_null_user
  on public.product_reports
  for insert
  to anon
  with check (user_id is null);
