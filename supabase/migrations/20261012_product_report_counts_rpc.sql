-- Security: stop exposing product_reports rows (user_id, free-text details) to anon.
-- The app only needs per-barcode counts, so reads go through a SECURITY DEFINER function.
-- Insert policies from 20260404_update_product_reports_rls.sql are kept untouched.
-- Idempotent. NOT applied by CI: run by hand in the Supabase SQL editor.
--
-- Verify after applying:
--   1. select policyname, cmd, roles from pg_policies
--        where schemaname = 'public' and tablename = 'product_reports';
--        -> only the two INSERT policies; no SELECT or ALL policy.
--   2. Anon, no JWT: GET /rest/v1/product_reports?select=id -> [] (or 401), never rows.
--   3. select * from public.product_report_counts(array['<a barcode with reports>']);
--        -> one row: barcode, missing_ingredients_count, misinformation_count.
--   4. In the app: report-count badges (Search, Product) still show; submitting a report
--      (signed in and signed out) still succeeds.

-- Drop every SELECT (and ALL) policy, whatever its name; INSERT policies stay.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'product_reports'
      and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy %I on public.product_reports', pol.policyname);
  end loop;
end $$;

-- Clients only insert (no .select()/returning) and read counts via the RPC below.
revoke select on public.product_reports from anon, authenticated;

create or replace function public.product_report_counts(p_barcodes text[])
returns table (
  barcode text,
  missing_ingredients_count bigint,
  misinformation_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(array_length(p_barcodes, 1), 0) > 100 then
    raise exception 'too many barcodes (max 100)';
  end if;

  return query
  select
    r.barcode,
    count(*) filter (where r.issue_type = 'missing_ingredients'),
    count(*) filter (where r.issue_type = 'misinformation')
  from public.product_reports r
  where r.barcode = any (p_barcodes)
  group by r.barcode;
end;
$$;

revoke all on function public.product_report_counts(text[]) from public;
grant execute on function public.product_report_counts(text[]) to anon, authenticated;
