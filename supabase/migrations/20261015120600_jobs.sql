-- Mana, clean schema 8/8: scheduled jobs. Kept apart so it can be held back on its own.
-- Where pg_cron is available (it is on Supabase), it is enabled and three jobs are scheduled:
--   every minute     app.build_rollups()                the dashboards' numbers (minute and day rollups)
--   every day 01:10  app.ensure_event_partitions(2)     next months' event partitions exist before they are needed
--   every day 01:20  app.daily_maintenance()            retention and forgetting: event partitions older than
--                                                      app_config.events_retention_months (13 by default), source salts
--                                                      older than two days, leads' source hashes older than seven days,
--                                                      old staff-invite failure counters
-- Elsewhere (the local test cluster) nothing is scheduled; the tests call the jobs directly.

-- event partitions whose whole month is older than the retention period (the current month and the N before it stay)
create function app.drop_old_event_partitions() returns integer
language plpgsql security definer set search_path = '' as $$
declare months integer := greatest(coalesce((app.cfg('events_retention_months') #>> '{}')::integer, 13), 1);
begin
  return app.drop_event_partitions_before((date_trunc('month', now() at time zone 'UTC') - make_interval(months => months))::date);
end $$;

create function app.daily_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'UTC')::date; salts integer; hashes integer; failures integer; partitions integer;
begin
  delete from app.source_salts where day < today - 1;
  get diagnostics salts = row_count;
  update public.leads set source_hash = null where source_hash is not null and created_at < now() - interval '7 days';
  get diagnostics hashes = row_count;
  delete from app.staff_invite_failures where day < today - 7;
  get diagnostics failures = row_count;
  partitions := app.drop_old_event_partitions();
  return jsonb_build_object('ok', true, 'salts', salts, 'leadHashes', hashes, 'inviteFailures', failures, 'partitions', partitions);
end $$;
revoke execute on function app.drop_old_event_partitions(), app.daily_maintenance() from public, anon, authenticated;

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
    execute $j$select cron.schedule('mana-daily-maintenance', '20 1 * * *', 'select app.daily_maintenance()')$j$;
  end if;
end $$;
