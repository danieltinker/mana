-- Mana, clean schema 5/8: first-party events and their rollups (F10, D22). No personal data, no cookies, no ids of
-- people: an event is a name, a venue, a time, a dedupe id and closed properties (packages/contracts/src/events.ts).
--
-- Flow: track_events (guests) and app.emit (the database itself) insert into public.events (partitioned by month, in
-- event time) and into app.rollup_queue in the same transaction. app.build_rollups() (every minute) moves the queue
-- into rollups_minute and rollups_day with DELETE ... RETURNING, so every event is counted exactly once even when its
-- transaction commits late; dashboards read the rollups and subscribe to them through Realtime.

-- ---------------------------------------------------------------- the contract, as data (compared with the contracts package in supabase/tests)
create function app.event_spec() returns jsonb language sql immutable set search_path = '' as $$
  select '{
    "menu_opened": {"src": "src", "lang": "lang", "revision": "count"},
    "dish_viewed": {"dishId": "uuid"},
    "addon_chosen": {"dishId": "uuid", "groupId": "uuid", "optionId": "uuid", "parentOptionId": "uuid?"},
    "basket_added": {"dishId": "uuid", "qty": "qty", "fromSuggestion": "bool"},
    "suggestion_shown": {"ruleId": "uuid", "trigger": "trigger", "dishId": "uuid?"},
    "suggestion_accepted": {"ruleId": "uuid", "trigger": "trigger", "dishId": "uuid?"},
    "suggestion_dismissed": {"ruleId": "uuid", "trigger": "trigger", "dishId": "uuid?"},
    "onboarding_step_done": {"step": "step"},
    "import_parsed": {"importId": "uuid", "source": "import_source", "sections": "count", "dishes": "count", "exceptions": "count"},
    "menu_published": {"revision": "count"}
  }'::jsonb
$$;

create function app.guest_events() returns text[] language sql immutable set search_path = '' as $$
  select array['menu_opened', 'dish_viewed', 'addon_chosen', 'basket_added', 'suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed']
$$;

create function app.personal_keys() returns text[] language sql immutable set search_path = '' as $$
  select array['name', 'firstname', 'lastname', 'fullname', 'phone', 'mobile', 'tel', 'email', 'mail', 'note', 'notes', 'comment', 'message',
               'address', 'card', 'cardnumber', 'pan', 'cvv', 'cvc', 'expiry', 'iban', 'payment', 'paymentid', 'token', 'ip', 'useragent',
               'userid', 'user', 'visitorid', 'sessionid', 'deviceid', 'cookie', 'location', 'lat', 'lng']
$$;

create function app.uuid_ok(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'string' then (p #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' else false end
$$;

create function app.prop_ok(p_kind text, p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case p_kind
    when 'uuid' then app.uuid_ok(p)
    when 'uuid?' then p = 'null'::jsonb or app.uuid_ok(p)
    when 'lang' then p in ('"he"'::jsonb, '"en"'::jsonb)
    when 'src' then p in ('"qr"'::jsonb, '"link"'::jsonb)
    when 'count' then case when jsonb_typeof(p) = 'number' and p::text ~ '^[0-9]{1,7}$' then p::text::bigint <= 1000000 else false end
    when 'qty' then case when jsonb_typeof(p) = 'number' and p::text ~ '^[0-9]{1,2}$' then p::text::integer between 1 and 50 else false end
    when 'bool' then jsonb_typeof(p) = 'boolean'
    when 'trigger' then p in ('"sheet"'::jsonb, '"add"'::jsonb, '"checkout"'::jsonb)
    when 'step' then jsonb_typeof(p) = 'string' and (p #>> '{}') in ('venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish')
    when 'import_source' then jsonb_typeof(p) = 'string' and (p #>> '{}') in ('scan', 'paste', 'wolt_screenshots', 'wolt_text')
    else false end
$$;

-- The rollup keys an event adds one to: '' (the total) and one per dashboard dimension; rollupKeys() in the contracts.
create function app.event_keys(p_name text, p jsonb) returns text[] language sql immutable set search_path = '' as $$
  select array[''] || case p_name
    when 'menu_opened' then array_remove(array['src:' || lower(p->>'src'), 'lang:' || lower(p->>'lang')], null)
    when 'dish_viewed' then array_remove(array['dish:' || lower(p->>'dishId')], null)
    when 'addon_chosen' then array_remove(array['dish:' || lower(p->>'dishId'), 'option:' || lower(p->>'optionId')], null)
    when 'basket_added' then array_remove(array['dish:' || lower(p->>'dishId'), case when p->'fromSuggestion' = 'true'::jsonb then 'from:suggestion' end], null)
    when 'suggestion_shown' then array_remove(array['rule:' || lower(p->>'ruleId'), 'trigger:' || lower(p->>'trigger')], null)
    when 'suggestion_accepted' then array_remove(array['rule:' || lower(p->>'ruleId'), 'trigger:' || lower(p->>'trigger')], null)
    when 'suggestion_dismissed' then array_remove(array['rule:' || lower(p->>'ruleId'), 'trigger:' || lower(p->>'trigger')], null)
    when 'onboarding_step_done' then array_remove(array['step:' || lower(p->>'step')], null)
    when 'import_parsed' then array_remove(array['source:' || lower(p->>'source')], null)
    else '{}'::text[] end
$$;

-- ---------------------------------------------------------------- raw events: partitioned by month of event time
create table public.events (
  id uuid not null,
  venue_id uuid not null references public.venues (id) on delete restrict,
  name text not null check (name in ('menu_opened', 'dish_viewed', 'addon_chosen', 'basket_added', 'suggestion_shown', 'suggestion_accepted',
                                     'suggestion_dismissed', 'onboarding_step_done', 'import_parsed', 'menu_published')),
  at timestamptz not null,
  received_at timestamptz not null default now(),
  source text not null check (source in ('guest', 'server')),
  demo boolean not null default false,
  props jsonb not null check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 2000),
  primary key (at, id)
) partition by range (at);
alter table public.events enable row level security;
comment on table public.events is 'Raw first-party events, partitioned by month (partitions live in schema app). No personal data by construction.';
comment on column public.events.demo is 'Copied from venues.is_demo when stored; real totals exclude demo traffic.';
create index events_venue_idx on public.events (venue_id, at desc);

-- the safety net: an event outside every monthly partition lands here instead of failing (it should stay empty)
create table app.events_default partition of public.events default;
alter table app.events_default enable row level security;

-- dedupe: an event id is stored once, whatever its time (kept 3 days; events older than 48 h are refused anyway)
create table app.event_ids (
  id uuid primary key,
  seen_at timestamptz not null default now()
);
alter table app.event_ids enable row level security;
create index event_ids_seen_idx on app.event_ids (seen_at);

-- what the rollup job has not counted yet
create table app.rollup_queue (
  event_id uuid primary key,
  venue_id uuid not null,
  name text not null,
  at timestamptz not null,
  demo boolean not null,
  props jsonb not null
);
alter table app.rollup_queue enable row level security;

-- per-source and per-venue caps (the counters behind "a script cannot inflate the numbers")
create table app.event_counters (
  key text not null,
  window_start timestamptz not null,
  n integer not null default 0,
  primary key (key, window_start)
);
alter table app.event_counters enable row level security;

-- the days a venue hit its daily cap (events past it are dropped and counted here): the dashboards flag those days
create table app.event_capped_days (
  venue_id uuid not null,
  day date not null,
  first_at timestamptz not null default now(),
  dropped bigint not null default 0,
  primary key (venue_id, day)
);
alter table app.event_capped_days enable row level security;

-- server events that happen once per (venue, key): the first time an onboarding step is done
create table app.once_events (
  venue_id uuid not null,
  name text not null,
  key text not null,
  at timestamptz not null default now(),
  primary key (venue_id, name, key)
);
alter table app.once_events enable row level security;

create table app.rollup_state (
  id boolean primary key default true check (id),
  last_run_at timestamptz,
  last_count integer not null default 0
);
alter table app.rollup_state enable row level security;
insert into app.rollup_state (id) values (true);

-- ---------------------------------------------------------------- rollups the dashboards read (and subscribe to)
-- Each has an opaque uuid primary key: a Realtime DELETE payload carries only the primary key, and it must not name a
-- venue, a dish or a rule. The natural key is a unique constraint (the rollup job's ON CONFLICT target).
create table public.rollups_minute (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  bucket timestamptz not null,
  name text not null,
  key text not null default '',
  demo boolean not null default false,
  n bigint not null default 0 check (n >= 0),
  constraint rollups_minute_natural unique (venue_id, bucket, name, key, demo)
);
alter table public.rollups_minute enable row level security;
comment on table public.rollups_minute is 'Counts per venue per minute (UTC bucket) per event name and key; kept 35 days.';
create index rollups_minute_bucket_idx on public.rollups_minute (bucket desc, name) where key = '';

create table public.rollups_day (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  day date not null,
  name text not null,
  key text not null default '',
  demo boolean not null default false,
  n bigint not null default 0 check (n >= 0),
  constraint rollups_day_natural unique (venue_id, day, name, key, demo)
);
alter table public.rollups_day enable row level security;
comment on column public.rollups_day.day is 'The venue''s local date (venues.time_zone).';
create index rollups_day_day_idx on public.rollups_day (day desc, name) where key = '';

-- ---------------------------------------------------------------- partitions
create function app.ensure_event_partitions(p_months_ahead integer default 2) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  m date;
  lo timestamptz;
  hi timestamptz;
  tname text;
  moving jsonb;
  made integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('mana:event_partitions'));
  for i in -1 .. greatest(p_months_ahead, 0) loop
    m := (date_trunc('month', now() at time zone 'UTC') + make_interval(months => i))::date;
    lo := m::timestamp at time zone 'UTC';
    hi := (m + interval '1 month')::timestamp at time zone 'UTC';
    tname := 'events_y' || to_char(m, 'YYYY') || 'm' || to_char(m, 'MM');
    continue when exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'app' and c.relname = tname);
    -- rows that fell into the default partition for this month move into the new one
    with moved as (delete from app.events_default where at >= lo and at < hi returning *)
    select coalesce(jsonb_agg(to_jsonb(moved)), '[]'::jsonb) into moving from moved;
    execute format('create table app.%I partition of public.events for values from (%L) to (%L)', tname, lo, hi);
    execute format('alter table app.%I enable row level security', tname);
    insert into public.events select * from jsonb_populate_recordset(null::public.events, moving);
    made := made + 1;
  end loop;
  return made;
end $$;

-- Retention (not scheduled: the period is a decision, app_config.event_retention_months, see supabase/README.md).
create function app.drop_event_partitions_before(p_month date) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace s on s.oid = c.relnamespace
    where i.inhparent = 'public.events'::regclass and s.nspname = 'app' and c.relname ~ '^events_y[0-9]{4}m[0-9]{2}$'
      and to_date(substr(c.relname, 9, 4) || substr(c.relname, 14, 2), 'YYYYMM') < date_trunc('month', p_month)::date
  loop
    execute format('drop table app.%I', r.relname);
    n := n + 1;
  end loop;
  return n;
end $$;

select app.ensure_event_partitions(2);

-- ---------------------------------------------------------------- storing an event (shared by track_events and app.emit)
create function app.store_event(p_id uuid, p_venue uuid, p_name text, p_at timestamptz, p_source text, p_demo boolean, p_props jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.event_ids (id) values (p_id) on conflict do nothing;
  if not found then return false; end if;
  insert into public.events (id, venue_id, name, at, source, demo, props) values (p_id, p_venue, p_name, p_at, p_source, p_demo, p_props);
  insert into app.rollup_queue (event_id, venue_id, name, at, demo, props) values (p_id, p_venue, p_name, p_at, p_demo, p_props);
  return true;
end $$;

-- the database's own events (publish, onboarding, import): never from a client
create function app.emit(p_venue uuid, p_name text, p_props jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.store_event(gen_random_uuid(), p_venue, p_name, now(), 'server',
                          coalesce((select v.is_demo from public.venues v where v.id = p_venue), false), p_props);
end $$;

create function app.emit_onboarding() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'done' and (tg_op = 'INSERT' or old.state <> 'done') then
    insert into app.once_events (venue_id, name, key) values (new.venue_id, 'onboarding_step_done', new.step) on conflict do nothing;
    if found then perform app.emit(new.venue_id, 'onboarding_step_done', jsonb_build_object('step', new.step)); end if;
  end if;
  return null;
end $$;
create trigger onboarding_emit after insert or update of state on public.onboarding_progress for each row execute function app.emit_onboarding();

create function app.emit_import() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'parsed' and (tg_op = 'INSERT' or old.status <> 'parsed') then
    perform app.emit(new.venue_id, 'import_parsed', jsonb_build_object(
      'importId', new.id, 'source', new.source,
      'sections', case when jsonb_typeof(new.parsed->'sections') = 'array' then jsonb_array_length(new.parsed->'sections') else 0 end,
      'dishes', coalesce((select sum(case when jsonb_typeof(s->'dishes') = 'array' then jsonb_array_length(s->'dishes') else 0 end)
                          from jsonb_array_elements(case when jsonb_typeof(new.parsed->'sections') = 'array' then new.parsed->'sections' else '[]' end) s), 0),
      'exceptions', jsonb_array_length(new.exceptions)));
  end if;
  return null;
end $$;
create trigger menu_imports_emit after insert or update of status on public.menu_imports for each row execute function app.emit_import();

-- ---------------------------------------------------------------- the rollup job (scheduled every minute where pg_cron exists)
create function app.build_rollups() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('mana:build_rollups')) then
    return jsonb_build_object('ok', false, 'code', 'busy');
  end if;
  -- data-modifying CTEs always run to completion; both inserts read the same deleted batch
  with q as (delete from app.rollup_queue returning venue_id, name, at, demo, props),
  k as (select q.venue_id, q.name, q.at, q.demo, key from q cross join lateral unnest(app.event_keys(q.name, q.props)) as key),
  m as (
    insert into public.rollups_minute as r (venue_id, bucket, name, key, demo, n)
    select k.venue_id, date_trunc('minute', k.at), k.name, k.key, k.demo, count(*) from k group by 1, 2, 3, 4, 5
    on conflict on constraint rollups_minute_natural do update set n = r.n + excluded.n),
  d as (
    insert into public.rollups_day as r (venue_id, day, name, key, demo, n)
    select k.venue_id, (k.at at time zone v.time_zone)::date, k.name, k.key, k.demo, count(*)
    from k join public.venues v on v.id = k.venue_id group by 1, 2, 3, 4, 5
    on conflict on constraint rollups_day_natural do update set n = r.n + excluded.n)
  select count(*) into n from q;

  update app.rollup_state set last_run_at = now(), last_count = n where id;
  delete from public.rollups_minute where bucket < now() - interval '35 days';
  delete from app.event_ids where seen_at < now() - interval '3 days';
  delete from app.event_counters where window_start < now() - interval '3 days';
  return jsonb_build_object('ok', true, 'events', n);
end $$;
