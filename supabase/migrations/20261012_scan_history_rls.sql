-- Security: scan_history row-level security (own rows only).
-- The table already exists in production (created outside this repo). Columns the app uses:
--   id, user_id, barcode, product_name, scan_date, result.  Owner column = user_id.
-- Idempotent; safe to re-run on the live table. NOT applied by CI: run by hand in the
-- Supabase SQL editor.
--
-- Verify after applying (run each in the SQL editor):
--   1. select relrowsecurity from pg_class where oid = 'public.scan_history'::regclass;
--        -> true
--   2. select policyname, cmd, roles from pg_policies
--        where schemaname = 'public' and tablename = 'scan_history' order by cmd;
--        -> exactly 4 rows (DELETE, INSERT, SELECT, UPDATE), roles {authenticated}.
--           The migration drops every pre-existing policy on the table first (leftover
--           dashboard-made permissive policies would otherwise still grant access), so
--           leftover policies are removed automatically.
--   3. As anon (curl the REST endpoint with only the anon key, no user JWT):
--        GET /rest/v1/scan_history?select=id  -> []  (or 401), never rows.
--   4. Signed in as user A in the app: History shows only A's scans.

alter table if exists public.scan_history enable row level security;

do $$
declare
  pol record;
begin
  if to_regclass('public.scan_history') is null then
    raise notice 'public.scan_history does not exist; skipping policies';
    return;
  end if;

  -- Drop EVERY existing policy (permissive policies are OR-ed, so any leftover could
  -- still expose other users' rows), then recreate the four own-row policies below.
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'scan_history'
  loop
    execute format('drop policy %I on public.scan_history', pol.policyname);
  end loop;

  execute 'drop policy if exists scan_history_select_own on public.scan_history';
  execute 'create policy scan_history_select_own on public.scan_history
             for select to authenticated using (auth.uid() = user_id)';

  execute 'drop policy if exists scan_history_insert_own on public.scan_history';
  execute 'create policy scan_history_insert_own on public.scan_history
             for insert to authenticated with check (auth.uid() = user_id)';

  execute 'drop policy if exists scan_history_update_own on public.scan_history';
  execute 'create policy scan_history_update_own on public.scan_history
             for update to authenticated
             using (auth.uid() = user_id) with check (auth.uid() = user_id)';

  execute 'drop policy if exists scan_history_delete_own on public.scan_history';
  execute 'create policy scan_history_delete_own on public.scan_history
             for delete to authenticated using (auth.uid() = user_id)';
end $$;
