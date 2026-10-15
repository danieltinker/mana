-- Mana, clean schema 7/7: scheduled jobs. Kept apart so it can be held back on its own.
-- Where pg_cron is available (it is on Supabase), it is enabled and three jobs are scheduled:
--   every minute     app.build_rollups()                the dashboards' numbers (minute and day rollups)
--   every day 01:10  app.ensure_event_partitions(2)     next months' event partitions exist before they are needed
-- Elsewhere (the local test cluster) nothing happens here; the tests call the jobs directly.
-- Retention (dropping old event partitions) is NOT scheduled: the period is a decision (supabase/README.md).

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    begin
      grant usage on schema cron to postgres;
      grant all privileges on all tables in schema cron to postgres;
    exception when others then
      raise notice 'cron grants skipped: %', sqlerrm;
    end;
    execute $j$select cron.schedule('mana-build-rollups', '* * * * *', 'select app.build_rollups()')$j$;
    execute $j$select cron.schedule('mana-event-partitions', '10 1 * * *', 'select app.ensure_event_partitions(2)')$j$;
  end if;
end $$;
