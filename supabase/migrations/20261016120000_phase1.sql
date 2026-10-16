-- Mana, clean schema 9: phase 1 (ADR-008, ADR-006). The eight files before this one are applied to the project `mana`
-- and are never edited again: every change to their objects lives here, as create-or-replace and alter statements.
--
--   * settings: import_caps, case_caps, import_raw_retention_days
--   * menu_imports: raw_purged_at; the raw input is purged after the retention period; clients read it only through a
--     column list without raw_text and change it only through the import RPCs; the scanner (service role) marks
--     `failed` and purges
--   * addon_groups.limits_confirmed (an import's guessed limits wait for the owner)
--   * the onboarding steps the database marks done itself (venue, menu, review, publish)
--   * app.log takes a staff caller's reason from mana.reason; act_for_owner's availability.set and onboarding.set run
--     the owner's internals
--   * the SQL twins of the contracts (@mana/contracts): the import key, the draft validator, the exceptions, the
--     decisions, the plan; every phase-1 input's validator; supabase/tests compares each pair on the same inputs
--   * the phase-1 RPCs: create_import, claim_import_scan, save_import_draft, apply_import, discard_import,
--     set_onboarding_step, open_case, ops_update_case, set_availability, restore_today, export_menu, venue_activity,
--     ops_venues, ops_venue, ops_analytics, ops_set_demo, ops_revision (the stored menu Halom approves),
--     save_addon_group (a group and its options as one); my_dashboard v2; ops_overview on the same row builder
--   * the simulator's follow-ups (PR #5): via labels, the demo filter on suggestions, until in whole minutes,
--     track_events names its duplicates and capped events by index
--   * an index on every foreign key, and app.unindexed_foreign_keys() so a later migration cannot add one without
--   * every grant at the end, and app.audit_grants()'s intended list
--
-- Statements Supabase's tooling may treat as destructive are marked "-- DESTRUCTIVE-LOOKING:" with what they do. None
-- of them deletes a row: they drop and re-add two check constraints and two policies, revoke grants that are given
-- back narrower (or re-granted by name at the end), and clear raw import input past its retention (the daily job).

-- ---------------------------------------------------------------- settings (Daniel's to change; accepted 16 Oct as starting values)
insert into public.app_config (key, value) values
  -- per venue per (local) day: imports created, and image reads claimed by the scanner (each a paid model call)
  ('import_caps', '{"per_venue_day": 20, "scans_per_venue_day": 10}'),
  -- per venue per (local) day: support cases opened from the client app
  ('case_caps', '{"per_venue_day": 10}'),
  -- days an applied, discarded or failed import keeps its raw input (pasted text, screenshots) before the purge
  ('import_raw_retention_days', '30')
on conflict (key) do nothing;

-- ================================================================ helpers the twins share (what the contracts' JavaScript does)
-- Every text cap counts code points (char_length), as the contracts do (orchestrator, 16 Oct). NUL and lone surrogates
-- never reach the database: the contracts refuse them (text_invalid), and PostgreSQL cannot store either.

-- String.prototype.trim()'s white space (WhiteSpace and LineTerminator): what `q.trim() === ''` sees as empty
create function app.js_blank(p text) returns boolean language sql immutable set search_path = '' as
$$ select p ~ '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*$' $$;

-- Number.isSafeInteger on a JSON value
create function app.js_int(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'number'
    then (p::text)::numeric = trunc((p::text)::numeric) and abs((p::text)::numeric) <= 9007199254740991 else false end
$$;

create function app.js_str(p jsonb) returns boolean language sql immutable set search_path = '' as
$$ select coalesce(jsonb_typeof(p) = 'string', false) $$;

create function app.js_obj(p jsonb) returns boolean language sql immutable set search_path = '' as
$$ select coalesce(jsonb_typeof(p) = 'object', false) $$;

create function app.js_null(p jsonb) returns boolean language sql immutable set search_path = '' as
$$ select coalesce(p = 'null'::jsonb, false) $$;

-- oneOf(list, v): a string on the list
create function app.one_of(p jsonb, p_list text[]) returns boolean language sql immutable set search_path = '' as
$$ select case when jsonb_typeof(p) = 'string' then (p #>> '{}') = any (p_list) else false end $$;

-- isUuid (case-insensitive), as text
create function app.as_uuid(p text) returns uuid language sql immutable set search_path = '' as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;

-- an issue with a message (the plan's exception_unresolved and choice_invalid name the exception in it)
create function app.issue(p_code text, p_path text, p_message text) returns jsonb language sql immutable set search_path = '' as
$$ select jsonb_build_array(jsonb_build_object('code', p_code, 'path', p_path, 'message', p_message)) $$;

-- isRelPath (1–300 characters, no leading "/", no "..", "//", ":" or backslash)
create function app.js_rel_path(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'string' then
    char_length(p #>> '{}') between 1 and 300 and left(p #>> '{}', 1) <> '/' and position('..' in (p #>> '{}')) = 0
    and position('//' in (p #>> '{}')) = 0 and position(':' in (p #>> '{}')) = 0 and position(E'\\' in (p #>> '{}')) = 0
  else false end
$$;

-- isLocalDate: 'YYYY-MM-DD' that exists, in the years 2000 to 2100
create function app.js_local_date(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if jsonb_typeof(p) is distinct from 'string' then return false; end if;
  s := p #>> '{}';
  if s !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' or left(s, 4)::integer not between 2000 and 2100 then return false; end if;
  return to_char(make_date(left(s, 4)::integer, substr(s, 6, 2)::integer, substr(s, 9, 2)::integer), 'YYYY-MM-DD') = s;
exception when others then
  return false;
end $$;

-- An instant with an explicit offset (EVENT_TIME_RE) as Date.parse reads it, to the millisecond; null when it is not one
create function app.js_instant(p jsonb) returns timestamptz language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if jsonb_typeof(p) is distinct from 'string' then return null; end if;
  s := p #>> '{}';
  if s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then return null; end if;
  return date_trunc('milliseconds', s::timestamptz);
exception when others then
  return null;
end $$;

-- ================================================================ closed lists the contracts hold too (compared in supabase/tests)
create function app.onboarding_steps() returns text[] language sql immutable set search_path = '' as
$$ select array['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish'] $$;

-- ONBOARDING_AUTO_STEPS: the steps only the database marks done
create function app.onboarding_auto_steps() returns text[] language sql immutable set search_path = '' as
$$ select array['venue', 'menu', 'review', 'publish'] $$;

-- OPS_WARNINGS, in the order a venue's row lists them
create function app.ops_warnings() returns text[] language sql immutable set search_path = '' as $$
  select array['awaiting_review', 'stuck_step_2d', 'not_published_2d', 'no_publish_7d', 'import_failed', 'case_open', 'case_waiting', 'events_capped']
$$;

-- NUDGE_CODES, in the order the dashboard shows them
create function app.nudge_codes() returns text[] language sql immutable set search_path = '' as $$
  select array['approval_pending', 'onboarding_step', 'import_waiting', 'case_waiting_owner', 'dish_no_price', 'dish_no_photo', 'group_without_limits']
$$;

-- EVENT_NAMES (guest and server events; the reserved later names are not counted)
create function app.event_names() returns text[] language sql immutable set search_path = '' as $$
  select array['menu_opened', 'dish_viewed', 'addon_chosen', 'basket_added', 'suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed',
               'onboarding_step_done', 'import_parsed', 'menu_published']
$$;

-- The contracts' LIMITS an import plans against (the menu tables' triggers enforce app_config.limits on top)
create function app.import_limits() returns jsonb language sql immutable set search_path = '' as
$$ select '{"sections": 40, "dishes": 400, "addonGroups": 200, "optionsPerGroup": 30, "groupsPerDish": 8}'::jsonb $$;

-- IMPORT_EXCEPTIONS (in this order) with their severity, and EXCEPTION_CHOICES (a check's default is its first)
create function app.import_exception_codes() returns text[] language sql immutable set search_path = '' as $$
  select array['price_missing', 'price_unreadable', 'option_price_unreadable', 'limits_guessed', 'limits_unreachable', 'section_duplicate',
               'dish_duplicate', 'name_missing_lang', 'translation_check', 'nesting_too_deep', 'too_many', 'photo_rights_unknown', 'allergens_check']
$$;

create function app.import_exception_severity(p_code text) returns text language sql immutable set search_path = '' as $$
  select case when p_code in ('limits_guessed', 'name_missing_lang', 'translation_check', 'photo_rights_unknown', 'allergens_check') then 'check' else 'fix' end
$$;

create function app.import_choices() returns jsonb language sql immutable set search_path = '' as $$
  select '{
    "price_missing": ["no_price", "skip"], "price_unreadable": ["no_price", "skip"], "option_price_unreadable": ["free", "skip"],
    "limits_guessed": ["accept", "skip"], "limits_unreachable": ["clamp", "skip"], "section_duplicate": ["merge", "keep_both"],
    "dish_duplicate": ["skip", "keep_both"], "name_missing_lang": ["accept"], "translation_check": ["accept"],
    "nesting_too_deep": ["unlink", "skip"], "too_many": ["skip"], "photo_rights_unknown": ["illustration", "confirm_rights"],
    "allergens_check": ["accept"]
  }'::jsonb
$$;

-- ================================================================ schema change 1: menu imports, the raw input purged
alter table public.menu_imports add column raw_purged_at timestamptz;
comment on column public.menu_imports.raw_purged_at is 'When the raw input (raw_text, or the screenshots of raw_paths) was purged after import_raw_retention_days. The draft (parsed) stays.';

-- The two source checks accept a purged row: a text source holds its text (or was purged) and no paths; an image source
-- holds its paths (or was purged) and no text.
-- DESTRUCTIVE-LOOKING: drops the two unnamed source checks of 20261015120200_operations.sql (PostgreSQL named them
-- menu_imports_check and menu_imports_check1) and adds them back, named, accepting a purged row. No data changes.
alter table public.menu_imports drop constraint menu_imports_check, drop constraint menu_imports_check1;
alter table public.menu_imports add constraint menu_imports_text_source_ck check (case when source in ('paste', 'wolt_text')
  then raw_text is not null or raw_purged_at is not null else raw_text is null end);
alter table public.menu_imports add constraint menu_imports_image_source_ck check (case when source in ('scan', 'wolt_screenshots')
  then cardinality(raw_paths) > 0 or raw_purged_at is not null else cardinality(raw_paths) = 0 end);
alter table public.menu_imports add constraint menu_imports_purged_ck check (raw_purged_at is null or (raw_text is null and cardinality(raw_paths) = 0));

-- Every transition is a function now (ADR-008): clients hold no write grant. The scanner (service role) only marks a
-- read it claimed as failed, and purges. The raw input never changes, except that the purge empties it (the database's
-- daily job, or the scanner's purge mode), once.
create or replace function app.guard_import() returns trigger language plpgsql set search_path = '' as $$
declare client boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from unnest(new.raw_paths) rp where app.path_venue(rp) is distinct from new.venue_id) then
      raise exception 'path_of_other_venue';
    end if;
    new.created_by := (select auth.uid());
    new.raw_purged_at := null;
    if client and (new.status <> 'uploaded' or new.parsed is not null or new.exceptions <> '[]'::jsonb or new.applied_at is not null) then
      raise exception 'import_bad_start';
    end if;
    return new;
  end if;
  if new.venue_id <> old.venue_id or new.source <> old.source or new.input_sha256 is distinct from old.input_sha256 then
    raise exception 'import_input_fixed';
  end if;
  if (new.raw_text, new.raw_paths, new.raw_purged_at) is distinct from (old.raw_text, old.raw_paths, old.raw_purged_at) then
    -- only the purge, once: by the database or the scanner, emptying everything at once and saying when
    if client or old.raw_purged_at is not null or new.raw_purged_at is null or new.raw_text is not null or cardinality(new.raw_paths) > 0 then
      raise exception 'import_input_fixed';
    end if;
  end if;
  new.created_by := old.created_by;
  if new.status <> old.status then
    if client then raise exception 'import_transition'; end if;
    -- the scanner's only transition: a read it claimed failed
    if current_user = 'service_role' and not (old.status = 'parsing' and new.status = 'failed') then raise exception 'import_transition'; end if;
  end if;
  if new.status = 'applied' and old.status <> 'applied' then new.applied_at := now(); end if;
  return new;
end $$;

-- ================================================================ schema change 2: limits an import guessed wait for the owner
alter table public.addon_groups add column limits_confirmed boolean not null default true;
comment on column public.addon_groups.limits_confirmed is 'false when an import guessed the limits (the source stated none); the dashboard nudges group_without_limits until the owner edits or confirms them.';

-- a client that changes a group's limits has confirmed them
create function app.guard_group_limits() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and (new.min_units, new.max_units) is distinct from (old.min_units, old.max_units) then
    new.limits_confirmed := true;
  end if;
  return new;
end $$;
create trigger addon_groups_limits_confirmed before update on public.addon_groups for each row execute function app.guard_group_limits();

-- ================================================================ schema change 3: the steps the database marks done itself
-- venue (create_venue), menu (the venue's first dish), review (an applied import), publish (a publish). A client sets
-- them to doing or skipped, never to done (step_automatic; done → done is not a change), and never moves one the
-- database marked done (step_done). Functions (SECURITY DEFINER) are the database, so they may.
create or replace function app.guard_onboarding() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.venue_id <> old.venue_id or new.step <> old.step) then raise exception 'step_fixed'; end if;
  if exists (select 1 from unnest(new.blockers) b where b !~ '^[a-z][a-z0-9_]{1,40}$') then raise exception 'blocker_invalid'; end if;
  -- the automatic steps, written out (a trigger runs with the caller's rights, and the list's function is not theirs to
  -- call); app.onboarding_auto_steps() holds the same list, and supabase/tests compares both with the contracts
  if current_user in ('anon', 'authenticated') and new.step in ('venue', 'menu', 'review', 'publish') then
    if new.state = 'done' and (tg_op = 'INSERT' or old.state <> 'done') then raise exception 'step_automatic'; end if;
    -- of them only the review may be skipped (a menu built by hand has nothing to review)
    if new.state = 'skipped' and new.step <> 'review' then raise exception 'step_automatic'; end if;
    if tg_op = 'UPDATE' and old.state = 'done' and new.state <> 'done' then raise exception 'step_done'; end if;
  end if;
  new.updated_by := (select auth.uid());
  return new;
end $$;

-- the venue's first dish marks the step "menu" done (by hand or by an import)
create function app.mark_menu_step() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.onboarding_progress p set state = 'done'
  where p.step = 'menu' and p.state <> 'done' and p.venue_id in (select distinct n.venue_id from new_rows n);
  return null;
end $$;
create trigger dishes_menu_step after insert on public.dishes referencing new table as new_rows
  for each statement execute function app.mark_menu_step();

-- ================================================================ schema change 4: a staff caller's reason on every row it causes
-- The reason comes from mana.reason for a staff caller whatever the via (act_for_owner, ops_update_case, ops_set_demo
-- set it); an owner who sets mana.reason by hand is not staff, and it is ignored.
create or replace function app.log(p_venue uuid, p_action text, p_target_table text default null, p_target_ids text[] default '{}',
                                   p_detail jsonb default '{}', p_n integer default 1, p_reason text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_via text := app.via(); v_id bigint;
begin
  insert into public.activity_log (venue_id, actor_id, actor_kind, via, reason, action, target_table, target_ids, n, detail)
  values (p_venue, (select auth.uid()), case when p_venue is null then (case when app.is_staff() then 'staff' else 'system' end) else app.actor_kind(p_venue) end,
          v_via, coalesce(nullif(btrim(coalesce(p_reason, '')), ''), case when app.is_staff() then nullif(current_setting('mana.reason', true), '') end),
          p_action, p_target_table, coalesce(p_target_ids, '{}'), coalesce(p_n, 1), coalesce(p_detail, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- ================================================================ follow-up: an override's end in whole minutes (resolveUntil)
-- A duration ends on the whole minute at or after start + minutes, so the moment a guest's phone shows ("back at
-- 14:32") is the moment the database restores it.
create or replace function app.resolve_until(p_venue uuid, p_spec jsonb, p_start timestamptz) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare tz text := app.venue_tz(p_venue); today date := app.local_date(p_start, app.venue_tz(p_venue)); t timestamptz;
begin
  case p_spec->>'kind'
    when 'duration' then
      t := p_start + make_interval(mins => (p_spec->>'minutes')::integer);
      return date_trunc('minute', t) + case when date_trunc('minute', t) < t then interval '1 minute' else interval '0 minutes' end;
    when 'time' then
      t := app.zoned(today, (p_spec->>'at')::time, tz);
      return case when t > p_start then t else app.zoned(today + 1, (p_spec->>'at')::time, tz) end;
    when 'next_opening' then
      return coalesce(app.next_opening(p_venue, p_start), app.zoned(today + 1, time '00:00', tz));
    when 'date' then
      return app.zoned((p_spec->>'date')::date, time '00:00', tz);
    when 'indefinite' then
      return null;
    else
      raise exception 'until_invalid';
  end case;
end $$;

-- An until-date's year is 2000–2100 (orchestrator, 16 Oct; the contracts' isUntilSpec says the same). The check
-- constraint on availability_overrides calls this function: rows stored before keep their dates.
create or replace function app.until_spec_ok(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p) <> 'object' then return false; end if;
  case p->>'kind'
    when 'duration' then return jsonb_typeof(p->'minutes') = 'number' and (p->>'minutes') ~ '^[0-9]+$' and (p->>'minutes')::integer between 1 and 43200;
    when 'time' then return coalesce(p->>'at', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
    when 'date' then return coalesce(p->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (p->>'date')::date is not null
                            and left(p->>'date', 4)::integer between 2000 and 2100;
    when 'next_opening', 'indefinite' then return true;
    else return false;
  end case;
exception when others then
  return false;
end $$;

-- ================================================================ the raw input's retention (ADR-006)
-- The daily job empties the pasted text of imports applied, discarded or failed more than import_raw_retention_days
-- ago and says when (raw_purged_at). Screenshots are purged by the scanner's purge mode through the Storage API (deleting
-- a row of storage.objects would orphan the file), which empties raw_paths the same way.
create or replace function app.daily_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'UTC')::date; salts integer; hashes integer; failures integer; partitions integer; purged integer;
  keep_days integer := greatest(coalesce((app.cfg('import_raw_retention_days') #>> '{}')::integer, 30), 0);
begin
  delete from app.source_salts where day < today - 1;
  get diagnostics salts = row_count;
  update public.leads set source_hash = null where source_hash is not null and created_at < now() - interval '7 days';
  get diagnostics hashes = row_count;
  delete from app.staff_invite_failures where day < today - 7;
  get diagnostics failures = row_count;
  partitions := app.drop_old_event_partitions();
  -- DESTRUCTIVE-LOOKING (when the job runs, not when this migration is applied): empties raw_text of finished imports
  -- past the retention period; the row, its hash and its draft stay
  update public.menu_imports set raw_text = null, raw_purged_at = now()
  where raw_text is not null and status in ('applied', 'discarded', 'failed')
    and coalesce(applied_at, updated_at) < now() - make_interval(days => keep_days);
  get diagnostics purged = row_count;
  return jsonb_build_object('ok', true, 'salts', salts, 'leadHashes', hashes, 'inviteFailures', failures, 'partitions', partitions, 'importsPurged', purged);
end $$;

-- ================================================================ follow-up: track_events names what it did not store, by index
-- Every event of a batch is in exactly one of: accepted, a duplicate (stored before, or earlier in this batch: the
-- second index), capped, rejected. duplicateIndexes and cappedIndexes name them, so a phone (or the simulator's ledger)
-- knows exactly which events counted; the counts stay for phase-0 readers (TrackEventsReply).
create or replace function public.track_events(p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caps jsonb := app.cfg('event_caps');
  demo_caps jsonb := app.cfg('event_caps_demo');
  per_source integer; per_venue_source integer; per_venue integer; pre text;
  src text; local_day date;
  e jsonb; i integer; code text; v record;
  accepted integer := 0; duplicates integer := 0; capped integer := 0; rejected jsonb := '[]';
  dup_idx jsonb := '[]'; cap_idx jsonb := '[]';
begin
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 50 then
    return jsonb_build_object('ok', false, 'code', 'batch_invalid');
  end if;
  src := app.request_source();
  for i in 0 .. jsonb_array_length(p_events) - 1 loop
    e := p_events->i;
    code := app.check_event(e, app.guest_events());
    if code is null then
      select id, is_demo, time_zone into v from public.venues
      where id = (e->>'venueId')::uuid and published_revision_id is not null and approved_at is not null and archived_at is null;
      if not found then code := 'venue_unknown';
      elsif not app.event_refs_ok(v.id, e->'props') then code := 'ref_unknown';
      end if;
    end if;
    if code is not null then
      rejected := rejected || jsonb_build_object('index', i, 'code', code);
      continue;
    end if;
    if exists (select 1 from app.event_ids where id = (e->>'id')::uuid) then
      duplicates := duplicates + 1;
      dup_idx := dup_idx || to_jsonb(i);
      continue;
    end if;
    local_day := app.local_date(now(), v.time_zone);
    if v.is_demo then
      per_source := coalesce((demo_caps->>'per_source_hour')::integer, 100000);
      per_venue_source := coalesce((demo_caps->>'per_venue_source_day')::integer, 1000000);
      per_venue := coalesce((demo_caps->>'per_venue_day')::integer, 1000000);
      pre := 'demo-';
    else
      per_source := coalesce((caps->>'per_source_hour')::integer, 300);
      per_venue_source := coalesce((caps->>'per_venue_source_day')::integer, 1500);
      per_venue := coalesce((caps->>'per_venue_day')::integer, 50000);
      pre := '';
    end if;
    if app.bump(pre || 'source:' || src, date_trunc('hour', now())) > per_source
       or app.bump('venue-source:' || v.id || ':' || src, local_day::timestamp at time zone 'UTC') > per_venue_source then
      capped := capped + 1;
      cap_idx := cap_idx || to_jsonb(i);
      continue;
    end if;
    if app.bump('venue:' || v.id, local_day::timestamp at time zone 'UTC') > per_venue then
      capped := capped + 1;
      cap_idx := cap_idx || to_jsonb(i);
      insert into app.event_capped_days as d (venue_id, day, dropped) values (v.id, local_day, 1)
      on conflict (venue_id, day) do update set dropped = d.dropped + 1;
      continue;
    end if;
    if app.store_event((e->>'id')::uuid, v.id, e->>'name', (e->>'at')::timestamptz, 'guest', v.is_demo, e->'props') then
      accepted := accepted + 1;
    else
      duplicates := duplicates + 1;
      dup_idx := dup_idx || to_jsonb(i);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'accepted', accepted, 'duplicates', duplicates, 'capped', capped, 'rejected', rejected,
                            'duplicateIndexes', dup_idx, 'cappedIndexes', cap_idx);
end $$;

-- ================================================================ follow-up: the via labels of the staff RPCs (rows say rpc, not direct)
create or replace function public.redeem_staff_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); code text := btrim(coalesce(p_code, '')); r text; u record; fails integer;
  max_fail integer := coalesce((app.cfg('staff_invite_max_failures') #>> '{}')::integer, 5);
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'signed_out'); end if;
  if exists (select 1 from public.staff where user_id = uid) then return jsonb_build_object('ok', true); end if;
  select n into fails from app.staff_invite_failures where user_id = uid and day = (now() at time zone 'UTC')::date;
  if coalesce(fails, 0) >= max_fail then return jsonb_build_object('ok', false, 'code', 'locked'); end if;
  if char_length(code) < 32 or char_length(code) > 200 then
    perform app.invite_failed(uid);
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  select lower(email) as email, email_confirmed_at into u from auth.users where id = uid;
  if u.email is null or u.email_confirmed_at is null then return jsonb_build_object('ok', false, 'code', 'email_unconfirmed'); end if;
  update public.staff_invites set used_at = now(), used_by = uid
  where code_hash = encode(extensions.digest(code, 'sha256'), 'hex') and used_at is null and expires_at > now() and email = u.email
  returning role into r;
  if r is null then
    perform app.invite_failed(uid);
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  perform set_config('mana.via', 'rpc', true);
  insert into public.staff (user_id, role, note) values (uid, r, 'invite');
  perform app.log(null, 'staff.join', 'staff', array[uid::text], jsonb_build_object('role', r));
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'role', r);
end $$;

create or replace function public.create_staff_invite(p_email text, p_role text default 'support') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare email text := lower(btrim(coalesce(p_email, ''))); code text; ends timestamptz;
begin
  if app.staff_role() is distinct from 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;
  if char_length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return jsonb_build_object('ok', false, 'code', 'email_invalid'); end if;
  if coalesce(p_role, '') not in ('support', 'admin') then return jsonb_build_object('ok', false, 'code', 'role_invalid'); end if;
  code := encode(extensions.gen_random_bytes(24), 'hex');
  perform set_config('mana.via', 'rpc', true);
  insert into public.staff_invites (code_hash, role, email, note)
  values (encode(extensions.digest(code, 'sha256'), 'hex'), p_role, email, 'by ' || (select auth.uid())::text)
  returning expires_at into ends;
  perform app.log(null, 'staff_invite.create', 'staff_invites', '{}', jsonb_build_object('role', p_role, 'expiresAt', app.iso(ends)));
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'code', code, 'expiresAt', app.iso(ends));
end $$;

create or replace function public.ops_leads(p_status text default null, p_source text default null, p_since timestamptz default null,
                                            p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rows jsonb; n integer;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]'::jsonb), count(*) into rows, n
  from (select id, ref, created_at, source, message, contact, name, venue_name, locale, status, owner, notes
        from public.leads
        where (case when p_status is null then status <> 'spam' when p_status = 'all' then true else status = p_status end)
          and (p_source is null or source = p_source) and (p_since is null or created_at >= p_since)
        order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) l;
  perform set_config('mana.via', 'rpc', true);
  perform app.log(null, 'leads.read', 'leads', '{}',
                  jsonb_strip_nulls(jsonb_build_object('n', n, 'status', coalesce(p_status, 'default'), 'source', p_source, 'since', app.iso(p_since))), n);
  perform set_config('mana.via', '', true);
  return jsonb_build_object('leads', rows, 'count', n);
end $$;

-- (the same gap, found beside the three above: staff working a lead went through a function but was logged "direct")
create or replace function public.ops_update_lead(p_id uuid, p_status text default null, p_owner text default null, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('new', 'contacted', 'qualified', 'onboarding', 'won', 'lost', 'spam') then
    return jsonb_build_object('ok', false, 'code', 'status_invalid');
  end if;
  perform set_config('mana.via', 'rpc', true);
  update public.leads set status = coalesce(p_status, status), owner = coalesce(left(p_owner, 80), owner), notes = coalesce(left(p_notes, 4000), notes)
  where id = p_id;
  get diagnostics n = row_count;
  perform set_config('mana.via', '', true);
  if n = 0 then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ================================================================ the inputs' validators (the SQL twins of @mana/contracts' validate*)
-- Each takes the input object exactly as an app builds it (camelCase, JSON) and returns the same issues as the
-- contract's validator ([{code, path}], in the same order for one input; supabase/tests compares them). An RPC builds
-- that object from its arguments and answers the first issue's code. Unknown keys (field_not_allowed) come first, in
-- the database's key order.
create function app.v_only_keys(p jsonb, p_allowed text[]) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', k)), '[]'::jsonb)
  from jsonb_object_keys(p) k where not (k = any (p_allowed))
$$;

-- optionalText: null or absent is fine; else a string of at most p_max code points once its blank edges are stripped
-- (the text as stored). NUL and lone surrogates (the contracts' text_invalid) cannot reach PostgreSQL at all.
create function app.v_optional_text(p jsonb, p_path text, p_max integer) returns jsonb language sql immutable set search_path = '' as $$
  select case when p is null or p = 'null'::jsonb then '[]'::jsonb
              when jsonb_typeof(p) <> 'string' then app.issue('type', p_path)
              when char_length(app.strip_blank(p #>> '{}')) > p_max then app.issue('text_too_long', p_path)
              else '[]'::jsonb end
$$;

-- requiredText: a string with something visible, at most p_max once its blank edges are stripped
create function app.v_required_text(p jsonb, p_path text, p_max integer) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'string' then app.issue('type', p_path)
              when app.strip_blank(p #>> '{}') = '' then app.issue('text_missing', p_path)
              when char_length(app.strip_blank(p #>> '{}')) > p_max then app.issue('text_too_long', p_path)
              else '[]'::jsonb end
$$;

-- isReason: 3–500 characters once blank edges are stripped
create function app.v_reason(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'string' then char_length(app.strip_blank(p #>> '{}')) between 3 and 500 else false end
$$;

-- isUntilSpec
create function app.v_until(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'object' then false
    else case p->>'kind'
      when 'duration' then app.js_int(p->'minutes') and (p->>'minutes')::numeric between 1 and 43200
      when 'time' then app.js_str(p->'at') and (p->>'at') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      when 'date' then app.js_local_date(p->'date') and left(p->>'date', 4)::integer between 2000 and 2100
      when 'next_opening' then jsonb_typeof(p->'kind') = 'string'
      when 'indefinite' then jsonb_typeof(p->'kind') = 'string'
      else false end end
$$;

create function app.v_uuid_at(p jsonb, p_path text) returns jsonb language sql immutable set search_path = '' as
$$ select case when app.uuid_ok(p) then '[]'::jsonb else app.issue('id_invalid', p_path) end $$;

-- validateSetStep
create function app.validate_set_step(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb; i integer;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'step', 'state', 'blockers']) || app.v_uuid_at(p->'venueId', 'venueId');
  if not app.one_of(p->'step', app.onboarding_steps()) then errs := errs || app.issue('enum_invalid', 'step'); end if;
  if not app.one_of(p->'state', array['todo', 'doing', 'done', 'skipped', 'blocked']) then errs := errs || app.issue('enum_invalid', 'state');
  elsif app.one_of(p->'step', app.onboarding_auto_steps())
        and (p->>'state' = 'done' or (p->>'state' = 'skipped' and p->>'step' <> 'review')) then errs := errs || app.issue('step_automatic', 'state');
  end if;
  if p ? 'blockers' then
    if jsonb_typeof(p->'blockers') <> 'array' then errs := errs || app.issue('type', 'blockers');
    else
      if jsonb_array_length(p->'blockers') > 20 then errs := errs || app.issue('too_many', 'blockers'); end if;
      for i in 0 .. jsonb_array_length(p->'blockers') - 1 loop
        if not app.js_str(p->'blockers'->i) or (p->'blockers'->>i) !~ '^[a-z][a-z0-9_]{1,40}$' then
          errs := errs || app.issue('blocker_invalid', format('blockers[%s]', i));
        end if;
      end loop;
    end if;
  end if;
  return errs;
end $$;

-- validateSetAvailability
create function app.validate_set_availability(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'target', 'until', 'note']) || app.v_uuid_at(p->'venueId', 'venueId');
  if not app.js_obj(p->'target') then errs := errs || app.issue('type', 'target');
  else
    if not app.one_of(p->'target'->'kind', array['section', 'dish', 'option']) then errs := errs || app.issue('enum_invalid', 'target.kind'); end if;
    errs := errs || app.v_uuid_at(p->'target'->'id', 'target.id');
  end if;
  if not app.js_null(p->'until') and not app.v_until(p->'until') then errs := errs || app.issue('until_invalid', 'until'); end if;
  return errs || app.v_optional_text(p->'note', 'note', 200);
end $$;

-- validateRestoreToday, validateExportQuery, validateOpsVenueQuery: one venue id
create function app.validate_venue_input(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'object' then app.issue('type', '')
    else app.v_only_keys(p, array['venueId']) || app.v_uuid_at(p->'venueId', 'venueId') end
$$;

-- validateOpenCase
create function app.validate_open_case(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'topic', 'subject', 'body', 'allowAct']) || app.v_uuid_at(p->'venueId', 'venueId');
  if not app.one_of(p->'topic', array['onboarding', 'import', 'menu', 'photos', 'account', 'other']) then errs := errs || app.issue('enum_invalid', 'topic'); end if;
  errs := errs || app.v_required_text(p->'subject', 'subject', 160);
  if p ? 'body' then errs := errs || app.v_optional_text(p->'body', 'body', 4000); end if;
  if p ? 'allowAct' and jsonb_typeof(p->'allowAct') <> 'boolean' then errs := errs || app.issue('type', 'allowAct'); end if;
  return errs;
end $$;

-- validateUpdateCase
create function app.validate_update_case(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['caseId', 'status', 'topic', 'reason']) || app.v_uuid_at(p->'caseId', 'caseId');
  if p ? 'status' and not app.one_of(p->'status', array['open', 'waiting_owner', 'waiting_halom', 'resolved']) then errs := errs || app.issue('enum_invalid', 'status'); end if;
  if p ? 'topic' and not app.one_of(p->'topic', array['onboarding', 'import', 'menu', 'photos', 'account', 'other']) then errs := errs || app.issue('enum_invalid', 'topic'); end if;
  if not (p ? 'status') and not (p ? 'topic') then errs := errs || app.issue('nothing_to_change', ''); end if;
  if not app.v_reason(p->'reason') then errs := errs || app.issue('reason_required', 'reason'); end if;
  return errs;
end $$;

-- validateActivityQuery
create function app.validate_activity_query(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'before', 'limit', 'actor', 'via']) || app.v_uuid_at(p->'venueId', 'venueId');
  if p ? 'before' and not app.js_null(p->'before') and not (app.js_int(p->'before') and (p->>'before')::numeric > 0) then
    errs := errs || app.issue('id_invalid', 'before');
  end if;
  if p ? 'limit' and not (app.js_int(p->'limit') and (p->>'limit')::numeric between 1 and 100) then errs := errs || app.issue('limit_invalid', 'limit'); end if;
  if p ? 'actor' and not app.js_null(p->'actor') and not app.one_of(p->'actor', array['owner', 'manager', 'counter', 'staff', 'system']) then
    errs := errs || app.issue('enum_invalid', 'actor');
  end if;
  if p ? 'via' and not app.js_null(p->'via') and not app.one_of(p->'via', array['direct', 'rpc', 'act_for_owner', 'system']) then
    errs := errs || app.issue('enum_invalid', 'via');
  end if;
  return errs;
end $$;

-- validateDashboardQuery
create function app.validate_dashboard_query(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'object' then app.issue('type', '')
    else app.v_only_keys(p, array['venueId', 'range']) || app.v_uuid_at(p->'venueId', 'venueId')
      || case when p ? 'range' and not app.one_of(p->'range', array['today', '7d', '30d']) then app.issue('range_invalid', 'range') else '[]'::jsonb end end
$$;

-- validateSetDemo
create function app.validate_set_demo(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'object' then app.issue('type', '')
    else app.v_only_keys(p, array['venueId', 'demo', 'reason']) || app.v_uuid_at(p->'venueId', 'venueId')
      || case when jsonb_typeof(p->'demo') is distinct from 'boolean' then app.issue('type', 'demo') else '[]'::jsonb end
      || case when not app.v_reason(p->'reason') then app.issue('reason_required', 'reason') else '[]'::jsonb end end
$$;

-- validateOpsRevisionQuery
create function app.validate_ops_revision_query(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'object' then app.issue('type', '')
    else app.v_only_keys(p, array['venueId', 'revision']) || app.v_uuid_at(p->'venueId', 'venueId')
      || case when p ? 'revision' and not app.js_null(p->'revision') and not (app.js_int(p->'revision') and (p->>'revision')::numeric >= 1)
              then app.issue('revision_invalid', 'revision') else '[]'::jsonb end end
$$;

-- validateOpsVenuesQuery
create function app.validate_ops_venues_query(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['q', 'stage', 'warning', 'review', 'planState', 'plan', 'demo', 'sort', 'limit', 'offset']);
  if p ? 'q' then errs := errs || app.v_required_text(p->'q', 'q', 80); end if;
  if p ? 'stage' and p->'stage' is distinct from '"complete"'::jsonb and not app.one_of(p->'stage', app.onboarding_steps()) then errs := errs || app.issue('enum_invalid', 'stage'); end if;
  if p ? 'warning' and not app.one_of(p->'warning', app.ops_warnings()) then errs := errs || app.issue('enum_invalid', 'warning'); end if;
  if p ? 'review' and not app.one_of(p->'review', array['not_requested', 'pending', 'approved']) then errs := errs || app.issue('enum_invalid', 'review'); end if;
  if p ? 'planState' and not app.one_of(p->'planState', array['pending', 'trialing', 'active', 'expired', 'suspended']) then errs := errs || app.issue('enum_invalid', 'planState'); end if;
  if p ? 'plan' and not app.one_of(p->'plan', array['trial', 'pilot', 'paid']) then errs := errs || app.issue('enum_invalid', 'plan'); end if;
  if p ? 'demo' and not app.one_of(p->'demo', array['exclude', 'include', 'only']) then errs := errs || app.issue('enum_invalid', 'demo'); end if;
  if p ? 'sort' and not app.one_of(p->'sort', array['created', 'activity', 'opens_today', 'name']) then errs := errs || app.issue('enum_invalid', 'sort'); end if;
  if p ? 'limit' and not (app.js_int(p->'limit') and (p->>'limit')::numeric between 1 and 500) then errs := errs || app.issue('limit_invalid', 'limit'); end if;
  if p ? 'offset' and not (app.js_int(p->'offset') and (p->>'offset')::numeric >= 0) then errs := errs || app.issue('limit_invalid', 'offset'); end if;
  return errs;
end $$;

-- validateOpsAnalyticsQuery (a minute series: instants with an offset on whole minutes, at most a day; a day series:
-- local dates, at most 400 days)
create function app.validate_ops_analytics_query(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb; f timestamptz; t timestamptz; i integer; n integer;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'resolution', 'from', 'to', 'demo', 'names']);
  if p ? 'venueId' and not app.js_null(p->'venueId') and not app.uuid_ok(p->'venueId') then errs := errs || app.issue('id_invalid', 'venueId'); end if;
  if p ? 'demo' and not app.one_of(p->'demo', array['exclude', 'include', 'only']) then errs := errs || app.issue('enum_invalid', 'demo'); end if;
  if p ? 'names' then
    if jsonb_typeof(p->'names') <> 'array' or jsonb_array_length(p->'names') = 0
       or exists (select 1 from jsonb_array_elements(p->'names') x where not app.one_of(x, app.event_names()))
       or (select count(distinct x) from jsonb_array_elements(p->'names') x) <> jsonb_array_length(p->'names') then
      errs := errs || app.issue('enum_invalid', 'names');
    end if;
  end if;
  if p->'resolution' = '"minute"'::jsonb then
    f := app.js_instant(p->'from');
    t := app.js_instant(p->'to');
    if f is null or date_trunc('minute', f) <> f then errs := errs || app.issue('time_invalid', 'from'); end if;
    if t is null or date_trunc('minute', t) <> t then errs := errs || app.issue('time_invalid', 'to'); end if;
    if f is not null and t is not null then
      if t <= f then errs := errs || app.issue('range_invalid', 'to');
      elsif t - f > interval '24 hours' then errs := errs || app.issue('range_too_long', 'to');
      end if;
    end if;
  elsif p->'resolution' = '"day"'::jsonb then
    if not app.js_local_date(p->'from') then errs := errs || app.issue('date_invalid', 'from'); end if;
    if not app.js_local_date(p->'to') then errs := errs || app.issue('date_invalid', 'to'); end if;
    if app.js_local_date(p->'from') and app.js_local_date(p->'to') then
      if (p->>'to') collate "C" < (p->>'from') collate "C" then errs := errs || app.issue('range_invalid', 'to');
      elsif (p->>'to')::date - (p->>'from')::date + 1 > 400 then errs := errs || app.issue('range_too_long', 'to');
      end if;
    end if;
  else
    errs := errs || app.issue('enum_invalid', 'resolution');
  end if;
  return errs;
end $$;

-- validateCreateImport. Image sources name the import's id themselves and upload under <venue>/imports/<id>/.
create function app.validate_create_import(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb := '[]'; text_src boolean; v_text jsonb; v_paths jsonb; v_sha jsonb; v_id jsonb; folder text; i integer; x jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'source', 'importId', 'text', 'paths', 'inputSha256', 'rightsConfirmed'])
       || app.v_uuid_at(p->'venueId', 'venueId');
  if not app.one_of(p->'source', array['scan', 'paste', 'wolt_screenshots', 'wolt_text']) then return errs || app.issue('enum_invalid', 'source'); end if;
  text_src := p->>'source' in ('paste', 'wolt_text');
  -- a field left out counts as null
  v_text := coalesce(p->'text', 'null'::jsonb);
  v_paths := coalesce(p->'paths', 'null'::jsonb);
  v_sha := coalesce(p->'inputSha256', 'null'::jsonb);
  v_id := coalesce(p->'importId', 'null'::jsonb);
  if not app.js_null(v_id) and not app.uuid_ok(v_id) then errs := errs || app.issue('id_invalid', 'importId'); end if;
  if text_src then
    if not app.js_null(v_paths) or not app.js_null(v_sha) then errs := errs || app.issue('input_mismatch', 'paths'); end if;
    if not app.js_str(v_text) or app.strip_blank(v_text #>> '{}') = '' then errs := errs || app.issue('text_missing', 'text');
    elsif char_length(v_text #>> '{}') > 60000 then errs := errs || app.issue('text_too_long', 'text');
    end if;
  else
    if not app.js_null(v_text) then errs := errs || app.issue('input_mismatch', 'text'); end if;
    if app.js_null(v_id) then errs := errs || app.issue('id_invalid', 'importId'); end if;
    if app.uuid_ok(p->'venueId') and app.uuid_ok(v_id) then folder := lower(p->>'venueId') || '/imports/' || lower(v_id #>> '{}') || '/'; end if;
    if jsonb_typeof(v_paths) <> 'array' or jsonb_array_length(v_paths) = 0 then errs := errs || app.issue('paths_missing', 'paths');
    elsif jsonb_array_length(v_paths) > 20 then errs := errs || app.issue('too_many', 'paths');
    else
      for i in 0 .. jsonb_array_length(v_paths) - 1 loop
        x := v_paths->i;
        if not app.js_rel_path(x) or char_length(x #>> '{}') > 200 or (folder is not null and not starts_with(x #>> '{}', folder)) then
          errs := errs || app.issue('path_invalid', format('paths[%s]', i));
        end if;
      end loop;
    end if;
    if not app.js_str(v_sha) or (v_sha #>> '{}') !~ '^[0-9a-f]{64}$' then errs := errs || app.issue('sha_invalid', 'inputSha256'); end if;
  end if;
  if jsonb_typeof(p->'rightsConfirmed') is distinct from 'boolean' then errs := errs || app.issue('type', 'rightsConfirmed');
  elsif p->'rightsConfirmed' = 'true'::jsonb and p->>'source' <> 'wolt_screenshots' then errs := errs || app.issue('rights_invalid', 'rightsConfirmed');
  end if;
  return errs;
end $$;

-- ================================================================ small pieces the RPCs share
create function app.fail(p_code text, p_errors jsonb default null) returns jsonb language sql immutable set search_path = '' as $$
  select case when p_errors is null then jsonb_build_object('ok', false, 'code', p_code)
              else jsonb_build_object('ok', false, 'code', p_code, 'errors', p_errors) end
$$;

-- the scanner (an edge function) calls with the service role's key
create function app.is_service() returns boolean language sql stable security definer set search_path = '' as
$$ select coalesce((select auth.role()) = 'service_role', false) $$;

-- the start of the venue's local today
create function app.local_day_start(p_venue uuid) returns timestamptz language sql stable security definer set search_path = '' as
$$ select app.zoned(app.local_date(now(), v.time_zone), time '00:00', v.time_zone) from public.venues v where v.id = p_venue $$;

-- draftCounts
create function app.draft_counts(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'sections', jsonb_array_length(app.arr(p->'sections')),
    'dishes', (select count(*) from jsonb_array_elements(app.arr(p->'sections')) s, jsonb_array_elements(app.arr(s->'dishes')) d),
    'groups', jsonb_array_length(app.arr(p->'groups')),
    'options', (select count(*) from jsonb_array_elements(app.arr(p->'groups')) g, jsonb_array_elements(app.arr(g->'options')) o),
    'photos', (select count(*) from jsonb_array_elements(app.arr(p->'sections')) s, jsonb_array_elements(app.arr(s->'dishes')) d
               where not app.js_null(d->'photo') and d ? 'photo'))
$$;

-- ================================================================ the import (ADR-006): create, claim a scan, save the draft, apply, discard
-- create_import: text sources send the text (stored stripped, hashed here); image sources the import's id (made by the
-- client before uploading under <venue>/imports/<id>/), the private paths and their hash. The same input as a live
-- import of the venue returns that import (reused) and writes nothing; an id already used otherwise is id_taken.
create function public.create_import(p_venue uuid, p_source text, p_text text default null, p_paths text[] default null,
                                     p_input_sha256 text default null, p_rights_confirmed boolean default false,
                                     p_import_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; body text; sha text; n integer; imp record;
  cap integer := coalesce((app.cfg('import_caps')->>'per_venue_day')::integer, 20);
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue and archived_at is null) then return app.fail('venue_unknown'); end if;
  errs := app.validate_create_import(jsonb_build_object('venueId', p_venue, 'source', p_source, 'importId', p_import_id, 'text', p_text,
                                                        'paths', to_jsonb(p_paths), 'inputSha256', p_input_sha256, 'rightsConfirmed', p_rights_confirmed));
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  perform pg_advisory_xact_lock(hashtext('mana:import:' || p_venue::text));
  if p_source in ('paste', 'wolt_text') then
    body := app.strip_blank(p_text);
    sha := encode(extensions.digest(body, 'sha256'), 'hex');
  else
    sha := p_input_sha256;
  end if;
  select id, status into imp from public.menu_imports where venue_id = p_venue and input_sha256 = sha and status <> 'discarded';
  if found then return jsonb_build_object('ok', true, 'importId', imp.id, 'status', imp.status, 'reused', true); end if;
  if p_import_id is not null and exists (select 1 from public.menu_imports where id = p_import_id) then return app.fail('id_taken'); end if;
  select count(*) into n from public.menu_imports where venue_id = p_venue and created_at >= app.local_day_start(p_venue);
  if n >= cap then return app.fail('rate_limited'); end if;
  perform set_config('mana.via', 'rpc', true);
  insert into public.menu_imports (id, venue_id, source, raw_text, raw_paths, input_sha256, rights_confirmed)
  values (coalesce(p_import_id, gen_random_uuid()), p_venue, p_source, body, case when body is null then p_paths else '{}' end, sha, p_rights_confirmed)
  returning id, status into imp;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'importId', imp.id, 'status', imp.status, 'reused', false);
end $$;

-- claim_import_scan: the scanner, with the owner's own token, before any paid call. uploaded | failed → parsing in one
-- statement; a claim older than 10 minutes (a crashed read) may be claimed again. Counts against scans_per_venue_day.
create function public.claim_import_scan(p_import uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i record; c record; day_start timestamptz; used integer;
  cap integer := coalesce((app.cfg('import_caps')->>'scans_per_venue_day')::integer, 10);
begin
  if (select auth.uid()) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, venue_id, source, status, updated_at into i from public.menu_imports where id = p_import;
  if not found then return app.fail('import_unknown'); end if;
  if not app.can_edit(i.venue_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if i.source not in ('scan', 'wolt_screenshots') then return app.fail('not_scannable'); end if;
  if i.status in ('parsed', 'applied', 'discarded') then return app.fail('import_closed'); end if;
  if i.status = 'parsing' and i.updated_at > now() - interval '10 minutes' then return app.fail('import_busy'); end if;
  perform pg_advisory_xact_lock(hashtext('mana:import:' || i.venue_id::text));
  day_start := app.local_day_start(i.venue_id);
  select n into used from app.event_counters where key = 'import-scan:' || i.venue_id and window_start = day_start;
  if coalesce(used, 0) >= cap then return app.fail('rate_limited'); end if;
  perform set_config('mana.via', 'rpc', true);
  update public.menu_imports set status = 'parsing', error_code = null
  where id = p_import and (status in ('uploaded', 'failed') or (status = 'parsing' and updated_at <= now() - interval '10 minutes'))
  returning id, venue_id, source, raw_paths, rights_confirmed into c;
  if not found then
    perform set_config('mana.via', '', true);
    return app.fail('import_busy');
  end if;
  perform app.bump('import-scan:' || i.venue_id, day_start);
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'importId', c.id, 'venueId', c.venue_id, 'source', c.source, 'paths', to_jsonb(c.raw_paths),
                            'rightsConfirmed', c.rights_confirmed, 'langs', (select to_jsonb(v.langs) from public.venues v where v.id = c.venue_id));
end $$;

-- discard_import: uploaded | failed | parsed → discarded (twice is fine); frees the input's hash for a new import
create function public.discard_import(p_import uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i record;
begin
  if (select auth.uid()) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, venue_id, status into i from public.menu_imports where id = p_import for update;
  if not found then return app.fail('import_unknown'); end if;
  if not app.can_edit(i.venue_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if i.status = 'parsing' then return app.fail('import_busy'); end if;
  if i.status = 'applied' then return app.fail('import_closed'); end if;
  if i.status = 'discarded' then return jsonb_build_object('ok', true); end if;
  perform set_config('mana.via', 'rpc', true);
  update public.menu_imports set status = 'discarded' where id = i.id;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true);
end $$;

-- ================================================================ onboarding progress (F03)
-- OnboardingProgress: every step in journey order (a step never written is todo), how many are done or skipped, the
-- next one
create function app.onboarding_progress_json(p_venue uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  with steps as (
    select u.s as step, u.i, coalesce(p.state, 'todo') as state, coalesce(p.blockers, '{}') as blockers, p.updated_at
    from unnest(app.onboarding_steps()) with ordinality u(s, i)
    left join public.onboarding_progress p on p.venue_id = p_venue and p.step = u.s)
  select jsonb_build_object(
    'steps', jsonb_agg(jsonb_build_object('step', st.step, 'state', st.state, 'blockers', to_jsonb(st.blockers),
                                          'auto', st.step = any (app.onboarding_auto_steps()), 'updatedAt', app.iso(st.updated_at)) order by st.i),
    'done', count(*) filter (where st.state in ('done', 'skipped')),
    'total', count(*),
    'next', (select x.step from steps x where x.state not in ('done', 'skipped') order by x.i limit 1),
    'complete', not exists (select 1 from steps x where x.state not in ('done', 'skipped')))
  from steps st
$$;

-- The one rule set for marking a step, the owner's (set_onboarding_step) and Halom's (act_for_owner 'onboarding.set'):
-- an automatic step is never set done by hand (step_automatic) and, once the database marked it done, never moved
-- (step_done). p_blockers null keeps the step's blockers. Raises the code; returns the whole progress.
create function app.set_onboarding_step(p_venue uuid, p_step text, p_state text, p_blockers text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  if p_step = any (app.onboarding_auto_steps()) and p_state = 'done' then raise exception 'step_automatic'; end if;
  select state into cur from public.onboarding_progress where venue_id = p_venue and step = p_step for update;
  if cur = 'done' and p_step = any (app.onboarding_auto_steps()) and p_state <> 'done' then raise exception 'step_done'; end if;
  insert into public.onboarding_progress as o (venue_id, step, state, blockers) values (p_venue, p_step, p_state, coalesce(p_blockers, '{}'))
  on conflict (venue_id, step) do update set state = excluded.state,
    blockers = case when p_blockers is null then o.blockers else excluded.blockers end;
  return app.onboarding_progress_json(p_venue);
end $$;

create function public.set_onboarding_step(p_venue uuid, p_step text, p_state text, p_blockers text[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; res jsonb;
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue and archived_at is null) then return app.fail('venue_unknown'); end if;
  errs := app.validate_set_step(jsonb_build_object('venueId', p_venue, 'step', p_step, 'state', p_state)
            || case when p_blockers is null then '{}'::jsonb else jsonb_build_object('blockers', to_jsonb(p_blockers)) end);
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  perform set_config('mana.via', 'rpc', true);
  begin
    res := app.set_onboarding_step(p_venue, p_step, p_state, p_blockers);
  exception when raise_exception then
    perform set_config('mana.via', '', true);
    return app.fail(sqlerrm);
  end;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'progress', res);
end $$;

-- act_for_owner('onboarding.set', {step, state, blockers?}): the same validator and the same internal
create or replace function app.afo_onboarding_set(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare input jsonb := jsonb_build_object('venueId', p_venue, 'step', p->'step', 'state', p->'state'); errs jsonb; res jsonb;
begin
  if p ? 'blockers' then input := input || jsonb_build_object('blockers', p->'blockers'); end if;
  errs := app.validate_set_step(input);
  if jsonb_array_length(errs) > 0 then raise exception '%', errs->0->>'code'; end if;
  res := app.set_onboarding_step(p_venue, p->>'step', p->>'state',
                                 case when p ? 'blockers' then array(select jsonb_array_elements_text(p->'blockers')) end);
  return jsonb_build_object('step', p->>'step', 'state', p->>'state', 'progress', res);
end $$;

-- ================================================================ support cases ("get help", F03 and F09)
-- SupportCase, as the owner and Halom read it
create function app.case_json(p_case uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'venueId', c.venue_id, 'topic', c.topic, 'status', c.status, 'subject', c.subject, 'body', c.body,
    'openedBy', case when m.role in ('owner', 'manager') then m.role when s.user_id is not null then 'staff' end,
    'openedAt', app.iso(c.created_at), 'updatedAt', app.iso(c.updated_at), 'resolvedAt', app.iso(c.resolved_at), 'supportCanAct', v.support_can_act)
  from public.support_cases c
  join public.venues v on v.id = c.venue_id
  left join public.venue_members m on m.venue_id = c.venue_id and m.user_id = c.opened_by
  left join public.staff s on s.user_id = c.opened_by
  where c.id = p_case
$$;

-- open_case: owners and managers ask Halom for help; allowAct (the owner's alone) sets the support switch with it
create function public.open_case(p_venue uuid, p_topic text, p_subject text, p_body text default '', p_allow_act boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; n integer; cid uuid; can_act boolean;
  cap integer := coalesce((app.cfg('case_caps')->>'per_venue_day')::integer, 10);
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue and archived_at is null) then return app.fail('venue_unknown'); end if;
  errs := app.validate_open_case(jsonb_build_object('venueId', p_venue, 'topic', p_topic, 'subject', p_subject, 'body', p_body)
            || case when p_allow_act is null then '{}'::jsonb else jsonb_build_object('allowAct', p_allow_act) end);
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  if p_allow_act is not null and not app.is_owner(p_venue) then return app.fail('owner_only'); end if;
  perform pg_advisory_xact_lock(hashtext('mana:case:' || p_venue::text));
  select count(*) into n from public.support_cases where venue_id = p_venue and created_at >= app.local_day_start(p_venue);
  if n >= cap then return app.fail('rate_limited'); end if;
  perform set_config('mana.via', 'rpc', true);
  insert into public.support_cases (venue_id, topic, subject, body) values (p_venue, p_topic, p_subject, coalesce(p_body, '')) returning id into cid;
  if p_allow_act is not null then
    update public.venues set support_can_act = p_allow_act where id = p_venue and support_can_act is distinct from p_allow_act;
  end if;
  perform set_config('mana.via', '', true);
  select support_can_act into can_act from public.venues where id = p_venue;
  return jsonb_build_object('ok', true, 'caseId', cid, 'supportCanAct', can_act);
end $$;

-- ops_update_case: staff change a case's status or topic. Halom's own record, so the owner's support switch does not
-- apply; the reason is on the audit row, and the owner sees it.
create function public.ops_update_case(p_case uuid, p_status text default null, p_topic text default null, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  errs := app.validate_update_case(jsonb_build_object('caseId', p_case, 'reason', p_reason)
            || case when p_status is null then '{}'::jsonb else jsonb_build_object('status', p_status) end
            || case when p_topic is null then '{}'::jsonb else jsonb_build_object('topic', p_topic) end);
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  if not exists (select 1 from public.support_cases where id = p_case) then return app.fail('case_unknown'); end if;
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.reason', app.strip_blank(p_reason), true);
  update public.support_cases set status = coalesce(p_status, status), topic = coalesce(p_topic, topic) where id = p_case;
  perform set_config('mana.via', '', true);
  perform set_config('mana.reason', '', true);
  return jsonb_build_object('ok', true, 'case', app.case_json(p_case));
end $$;

-- ================================================================ availability: the phone's quick actions (F05, F08)
-- The one rule set for "off until", the owner's (set_availability) and Halom's (act_for_owner 'availability.set'): under
-- a lock per (venue, target), whatever of the target is off and not over is restored, then, when p_until is given, one
-- override is stored (its end resolved by app.resolve_until, whole minutes). The newest answer counts; nothing stacks.
-- Raises target_unknown, until_invalid, until_in_past.
create function app.set_availability(p_venue uuid, p_kind text, p_target uuid, p_until jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer; o record;
begin
  if not ((p_kind = 'section' and exists (select 1 from public.sections x where x.id = p_target and x.venue_id = p_venue))
       or (p_kind = 'dish' and exists (select 1 from public.dishes x where x.id = p_target and x.venue_id = p_venue))
       or (p_kind = 'option' and exists (select 1 from public.addon_options x where x.id = p_target and x.venue_id = p_venue))) then
    raise exception 'target_unknown';
  end if;
  perform pg_advisory_xact_lock(hashtext('mana:availability:' || p_venue::text || ':' || p_kind || ':' || p_target::text));
  update public.availability_overrides set restored_at = now()
  where venue_id = p_venue and target_kind = p_kind and target_id = p_target and restored_at is null and (until_at is null or until_at > now());
  get diagnostics n = row_count;
  if p_until is null or p_until = 'null'::jsonb then return jsonb_build_object('overrideId', null, 'untilAt', null, 'restored', n); end if;
  insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec, note)
  values (p_venue, p_kind, p_target, p_until->>'kind', p_until, p_note)
  returning id, until_at into o;
  return jsonb_build_object('overrideId', o.id, 'untilAt', app.iso(o.until_at), 'restored', n);
end $$;

create function public.set_availability(p_venue uuid, p_target_kind text, p_target_id uuid, p_until jsonb default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; res jsonb;
begin
  if (select auth.uid()) is null or not app.can_operate(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  errs := app.validate_set_availability(jsonb_build_object('venueId', p_venue, 'target', jsonb_build_object('kind', p_target_kind, 'id', p_target_id),
                                                           'until', coalesce(p_until, 'null'::jsonb), 'note', p_note));
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  perform set_config('mana.via', 'rpc', true);
  begin
    res := app.set_availability(p_venue, p_target_kind, p_target_id, p_until, nullif(app.strip_blank(coalesce(p_note, '')), ''));
  exception when raise_exception then
    perform set_config('mana.via', '', true);
    return app.fail(sqlerrm);
  end;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true) || res;
end $$;

-- act_for_owner('availability.set', {targetKind, targetId, until, note?}): the same internal (until null = back now)
create or replace function app.afo_availability_set(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p->>'targetKind', '') not in ('section', 'dish', 'option') or not app.uuid_ok(p->'targetId') or not (p ? 'until')
     or (not app.js_null(p->'until') and not app.until_spec_ok(p->'until')) then
    raise exception 'payload_invalid';
  end if;
  return app.set_availability(p_venue, p->>'targetKind', (p->>'targetId')::uuid, p->'until', nullif(left(app.strip_blank(coalesce(p->>'note', '')), 200), ''));
end $$;

-- restore_today: everything taken off on the venue's local today that is still off comes back; an override that
-- started on an earlier day stays
create function public.restore_today(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare tz text; n integer; targets jsonb;
begin
  if (select auth.uid()) is null or not app.can_operate(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select time_zone into tz from public.venues where id = p_venue and archived_at is null;
  if not found then return app.fail('venue_unknown'); end if;
  perform set_config('mana.via', 'rpc', true);
  with r as (
    update public.availability_overrides o set restored_at = now()
    where o.venue_id = p_venue and o.restored_at is null and (o.until_at is null or o.until_at > now()) and o.starts_at <= now()
      and app.local_date(o.starts_at, tz) = app.local_date(now(), tz)
    returning o.target_kind, o.target_id, o.starts_at)
  select (select count(*) from r),
         coalesce((select jsonb_agg(jsonb_build_object('kind', z.target_kind, 'id', z.target_id) order by z.first, z.target_kind, z.target_id)
                   from (select target_kind, target_id, min(starts_at) as first from r group by 1, 2) z), '[]'::jsonb)
  into n, targets;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'restored', n, 'targets', targets);
end $$;

-- ================================================================ save_addon_group (added 16 Oct, from the owner app's QA)
-- A group and its options saved as one. Saving them as separate writes could leave a group half-saved after a refusal
-- or a lost answer, with its deletions already done. Here it is one transaction under the venue's nesting lock (the
-- one app.guard_nesting takes). The ids are the client's: a group or option that does not exist is inserted, one that
-- exists is updated, and the group's options missing from the input are deleted.
-- * The same input twice changes nothing: it answers ok, so a retry after a lost answer is safe.
-- * A save over a newer stored group (its updated_at is not the one the client read) answers `stale`, with the stored
--   group and its options. The group's updated_at moves whenever this function changes the group or any of its
--   options, so it versions both.
-- * Deleting options that upsell rules suggest needs the owner's confirmation; the rules are deleted with them.
-- * A group with no options, or a minimum its options cannot reach, is refused (options_empty, min_unreachable), as
--   publishing would refuse it later; so are new limits that a dish offering the group could no longer keep
--   (limits_invalid, limits_loosened, with the path dishGroups.<link id>).
-- The menu tables' triggers still apply. A refusal rolls back everything and answers with its code. The audit rows
-- come from the per-statement audit, via 'rpc'.
-- The group and its options travel as their table rows (the columns the owner may set), the way the owner app reads them.

-- validateAddonGroupInput: {venueId, group, options}
create function app.validate_addon_group_input(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb; g jsonb; o jsonb; x jsonb; i integer; at text; ids text[] := '{}'; gid text; lo integer; hi integer; defaults integer := 0;
  units integer := 0;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := app.v_only_keys(p, array['venueId', 'group', 'options']) || app.v_uuid_at(p->'venueId', 'venueId');
  g := p->'group';
  if not app.js_obj(g) then errs := errs || app.issue('type', 'group');
  else
    errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', 'group.' || k)), '[]'::jsonb)
                     from jsonb_object_keys(g) k
                     where not k = any (array['id', 'label', 'name_he', 'name_en', 'selection', 'min_units', 'max_units', 'limits_confirmed']));
    errs := errs || app.v_uuid_at(g->'id', 'group.id');
    if app.uuid_ok(g->'id') then gid := lower(g->>'id'); end if;
    errs := errs || app.v_optional_text(g->'label', 'group.label', 60) || app.v_optional_text(g->'name_he', 'group.name_he', 60)
                 || app.v_optional_text(g->'name_en', 'group.name_en', 60);
    if app.strip_blank(coalesce(case when app.js_str(g->'name_he') then g->>'name_he' end, '')) = ''
       and app.strip_blank(coalesce(case when app.js_str(g->'name_en') then g->>'name_en' end, '')) = '' then
      errs := errs || app.issue('name_missing', 'group');
    end if;
    if g ? 'selection' and not app.one_of(g->'selection', array['single', 'multiple']) then errs := errs || app.issue('enum_invalid', 'group.selection'); end if;
    if g ? 'min_units' and not (app.js_int(g->'min_units') and (g->>'min_units')::numeric between 0 and 30) then
      errs := errs || app.issue('units_invalid', 'group.min_units');
    elsif g ? 'max_units' and not (app.js_int(g->'max_units') and (g->>'max_units')::numeric between 1 and 30) then
      errs := errs || app.issue('units_invalid', 'group.max_units');
    else
      hi := coalesce((g->>'max_units')::integer, 1);
      if coalesce((g->>'min_units')::integer, 0) > hi then errs := errs || app.issue('units_invalid', 'group.max_units');
      else
        -- the group's min, kept only when its units are valid (min_unreachable needs it)
        lo := coalesce((g->>'min_units')::integer, 0);
        if coalesce(g->>'selection', 'single') = 'single' and hi <> 1 then errs := errs || app.issue('single_max', 'group.max_units'); end if;
      end if;
    end if;
    if g ? 'limits_confirmed' and jsonb_typeof(g->'limits_confirmed') <> 'boolean' then errs := errs || app.issue('type', 'group.limits_confirmed'); end if;
  end if;
  o := p->'options';
  if jsonb_typeof(o) is distinct from 'array' then return errs || app.issue('type', 'options'); end if;
  -- publishing refuses an empty group and one whose minimum its options cannot reach, and this is the groups' only writer
  if jsonb_array_length(o) = 0 then errs := errs || app.issue('options_empty', 'options'); end if;
  for i in 0 .. jsonb_array_length(o) - 1 loop
    at := format('options[%s]', i);
    x := o->i;
    if not app.js_obj(x) then units := null; errs := errs || app.issue('type', at); continue; end if;
    -- the capacity: the sum of max_qty (default 1), unknown once an option's max_qty is unreadable
    if x ? 'max_qty' and not (app.js_int(x->'max_qty') and (x->>'max_qty')::numeric between 1 and 10) then units := null;
    else units := units + coalesce((x->>'max_qty')::integer, 1);
    end if;
    errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', at || '.' || k)), '[]'::jsonb)
                     from jsonb_object_keys(x) k
                     where not k = any (array['id', 'position', 'name_he', 'name_en', 'price', 'max_qty', 'is_default', 'opens_group_id']));
    if not app.uuid_ok(x->'id') then errs := errs || app.issue('id_invalid', at || '.id');
    elsif lower(x->>'id') = any (ids) then errs := errs || app.issue('id_duplicate', at || '.id');
    else ids := ids || lower(x->>'id');
    end if;
    if x ? 'position' and not (app.js_int(x->'position') and (x->>'position')::numeric between 0 and 100000) then
      errs := errs || app.issue('position_invalid', at || '.position');
    end if;
    errs := errs || app.v_optional_text(x->'name_he', at || '.name_he', 60) || app.v_optional_text(x->'name_en', at || '.name_en', 60);
    if app.strip_blank(coalesce(case when app.js_str(x->'name_he') then x->>'name_he' end, '')) = ''
       and app.strip_blank(coalesce(case when app.js_str(x->'name_en') then x->>'name_en' end, '')) = '' then
      errs := errs || app.issue('name_missing', at);
    end if;
    if x ? 'price' and not (app.js_int(x->'price') and (x->>'price')::numeric between 0 and 10000000) then errs := errs || app.issue('price_invalid', at || '.price'); end if;
    if x ? 'max_qty' and not (app.js_int(x->'max_qty') and (x->>'max_qty')::numeric between 1 and 10) then errs := errs || app.issue('qty_invalid', at || '.max_qty');
    elsif not app.js_null(coalesce(x->'opens_group_id', 'null'::jsonb)) and coalesce((x->>'max_qty')::integer, 1) <> 1 then
      errs := errs || app.issue('qty_invalid', at || '.max_qty');
    end if;
    if x ? 'is_default' and jsonb_typeof(x->'is_default') <> 'boolean' then errs := errs || app.issue('type', at || '.is_default');
    elsif x->'is_default' = 'true'::jsonb then defaults := defaults + 1;
    end if;
    if not app.js_null(coalesce(x->'opens_group_id', 'null'::jsonb)) then
      if not app.uuid_ok(x->'opens_group_id') then errs := errs || app.issue('id_invalid', at || '.opens_group_id');
      elsif lower(x->>'opens_group_id') = gid then errs := errs || app.issue('nesting_invalid', at || '.opens_group_id');
      end if;
    end if;
  end loop;
  if hi is not null and defaults > hi then errs := errs || app.issue('defaults_invalid', 'options'); end if;
  if lo is not null and units is not null and jsonb_array_length(o) > 0 and lo > units then errs := errs || app.issue('min_unreachable', 'group.min_units'); end if;
  return errs;
end $$;

-- a group and its options as the tables hold them (the rows PostgREST would return), options in menu order
create function app.addon_group_json(p_group uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('group', to_jsonb(g),
    'options', coalesce((select jsonb_agg(to_jsonb(o) order by o.position, o.id) from public.addon_options o where o.group_id = g.id), '[]'::jsonb))
  from public.addon_groups g where g.id = p_group
$$;

create function public.save_addon_group(p_venue uuid, p_group jsonb, p_options jsonb, p_expected_updated_at timestamptz default null,
                                        p_confirm_rule_removal boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; gid uuid; g public.addon_groups; existed boolean; ng record; opts jsonb; bad text; gone uuid[]; rules uuid[];
  changed integer := 0; n integer; msg text; st text; cname text;
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue and archived_at is null) then return app.fail('venue_unknown'); end if;
  errs := app.validate_addon_group_input(jsonb_build_object('venueId', p_venue, 'group', p_group, 'options', p_options));
  if jsonb_array_length(errs) > 0 then return jsonb_build_object('ok', false, 'code', errs->0->>'code', 'path', errs->0->>'path'); end if;
  perform pg_advisory_xact_lock(hashtext('addon-nesting:' || p_venue::text));
  gid := (p_group->>'id')::uuid;
  if exists (select 1 from public.addon_groups where id = gid and venue_id <> p_venue) then
    return jsonb_build_object('ok', false, 'code', 'not_allowed', 'path', 'group.id');
  end if;

  -- the input as the triggers will store it (blank edges stripped, the table's defaults for what is left out)
  select gid as id, app.strip_blank(coalesce(p_group->>'label', '')) as label, app.strip_blank(coalesce(p_group->>'name_he', '')) as name_he,
         app.strip_blank(coalesce(p_group->>'name_en', '')) as name_en, coalesce(p_group->>'selection', 'single') as selection,
         coalesce((p_group->>'min_units')::integer, 0) as min_units, coalesce((p_group->>'max_units')::integer, 1) as max_units,
         (p_group->>'limits_confirmed')::boolean as limits_confirmed
  into ng;
  select coalesce(jsonb_agg(jsonb_build_object('i', t.i - 1, 'id', (t.e->>'id')::uuid, 'position', coalesce((t.e->>'position')::integer, (t.i - 1)::integer),
           'name_he', app.strip_blank(coalesce(t.e->>'name_he', '')), 'name_en', app.strip_blank(coalesce(t.e->>'name_en', '')),
           'price', coalesce((t.e->>'price')::integer, 0), 'max_qty', coalesce((t.e->>'max_qty')::integer, 1),
           'is_default', coalesce((t.e->>'is_default')::boolean, false), 'opens_group_id', (t.e->>'opens_group_id')::uuid) order by t.i), '[]'::jsonb)
  into opts from jsonb_array_elements(p_options) with ordinality t(e, i);

  -- an option id of another venue or another group is not this group's to change; a group it opens must be the venue's
  select format('options[%s].id', o->>'i') into bad from jsonb_array_elements(opts) o
  where exists (select 1 from public.addon_options x where x.id = (o->>'id')::uuid and (x.venue_id <> p_venue or x.group_id <> gid))
  order by (o->>'i')::integer limit 1;
  if bad is not null then return jsonb_build_object('ok', false, 'code', 'not_allowed', 'path', bad); end if;
  select format('options[%s].opens_group_id', o->>'i') into bad from jsonb_array_elements(opts) o
  where o->>'opens_group_id' is not null
    and not exists (select 1 from public.addon_groups y where y.id = (o->>'opens_group_id')::uuid and y.venue_id = p_venue)
  order by (o->>'i')::integer limit 1;
  if bad is not null then return jsonb_build_object('ok', false, 'code', 'group_unknown', 'path', bad); end if;

  select * into g from public.addon_groups where id = gid for update;
  existed := found;
  if existed then
    -- the same input again (a retry): nothing to do, whatever updated_at the client sent
    if (g.label, g.name_he, g.name_en, g.selection, g.min_units, g.max_units) = (ng.label, ng.name_he, ng.name_en, ng.selection, ng.min_units, ng.max_units)
       and (ng.limits_confirmed is null or ng.limits_confirmed = g.limits_confirmed)
       and (select count(*) from public.addon_options x where x.group_id = gid) = jsonb_array_length(opts)
       and not exists (select 1 from jsonb_array_elements(opts) o left join public.addon_options x on x.id = (o->>'id')::uuid and x.group_id = gid
                       where x.id is null
                          or (x.position, x.name_he, x.name_en, x.price, x.max_qty, x.is_default, x.opens_group_id)
                             is distinct from ((o->>'position')::integer, o->>'name_he', o->>'name_en', (o->>'price')::integer, (o->>'max_qty')::integer,
                                               (o->>'is_default')::boolean, (o->>'opens_group_id')::uuid)) then
      return jsonb_build_object('ok', true) || app.addon_group_json(gid);
    end if;
    if p_expected_updated_at is distinct from g.updated_at then
      return jsonb_build_object('ok', false, 'code', 'stale', 'current', app.addon_group_json(gid));
    end if;
  end if;

  -- the dishes that offer the group (its links, in id order; the first refused answers) keep limits that still hold,
  -- against the input's limits and its options' capacity (a group's own change never fires the link's trigger):
  -- never looser than the group (limits_loosened, what app.guard_dish_addon refuses when a link is written), else a
  -- minimum within the maximum and the capacity (limits_invalid)
  select format('dishGroups.%s', l.id),
         case when (l.min_units is not null and l.min_units < ng.min_units) or (l.max_units is not null and l.max_units > ng.max_units)
              then 'limits_loosened' else 'limits_invalid' end
  into bad, msg
  from public.dish_addon_groups l,
       (select coalesce(sum((o->>'max_qty')::integer), 0) as units from jsonb_array_elements(opts) o) cap
  where l.group_id = gid
    and ((l.min_units is not null and l.min_units < ng.min_units) or (l.max_units is not null and l.max_units > ng.max_units)
         or coalesce(l.min_units, ng.min_units) > coalesce(l.max_units, ng.max_units) or coalesce(l.min_units, ng.min_units) > cap.units)
  order by l.id limit 1;
  if bad is not null then return jsonb_build_object('ok', false, 'code', msg, 'path', bad); end if;

  select coalesce(array_agg(x.id order by x.id), '{}') into gone from public.addon_options x
  where x.group_id = gid and not exists (select 1 from jsonb_array_elements(opts) o where (o->>'id')::uuid = x.id);
  select coalesce(array_agg(r.id order by r.id), '{}') into rules from public.upsell_rules r where r.venue_id = p_venue and r.suggest_option_id = any (gone);
  if cardinality(rules) > 0 and not coalesce(p_confirm_rule_removal, false) then
    return jsonb_build_object('ok', false, 'code', 'option_in_rules', 'rules', to_jsonb(rules));
  end if;

  begin
    perform set_config('mana.via', 'rpc', true);
    if not existed then
      insert into public.addon_groups (id, venue_id, label, name_he, name_en, selection, min_units, max_units, limits_confirmed)
      values (gid, p_venue, ng.label, ng.name_he, ng.name_en, ng.selection, ng.min_units, ng.max_units, coalesce(ng.limits_confirmed, true));
    elsif (g.label, g.name_he, g.name_en, g.selection, g.min_units, g.max_units) is distinct from (ng.label, ng.name_he, ng.name_en, ng.selection, ng.min_units, ng.max_units)
          or (ng.limits_confirmed is not null and ng.limits_confirmed <> g.limits_confirmed) then
      -- changing the limits confirms them (as app.guard_group_limits does for a direct write)
      update public.addon_groups set label = ng.label, name_he = ng.name_he, name_en = ng.name_en, selection = ng.selection,
        min_units = ng.min_units, max_units = ng.max_units,
        limits_confirmed = case when (g.min_units, g.max_units) is distinct from (ng.min_units, ng.max_units) then true
                                else coalesce(ng.limits_confirmed, g.limits_confirmed) end
      where id = gid;
    end if;
    -- DESTRUCTIVE-LOOKING (when the function runs): deletes the group's options the input left out, as the owner asked
    delete from public.addon_options where group_id = gid and id = any (gone);
    get diagnostics n = row_count;
    changed := changed + n;
    insert into public.addon_options as t (id, venue_id, group_id, position, name_he, name_en, price, max_qty, is_default, opens_group_id)
    select (o->>'id')::uuid, p_venue, gid, (o->>'position')::integer, o->>'name_he', o->>'name_en', (o->>'price')::integer, (o->>'max_qty')::integer,
           (o->>'is_default')::boolean, (o->>'opens_group_id')::uuid
    from jsonb_array_elements(opts) o order by (o->>'i')::integer
    on conflict (id) do update set position = excluded.position, name_he = excluded.name_he, name_en = excluded.name_en, price = excluded.price,
      max_qty = excluded.max_qty, is_default = excluded.is_default, opens_group_id = excluded.opens_group_id
    where (t.position, t.name_he, t.name_en, t.price, t.max_qty, t.is_default, t.opens_group_id)
          is distinct from (excluded.position, excluded.name_he, excluded.name_en, excluded.price, excluded.max_qty, excluded.is_default, excluded.opens_group_id);
    get diagnostics n = row_count;
    changed := changed + n;
    -- the group's version moves with its options (updated_at alone is not activity: no log row)
    if existed and changed > 0 then update public.addon_groups set updated_at = now() where id = gid and updated_at is distinct from now(); end if;
    perform set_config('mana.via', '', true);
  exception
    when raise_exception then
      get stacked diagnostics msg = message_text;
      return jsonb_build_object('ok', false, 'code', msg);
    when integrity_constraint_violation then
      get stacked diagnostics st = returned_sqlstate, cname = constraint_name;
      return jsonb_build_object('ok', false, 'code', case st when '23503' then 'group_unknown' when '23505' then 'conflict' else 'invalid' end, 'constraint', cname);
  end;
  return jsonb_build_object('ok', true) || app.addon_group_json(gid);
end $$;

-- ================================================================ the activity log as the owner reads it (ActivityEntry)
-- The name of the one row an entry is about, read now (sections, dishes, add-on groups and options by their names;
-- upsell rules by their label); null for other tables or when the row is gone
create function app.target_name(p_venue uuid, p_table text, p_id text) returns jsonb language sql stable security definer set search_path = '' as $$
  select case p_table
    when 'sections' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.sections x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
    when 'dishes' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.dishes x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
    when 'addon_groups' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.addon_groups x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
    when 'addon_options' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.addon_options x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
    when 'upsell_rules' then (select jsonb_build_object('he', x.label, 'en', x.label) from public.upsell_rules x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
  end
$$;

-- `you`: the reader made the change. The actor's id never leaves: Halom's staff are never named to the owner.
create function app.activity_entry(p_row public.activity_log, p_viewer uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p_row.id, 'at', app.iso(p_row.at), 'actorKind', p_row.actor_kind, 'you', coalesce(p_row.actor_id = p_viewer, false),
    'via', p_row.via, 'action', p_row.action, 'targetTable', p_row.target_table, 'targetIds', to_jsonb(p_row.target_ids), 'n', p_row.n,
    'targetName', case when cardinality(p_row.target_ids) = 1 then app.target_name(p_row.venue_id, p_row.target_table, p_row.target_ids[1]) end,
    'reason', p_row.reason, 'detail', p_row.detail)
$$;

-- venue_activity: one page of a venue's log, newest first (owners, managers, Halom staff)
create function public.venue_activity(p_venue uuid, p_before bigint default null, p_limit integer default 50, p_actor text default null,
                                      p_via text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare errs jsonb; entries jsonb; last_id bigint; more boolean;
begin
  if not app.can_see_records(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  errs := app.validate_activity_query(jsonb_strip_nulls(jsonb_build_object('venueId', p_venue, 'before', p_before, 'limit', p_limit, 'actor', p_actor, 'via', p_via)));
  if jsonb_array_length(errs) > 0 then raise exception '%', errs->0->>'code' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(app.activity_entry(z.l, (select auth.uid())) order by (z.l).id desc), '[]'::jsonb), min((z.l).id) into entries, last_id
  from (select l from public.activity_log l
        where l.venue_id = p_venue and (p_before is null or l.id < p_before) and (p_actor is null or l.actor_kind = p_actor) and (p_via is null or l.via = p_via)
        order by l.id desc limit coalesce(p_limit, 50)) z;
  more := last_id is not null and exists (select 1 from public.activity_log l where l.venue_id = p_venue and l.id < last_id
                                            and (p_actor is null or l.actor_kind = p_actor) and (p_via is null or l.via = p_via));
  return jsonb_build_object('entries', entries, 'next', case when more then last_id end);
end $$;

-- ================================================================ the owner's menu as JSON (F08 "export, any time")
-- a row as stored, its timestamps through app.iso
create function app.row_times(p jsonb, p_keys text[]) returns jsonb language sql stable set search_path = '' as $$
  select p || coalesce((select jsonb_object_agg(k, to_jsonb(app.iso((p->>k)::timestamptz))) from unnest(p_keys) k where p->>k is not null), '{}'::jsonb)
$$;

create function public.export_menu(p_venue uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v record; out jsonb; counts jsonb; t text[] := array['created_at', 'updated_at'];
begin
  if not app.can_see_records(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v from public.venues where id = p_venue;
  if not found then raise exception 'venue_unknown' using errcode = '22023'; end if;
  out := jsonb_build_object(
    'v', 1, 'kind', 'mana.menu_export', 'exportedAt', app.iso(now()),
    'venue', jsonb_build_object('id', v.id, 'slug', v.slug, 'name', jsonb_build_object('he', v.name_he, 'en', v.name_en), 'kind', v.kind, 'mode', v.mode,
                                'timeZone', v.time_zone, 'defaultLang', v.default_lang, 'langs', to_jsonb(v.langs), 'soldOutDisplay', v.sold_out_display),
    'publishedRevision', (select r.number from public.menu_revisions r where r.id = v.published_revision_id),
    'assetBase', app.cfg('public_base') #>> '{}',
    'tables', jsonb_build_object(
      'schedules', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.id), '[]') from public.schedules x where x.venue_id = p_venue),
      'sections', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.position, x.id), '[]') from public.sections x where x.venue_id = p_venue),
      'dishes', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.position, x.id), '[]') from public.dishes x where x.venue_id = p_venue),
      'addon_groups', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.id), '[]') from public.addon_groups x where x.venue_id = p_venue),
      'addon_options', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.position, x.id), '[]') from public.addon_options x where x.venue_id = p_venue),
      'dish_addon_groups', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.position, x.id), '[]') from public.dish_addon_groups x where x.venue_id = p_venue),
      'dish_relations', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.position, x.id), '[]') from public.dish_relations x where x.venue_id = p_venue),
      'upsell_rules', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.id), '[]') from public.upsell_rules x where x.venue_id = p_venue),
      'venue_hours', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.id), '[]') from public.venue_hours x where x.venue_id = p_venue),
      'venue_closures', (select coalesce(jsonb_agg(app.row_times(to_jsonb(x), t) order by x.id), '[]') from public.venue_closures x where x.venue_id = p_venue),
      -- pictures: their public files only (the owner's original upload stays in the private bucket)
      'assets', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'dish_id', x.dish_id, 'kind', x.kind, 'status', x.status, 'relief_class', x.relief_class,
                                                              'color_path', x.color_path, 'aux_path', x.aux_path, 'thumb_path', x.thumb_path) order by x.id), '[]')
                 from public.assets x where x.venue_id = p_venue)));
  select jsonb_object_agg(key, jsonb_array_length(value)) into counts from jsonb_each(out->'tables');
  perform set_config('mana.via', 'rpc', true);
  perform app.log(p_venue, 'menu.export', 'venues', array[p_venue::text], jsonb_build_object('counts', counts));
  perform set_config('mana.via', '', true);
  return out;
end $$;

-- ================================================================ the client dashboard v2 (F08, ClientDashboard)
-- totals, opens by source and language, top dishes, for local days p_from..p_to (counted as the venue counts: demo
-- traffic on a demo venue, real traffic otherwise)
create function app.dash_numbers(p_venue uuid, p_demo boolean, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with r as (
    select name, key, sum(n)::bigint as n from public.rollups_day
    where venue_id = p_venue and demo = p_demo and day between p_from and p_to group by name, key),
  t as (select name, n from r where key = '')
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'menuOpens', coalesce((select n from t where name = 'menu_opened'), 0),
      'dishViews', coalesce((select n from t where name = 'dish_viewed'), 0),
      'addonsChosen', coalesce((select n from t where name = 'addon_chosen'), 0),
      'basketAdds', coalesce((select n from t where name = 'basket_added'), 0),
      'suggestionsShown', coalesce((select n from t where name = 'suggestion_shown'), 0),
      'suggestionsAccepted', coalesce((select n from t where name = 'suggestion_accepted'), 0),
      'suggestionsDismissed', coalesce((select n from t where name = 'suggestion_dismissed'), 0)),
    'opensBy', jsonb_build_object(
      'qr', coalesce((select n from r where name = 'menu_opened' and key = 'src:qr'), 0),
      'link', coalesce((select n from r where name = 'menu_opened' and key = 'src:link'), 0),
      'he', coalesce((select n from r where name = 'menu_opened' and key = 'lang:he'), 0),
      'en', coalesce((select n from r where name = 'menu_opened' and key = 'lang:en'), 0)),
    'topDishes', coalesce((
      select jsonb_agg(jsonb_build_object('dishId', d.id, 'name', jsonb_build_object('he', d.name_he, 'en', d.name_en), 'views', z.views, 'adds', z.adds)
                       order by z.views desc, z.adds desc, d.id)
      from (select substr(key, 6)::uuid as dish_id,
                   coalesce(sum(n) filter (where name = 'dish_viewed'), 0) as views,
                   coalesce(sum(n) filter (where name = 'basket_added'), 0) as adds
            from r where key like 'dish:%' and name in ('dish_viewed', 'basket_added') group by 1
            order by 2 desc, 3 desc, 1 limit 10) z
      join public.dishes d on d.id = z.dish_id), '[]'::jsonb))
$$;

-- The name of what an override takes off, now (empty when the row is gone)
create function app.target_text(p_venue uuid, p_kind text, p_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(case p_kind
    when 'section' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.sections x where x.id = p_id and x.venue_id = p_venue)
    when 'dish' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.dishes x where x.id = p_id and x.venue_id = p_venue)
    when 'option' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.addon_options x where x.id = p_id and x.venue_id = p_venue)
  end, jsonb_build_object('he', '', 'en', ''))
$$;

-- Nudges, in NUDGE_CODES order, each with how many and up to 20 targets (in menu order for dishes and groups). A dish
-- "guests can see" is not hidden and neither is its section.
create function app.dashboard_nudges(p_venue uuid, p_progress jsonb) returns jsonb language sql stable security definer set search_path = '' as $$
  with vis as (
    select d.id, d.price, d.asset_id, row_number() over (order by s.position, s.created_at, s.id, d.position, d.created_at, d.id) as ord
    from public.dishes d join public.sections s on s.id = d.section_id
    where d.venue_id = p_venue and not d.hidden and not s.hidden),
  grp as (
    select g.id, min(vis.ord) as ord from public.dish_addon_groups l join vis on vis.id = l.dish_id join public.addon_groups g on g.id = l.group_id
    where not g.limits_confirmed group by g.id),
  n (i, code, cnt, targets) as (
    select 1, 'approval_pending', count(*), coalesce(jsonb_agg(jsonb_build_object('kind', 'venue', 'id', v.id)), '[]'::jsonb)
    from public.venues v where v.id = p_venue and v.approved_at is null and v.first_published_at is not null
    union all
    select 2, 'onboarding_step', ((p_progress->>'total')::integer - (p_progress->>'done')::integer)::bigint,
           case when p_progress->>'next' is not null then jsonb_build_array(jsonb_build_object('kind', 'step', 'id', p_progress->>'next')) else '[]'::jsonb end
    union all
    select 3, 'import_waiting', (select count(*) from public.menu_imports where venue_id = p_venue and status = 'parsed'),
           (select coalesce(jsonb_agg(jsonb_build_object('kind', 'import', 'id', x.id) order by x.created_at desc, x.id), '[]'::jsonb)
            from (select id, created_at from public.menu_imports where venue_id = p_venue and status = 'parsed' order by created_at desc, id limit 20) x)
    union all
    select 4, 'case_waiting_owner', (select count(*) from public.support_cases where venue_id = p_venue and status = 'waiting_owner'),
           (select coalesce(jsonb_agg(jsonb_build_object('kind', 'case', 'id', x.id) order by x.created_at desc, x.id), '[]'::jsonb)
            from (select id, created_at from public.support_cases where venue_id = p_venue and status = 'waiting_owner' order by created_at desc, id limit 20) x)
    union all
    select 5, 'dish_no_price', (select count(*) from vis where price is null),
           (select coalesce(jsonb_agg(jsonb_build_object('kind', 'dish', 'id', x.id) order by x.ord), '[]'::jsonb)
            from (select id, ord from vis where price is null order by ord limit 20) x)
    union all
    select 6, 'dish_no_photo', (select count(*) from vis where asset_id is null),
           (select coalesce(jsonb_agg(jsonb_build_object('kind', 'dish', 'id', x.id) order by x.ord), '[]'::jsonb)
            from (select id, ord from vis where asset_id is null order by ord limit 20) x)
    union all
    select 7, 'group_without_limits', (select count(*) from grp),
           (select coalesce(jsonb_agg(jsonb_build_object('kind', 'group', 'id', x.id) order by x.ord, x.id), '[]'::jsonb)
            from (select id, ord from grp order by ord, id limit 20) x))
  select coalesce(jsonb_agg(jsonb_build_object('code', n.code, 'count', n.cnt, 'targets', n.targets) order by n.i), '[]'::jsonb) from n where n.cnt > 0
$$;

-- my_dashboard v2: every phase-0 field, and v, views and adds per minute, a rule's trigger and why it is off, what is
-- off now with its name and since when, onboarding steps with auto and updatedAt, progress, nudges, activity entries,
-- and today at a glance whatever the range
create or replace function public.my_dashboard(p_venue uuid, p_range text default 'today') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v record; d1 date; d0 date; ndays integer; errs jsonb; nums jsonb; today jsonb; prog jsonb;
begin
  if not app.can_see_records(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  errs := app.validate_dashboard_query(jsonb_build_object('venueId', p_venue, 'range', p_range));
  if jsonb_array_length(errs) > 0 then raise exception '%', errs->0->>'code' using errcode = '22023'; end if;
  select * into v from public.venues where id = p_venue;
  if not found then raise exception 'venue_unknown' using errcode = '22023'; end if;
  ndays := case p_range when 'today' then 1 when '7d' then 7 else 30 end;
  d1 := app.local_date(now(), v.time_zone);
  d0 := d1 - (ndays - 1);
  nums := app.dash_numbers(p_venue, v.is_demo, d0, d1);
  today := case when ndays = 1 then nums else app.dash_numbers(p_venue, v.is_demo, d1, d1) end;
  prog := app.onboarding_progress_json(p_venue);
  return jsonb_build_object(
    'v', 2, 'venueId', p_venue, 'range', p_range, 'from', d0, 'to', d1, 'timeZone', v.time_zone, 'demo', v.is_demo,
    'generatedAt', app.iso(now()),
    'rolledUpAt', (select app.iso(last_run_at) from app.rollup_state),
    'totals', nums->'totals',
    'opensBy', nums->'opensBy',
    'days', (
      select jsonb_agg(jsonb_build_object('day', z.day, 'opens', z.opens, 'views', z.views, 'adds', z.adds,
                                          'capped', exists (select 1 from app.event_capped_days c where c.venue_id = p_venue and c.day = z.day)) order by z.day)
      from (select g.d::date as day,
                   coalesce(sum(x.n) filter (where x.name = 'menu_opened'), 0) as opens,
                   coalesce(sum(x.n) filter (where x.name = 'dish_viewed'), 0) as views,
                   coalesce(sum(x.n) filter (where x.name = 'basket_added'), 0) as adds
            from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g(d)
            left join public.rollups_day x on x.venue_id = p_venue and x.demo = v.is_demo and x.day = g.d::date and x.key = ''
            group by g.d) z),
    'capped', coalesce((select jsonb_agg(jsonb_build_object('day', c.day, 'dropped', c.dropped) order by c.day)
                        from app.event_capped_days c where c.venue_id = p_venue and c.day between d0 and d1), '[]'::jsonb),
    'lastHour', coalesce((
      select jsonb_agg(jsonb_build_object('minute', app.iso(z.bucket), 'opens', z.opens, 'views', z.views, 'adds', z.adds) order by z.bucket)
      from (select m.bucket,
                   coalesce(sum(m.n) filter (where m.name = 'menu_opened'), 0) as opens,
                   coalesce(sum(m.n) filter (where m.name = 'dish_viewed'), 0) as views,
                   coalesce(sum(m.n) filter (where m.name = 'basket_added'), 0) as adds
            from public.rollups_minute m
            where m.venue_id = p_venue and m.demo = v.is_demo and m.key = '' and m.name in ('menu_opened', 'dish_viewed', 'basket_added')
              and m.bucket >= date_trunc('minute', now()) - interval '59 minutes'
            group by m.bucket) z), '[]'::jsonb),
    'topDishes', nums->'topDishes',
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object('ruleId', u.id, 'label', u.label, 'line', jsonb_build_object('he', u.line_he, 'en', u.line_en),
               'trigger', u.trigger, 'active', u.active, 'inactiveReason', u.inactive_reason,
               'shown', coalesce((select sum(r.n) from public.rollups_day r where r.venue_id = p_venue and r.demo = v.is_demo and r.day between d0 and d1
                                    and r.name = 'suggestion_shown' and r.key = 'rule:' || u.id), 0),
               'accepted', coalesce((select sum(r.n) from public.rollups_day r where r.venue_id = p_venue and r.demo = v.is_demo and r.day between d0 and d1
                                       and r.name = 'suggestion_accepted' and r.key = 'rule:' || u.id), 0),
               'dismissed', coalesce((select sum(r.n) from public.rollups_day r where r.venue_id = p_venue and r.demo = v.is_demo and r.day between d0 and d1
                                        and r.name = 'suggestion_dismissed' and r.key = 'rule:' || u.id), 0))
             order by u.priority desc, u.id)
      from public.upsell_rules u where u.venue_id = p_venue), '[]'::jsonb),
    'offNow', coalesce((
      select jsonb_agg(jsonb_build_object('overrideId', o.id, 'kind', o.target_kind, 'id', o.target_id, 'name', app.target_text(p_venue, o.target_kind, o.target_id),
                                          'from', app.iso(o.starts_at), 'until', app.iso(o.until_at), 'untilKind', o.until_kind, 'by', o.created_by_kind,
                                          'today', app.local_date(o.starts_at, v.time_zone) = d1)
                       order by o.created_at, o.id)
      from public.availability_overrides o
      where o.venue_id = p_venue and o.restored_at is null and o.starts_at <= now() and (o.until_at is null or o.until_at > now())), '[]'::jsonb),
    'menu', jsonb_build_object('live', v.published_revision_id is not null,
      'revision', (select number from public.menu_revisions where id = v.published_revision_id),
      'lastPublishedAt', app.iso(v.last_published_at),
      'review', app.review_of(v.approved_at, v.first_published_at)),
    'onboarding', prog->'steps',
    'progress', prog - 'steps',
    'nudges', app.dashboard_nudges(p_venue, prog),
    'activity', coalesce((
      select jsonb_agg(app.activity_entry(z.l, (select auth.uid())) order by (z.l).id desc)
      from (select l from public.activity_log l where l.venue_id = p_venue order by l.id desc limit 20) z), '[]'::jsonb),
    'today', today);
end $$;

-- ================================================================ the back office (F09): one venue's row, the fleet's totals
-- OpsVenueRow. Opens and suggestions count the venue's own kind of traffic (demo on a demo venue, real otherwise).
-- Warnings follow the rules on OPS_WARNINGS, in that order.
create function app.ops_row(p_v public.venues) returns jsonb language sql stable security definer set search_path = '' as $$
  with steps as (
    select u.s as step, u.i, coalesce(p.state, 'todo') as state, coalesce(p.blockers, '{}') as blockers, p.updated_at
    from unnest(app.onboarding_steps()) with ordinality u(s, i)
    left join public.onboarding_progress p on p.venue_id = p_v.id and p.step = u.s),
  nxt as (select st.step, coalesce(st.updated_at, p_v.created_at) as since from steps st where st.state not in ('done', 'skipped') order by st.i limit 1),
  ent as (select e.plan, e.trial_ends_at from public.entitlements e where e.venue_id = p_v.id),
  loc as (select app.local_date(now(), p_v.time_zone) as today),
  vis as (select d.asset_id from public.dishes d join public.sections s on s.id = d.section_id where d.venue_id = p_v.id and not d.hidden and not s.hidden),
  imp as (select i.status, i.created_at from public.menu_imports i where i.venue_id = p_v.id),
  sug as (
    select coalesce(sum(r.n) filter (where r.name = 'suggestion_shown'), 0) as shown,
           coalesce(sum(r.n) filter (where r.name = 'suggestion_accepted'), 0) as accepted,
           coalesce(sum(r.n) filter (where r.name = 'suggestion_dismissed'), 0) as dismissed
    from public.rollups_day r, loc
    where r.venue_id = p_v.id and r.demo = p_v.is_demo and r.key = '' and r.day > loc.today - 7
      and r.name in ('suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed'))
  select jsonb_build_object(
    'id', p_v.id, 'slug', p_v.slug, 'name', jsonb_build_object('he', p_v.name_he, 'en', p_v.name_en), 'kind', p_v.kind, 'mode', p_v.mode,
    'isDemo', p_v.is_demo, 'createdAt', app.iso(p_v.created_at), 'supportCanAct', p_v.support_can_act,
    'review', app.review_of(p_v.approved_at, p_v.first_published_at), 'approvedAt', app.iso(p_v.approved_at),
    'onboarding', jsonb_build_object(
      'stage', coalesce((select step from nxt), 'complete'),
      'done', (select count(*) from steps where state in ('done', 'skipped')),
      'total', cardinality(app.onboarding_steps()),
      'since', (select app.iso(since) from nxt),
      'blocked', (select coalesce(jsonb_agg(jsonb_build_object('step', step, 'blockers', to_jsonb(blockers)) order by i), '[]'::jsonb)
                  from steps where state = 'blocked' or cardinality(blockers) > 0)),
    'menu', jsonb_build_object('live', p_v.published_revision_id is not null,
      'revision', (select number from public.menu_revisions where id = p_v.published_revision_id),
      'firstPublishedAt', app.iso(p_v.first_published_at), 'lastPublishedAt', app.iso(p_v.last_published_at)),
    'opens', jsonb_build_object(
      'today', (select coalesce(sum(r.n), 0) from public.rollups_day r, loc where r.venue_id = p_v.id and r.demo = p_v.is_demo and r.name = 'menu_opened'
                  and r.key = '' and r.day = loc.today),
      'last7d', (select coalesce(sum(r.n), 0) from public.rollups_day r, loc where r.venue_id = p_v.id and r.demo = p_v.is_demo and r.name = 'menu_opened'
                   and r.key = '' and r.day > loc.today - 7),
      'lastHour', (select coalesce(sum(m.n), 0) from public.rollups_minute m where m.venue_id = p_v.id and m.demo = p_v.is_demo and m.name = 'menu_opened'
                     and m.key = '' and m.bucket >= now() - interval '1 hour')),
    'cappedToday', exists (select 1 from app.event_capped_days c, loc where c.venue_id = p_v.id and c.day = loc.today),
    'suggestions7d', (select jsonb_build_object('shown', shown, 'accepted', accepted, 'dismissed', dismissed) from sug),
    'photos', jsonb_build_object(
      'dishes', (select count(*) from vis),
      'withPhoto', (select count(*) from vis where asset_id is not null),
      'awaitingReview', (select count(*) from public.assets a where a.venue_id = p_v.id and a.status = 'ready_for_review')),
    'imports', jsonb_build_object(
      'total', (select count(*) from imp),
      'lastAt', (select app.iso(max(created_at)) from imp),
      'lastStatus', (select status from imp order by created_at desc limit 1),
      'failed2d', (select count(*) from imp where status = 'failed' and created_at > now() - interval '2 days')),
    'openCases', (select count(*) from public.support_cases c where c.venue_id = p_v.id and c.status <> 'resolved'),
    'lastOwnerSignInAt', (select app.iso(max(u.last_sign_in_at)) from auth.users u join public.venue_members m on m.user_id = u.id
                          where m.venue_id = p_v.id and m.role = 'owner'),
    'lastActivityAt', (select app.iso(max(a.at)) from public.activity_log a where a.venue_id = p_v.id),
    'plan', jsonb_build_object('plan', (select plan from ent), 'state', app.entitlement_state(p_v.id), 'trialEndsAt', (select app.iso(trial_ends_at) from ent)),
    'warnings', to_jsonb(array_remove(array[
      case when p_v.approved_at is null and p_v.first_published_at is not null then 'awaiting_review' end,
      case when exists (select 1 from nxt where since < now() - interval '2 days') then 'stuck_step_2d' end,
      case when p_v.published_revision_id is null and p_v.first_published_at is null and p_v.created_at < now() - interval '2 days' then 'not_published_2d' end,
      case when p_v.last_published_at < now() - interval '7 days' then 'no_publish_7d' end,
      case when exists (select 1 from imp where status = 'failed' and created_at > now() - interval '2 days') then 'import_failed' end,
      case when exists (select 1 from public.support_cases c where c.venue_id = p_v.id and c.status in ('open', 'waiting_halom')) then 'case_open' end,
      case when exists (select 1 from public.support_cases c where c.venue_id = p_v.id and c.status in ('open', 'waiting_halom')
                          and c.created_at < now() - interval '1 day') then 'case_waiting' end,
      case when exists (select 1 from app.event_capped_days c, loc where c.venue_id = p_v.id and c.day > loc.today - 7) then 'events_capped' end
    ], null)))
$$;

-- OpsTotals: the whole fleet's numbers, real venues only (demo venues are counted apart)
create function app.ops_totals() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'venues', (select count(*) from public.venues where archived_at is null and not is_demo),
    'live', (select count(*) from public.venues where archived_at is null and not is_demo and published_revision_id is not null and approved_at is not null),
    'awaitingReview', (select count(*) from public.venues where archived_at is null and not is_demo and approved_at is null and first_published_at is not null),
    'demoVenues', (select count(*) from public.venues where archived_at is null and is_demo),
    'opensToday', (select coalesce(sum(r.n), 0) from public.rollups_day r join public.venues v on v.id = r.venue_id
                   where v.archived_at is null and not v.is_demo and not r.demo and r.day = app.local_date(now(), v.time_zone)
                     and r.name = 'menu_opened' and r.key = ''),
    'openCases', (select count(*) from public.support_cases c join public.venues v on v.id = c.venue_id where c.status <> 'resolved' and not v.is_demo),
    'actsForOwner7d', (select count(*) from public.activity_log a join public.venues v on v.id = a.venue_id
                       where a.via = 'act_for_owner' and a.action = 'support.act_for_owner' and a.at > now() - interval '7 days' and not v.is_demo))
$$;

-- ops_overview stays for the simulator, on the same row builder (its rows gain phase 1's fields); it goes when the
-- simulator moves to ops_venues
create or replace function public.ops_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  return jsonb_build_object(
    'generatedAt', app.iso(now()),
    'rolledUpAt', (select app.iso(last_run_at) from app.rollup_state),
    'totals', app.ops_totals(),
    'venues', coalesce((select jsonb_agg(app.ops_row(v) order by v.created_at desc, v.id) from public.venues v where v.archived_at is null), '[]'::jsonb));
end $$;

-- ops_venues: the clients list, filtered, sorted and paged (OpsVenuesQuery); 22023 with the validator's code
create function public.ops_venues(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare f jsonb := coalesce(p_filters, '{}'::jsonb); errs jsonb; lim integer; off integer; sort text; total integer; rows jsonb;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if octet_length(f::text) > 4000 then raise exception 'too_large' using errcode = '22023'; end if;
  errs := app.validate_ops_venues_query(f);
  if jsonb_array_length(errs) > 0 then raise exception '%', errs->0->>'code' using errcode = '22023'; end if;
  lim := coalesce((f->>'limit')::integer, 200);
  off := coalesce((f->>'offset')::integer, 0);
  sort := coalesce(f->>'sort', 'created');
  with r as (
    select v.id, v.created_at, v.name_he, v.name_en, v.is_demo, app.ops_row(v) as j from public.venues v where v.archived_at is null),
  m as (
    select r.* from r
    where (not (f ? 'q') or strpos(lower(r.name_he), lower(app.strip_blank(f->>'q'))) > 0 or strpos(lower(r.name_en), lower(app.strip_blank(f->>'q'))) > 0
           or strpos(lower(r.j->>'slug'), lower(app.strip_blank(f->>'q'))) > 0)
      and (not (f ? 'stage') or r.j->'onboarding'->>'stage' = f->>'stage')
      and (not (f ? 'warning') or r.j->'warnings' ? (f->>'warning'))
      and (not (f ? 'review') or r.j->>'review' = f->>'review')
      and (not (f ? 'planState') or r.j->'plan'->>'state' = f->>'planState')
      and (not (f ? 'plan') or r.j->'plan'->>'plan' = f->>'plan')
      and (case coalesce(f->>'demo', 'include') when 'exclude' then not r.is_demo when 'only' then r.is_demo else true end)),
  o as (
    select m.j, row_number() over (order by
      case when sort = 'activity' then m.j->>'lastActivityAt' end desc nulls last,
      case when sort = 'opens_today' then (m.j->'opens'->>'today')::bigint end desc nulls last,
      case when sort = 'name' then m.name_en = '' end, case when sort = 'name' then lower(m.name_en) end, case when sort = 'name' then lower(m.name_he) end,
      m.created_at desc, m.id) as rn
    from m)
  select (select count(*) from m), coalesce((select jsonb_agg(o.j order by o.rn) from o where o.rn > off and o.rn <= off + lim), '[]'::jsonb)
  into total, rows;
  return jsonb_build_object('generatedAt', app.iso(now()), 'rolledUpAt', (select app.iso(last_run_at) from app.rollup_state),
                            'totals', app.ops_totals(), 'total', total, 'venues', rows);
end $$;

-- OpsImport: what came in and what the reader made of it; never the raw input
create function app.ops_import(p_i public.menu_imports) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p_i.id, 'source', p_i.source, 'status', p_i.status, 'createdAt', app.iso(p_i.created_at), 'appliedAt', app.iso(p_i.applied_at),
    'errorCode', p_i.error_code, 'rightsConfirmed', p_i.rights_confirmed,
    'counts', case when p_i.parsed is null then null else app.draft_counts(p_i.parsed) end,
    'exceptions', jsonb_build_object(
      'fix', (select count(*) from jsonb_array_elements(p_i.exceptions) e where e->>'severity' = 'fix'),
      'check', (select count(*) from jsonb_array_elements(p_i.exceptions) e where e->>'severity' = 'check'),
      'byCode', (select coalesce(jsonb_object_agg(z.code, z.n), '{}'::jsonb)
                 from (select e->>'code' as code, count(*) as n from jsonb_array_elements(p_i.exceptions) e group by 1) z)))
$$;

-- ops_venue: one venue, everything support needs to follow it (no raw import input, no member's e-mail)
create function public.ops_venue(p_venue uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.venues;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  select * into v from public.venues where id = p_venue;
  if not found then raise exception 'venue_unknown' using errcode = '22023'; end if;
  return jsonb_build_object(
    'venue', app.ops_row(v),
    'members', (select jsonb_build_object('owners', count(*) filter (where role = 'owner'), 'managers', count(*) filter (where role = 'manager'),
                                          'counters', count(*) filter (where role = 'counter'))
                from public.venue_members where venue_id = p_venue),
    'onboarding', app.onboarding_progress_json(p_venue),
    'imports', coalesce((select jsonb_agg(app.ops_import(z.i) order by (z.i).created_at desc, (z.i).id)
                         from (select i from public.menu_imports i where i.venue_id = p_venue order by i.created_at desc, i.id limit 20) z), '[]'::jsonb),
    'cases', coalesce((select jsonb_agg(app.case_json(z.id) order by z.grp, z.at desc, z.id)
                       from (select c.id, 0 as grp, c.created_at as at from public.support_cases c where c.venue_id = p_venue and c.status <> 'resolved'
                             union all
                             select y.id, 1, y.at from (select c.id, coalesce(c.resolved_at, c.created_at) as at from public.support_cases c
                                                        where c.venue_id = p_venue and c.status = 'resolved' order by 2 desc, 1 limit 20) y) z), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(app.activity_entry(z.l, (select auth.uid())) order by (z.l).id desc)
                          from (select l from public.activity_log l where l.venue_id = p_venue order by l.id desc limit 100) z), '[]'::jsonb));
end $$;

-- ops_revision (added to ADR-008 on 16 Oct by the back-office lane): a stored revision of a venue's menu, as Halom
-- reviews it. Before approval public_menu answers "unavailable", and preview_menu builds from the live tables (which
-- the owner may have changed since publishing), so this is the menu Halom actually approves: the newest revision
-- unless a number is asked, with whether it is the published one and the venue's review state. The read is logged
-- (menu.read, the revision's number) on the venue's timeline, as the export is.
create function public.ops_revision(p_venue uuid, p_revision integer default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v public.venues; r public.menu_revisions; latest integer;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if p_revision is not null and p_revision < 1 then return app.fail('revision_invalid'); end if;
  perform set_config('mana.via', 'rpc', true);
  select * into v from public.venues where id = p_venue;
  if not found then return app.fail('venue_unknown'); end if;
  select max(number) into latest from public.menu_revisions where venue_id = p_venue;
  select * into r from public.menu_revisions where venue_id = p_venue and number = coalesce(p_revision, latest);
  if not found then return app.fail('revision_unknown'); end if;
  perform app.log(p_venue, 'menu.read', 'menu_revisions', array[r.id::text], jsonb_build_object('revision', r.number));
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'venueId', p_venue,
    'revision', jsonb_build_object('id', r.id, 'number', r.number, 'createdAt', app.iso(r.created_at), 'note', r.note,
                                   'live', r.id is not distinct from v.published_revision_id),
    'latest', latest, 'review', app.review_of(v.approved_at, v.first_published_at), 'snapshot', r.snapshot);
end $$;

-- ops_analytics: counts per minute or per day, across venues or for one, real traffic only unless the query says
-- otherwise (by each rollup's own label); the funnel of the venues created in the range; the imports created in it
create function public.ops_analytics(p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q jsonb := coalesce(p_query, '{}'::jsonb); errs jsonb; minute boolean; vid uuid; scope text; names text[];
  f timestamptz; t timestamptz; fd date; td date; buckets jsonb; series jsonb; totals jsonb; funnel jsonb; imports jsonb;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if octet_length(q::text) > 4000 then raise exception 'too_large' using errcode = '22023'; end if;
  errs := app.validate_ops_analytics_query(q);
  if jsonb_array_length(errs) > 0 then raise exception '%', errs->0->>'code' using errcode = '22023'; end if;
  minute := q->>'resolution' = 'minute';
  vid := app.as_uuid(q->>'venueId');
  scope := coalesce(q->>'demo', 'exclude');
  names := case when q ? 'names' then array(select jsonb_array_elements_text(q->'names')) else app.event_names() end;
  if minute then
    f := app.js_instant(q->'from');
    t := app.js_instant(q->'to');
    if f < now() - interval '35 days' then raise exception 'range_out_of_retention' using errcode = '22023'; end if;
    select jsonb_agg(app.iso(b) order by b) into buckets from generate_series(f, t - interval '1 minute', interval '1 minute') b;
    select jsonb_object_agg(z.name, z.counts) into series from (
      select nm.name, jsonb_agg(coalesce(c.n, 0) order by b.b) as counts
      from unnest(names) nm(name) cross join generate_series(f, t - interval '1 minute', interval '1 minute') b(b)
      left join (select r.name, r.bucket, sum(r.n) as n from public.rollups_minute r
                 where r.key = '' and r.bucket >= f and r.bucket < t and (vid is null or r.venue_id = vid)
                   and case scope when 'exclude' then not r.demo when 'only' then r.demo else true end
                 group by 1, 2) c on c.name = nm.name and c.bucket = b.b
      group by nm.name) z;
  else
    fd := (q->>'from')::date;
    td := (q->>'to')::date;
    select jsonb_agg(to_char(b, 'YYYY-MM-DD') order by b) into buckets from generate_series(fd::timestamp, td::timestamp, interval '1 day') b;
    select jsonb_object_agg(z.name, z.counts) into series from (
      select nm.name, jsonb_agg(coalesce(c.n, 0) order by b.b) as counts
      from unnest(names) nm(name) cross join generate_series(fd::timestamp, td::timestamp, interval '1 day') b(b)
      left join (select r.name, r.day, sum(r.n) as n from public.rollups_day r
                 where r.key = '' and r.day between fd and td and (vid is null or r.venue_id = vid)
                   and case scope when 'exclude' then not r.demo when 'only' then r.demo else true end
                 group by 1, 2) c on c.name = nm.name and c.day = b.b::date
      group by nm.name) z;
  end if;
  select jsonb_object_agg(x.key, (select coalesce(sum(y::bigint), 0) from jsonb_array_elements_text(x.value) y)) into totals from jsonb_each(series) x;

  with ven as (
    select v.* from public.venues v
    where (vid is null or v.id = vid) and case scope when 'exclude' then not v.is_demo when 'only' then v.is_demo else true end),
  made as (
    select v.* from ven v
    where case when minute then v.created_at >= f and v.created_at < t else app.local_date(v.created_at, v.time_zone) between fd and td end)
  select jsonb_build_object(
    'created', count(*),
    'imported', count(*) filter (where exists (select 1 from public.menu_imports i where i.venue_id = made.id and i.status = 'applied')),
    'published', count(*) filter (where made.first_published_at is not null),
    'approved', count(*) filter (where made.approved_at is not null))
  into funnel from made;

  with ven as (
    select v.id, v.time_zone from public.venues v
    where (vid is null or v.id = vid) and case scope when 'exclude' then not v.is_demo when 'only' then v.is_demo else true end),
  imp as (
    select i.source, i.status, i.exceptions,
           exists (select 1 from jsonb_array_elements(i.exceptions) e where e->>'severity' = 'fix') as with_fix
    from public.menu_imports i join ven on ven.id = i.venue_id
    where case when minute then i.created_at >= f and i.created_at < t else app.local_date(i.created_at, ven.time_zone) between fd and td end)
  select jsonb_build_object(
    'total', (select count(*) from imp),
    'parsed', (select count(*) from imp where status = 'parsed'),
    'applied', (select count(*) from imp where status = 'applied'),
    'discarded', (select count(*) from imp where status = 'discarded'),
    'failed', (select count(*) from imp where status = 'failed'),
    'withFix', (select count(*) from imp where with_fix),
    'exceptions', (select coalesce(sum(jsonb_array_length(exceptions)), 0) from imp),
    'bySource', (select jsonb_agg(jsonb_build_object('source', s.src, 'total', (select count(*) from imp where source = s.src),
                                                     'applied', (select count(*) from imp where source = s.src and status = 'applied'),
                                                     'failed', (select count(*) from imp where source = s.src and status = 'failed'),
                                                     'withFix', (select count(*) from imp where source = s.src and with_fix)) order by s.i)
                 from unnest(array['scan', 'paste', 'wolt_screenshots', 'wolt_text']) with ordinality s(src, i)),
    'byCode', (select coalesce(jsonb_agg(jsonb_build_object('code', z.code, 'n', z.n) order by z.n desc, array_position(app.import_exception_codes(), z.code)), '[]'::jsonb)
               from (select e->>'code' as code, count(*) as n from imp, jsonb_array_elements(imp.exceptions) e group by 1) z))
  into imports;

  return jsonb_build_object('generatedAt', app.iso(now()), 'rolledUpAt', (select app.iso(last_run_at) from app.rollup_state),
    'resolution', q->>'resolution', 'venueId', vid, 'demo', scope, 'buckets', coalesce(buckets, '[]'::jsonb), 'series', coalesce(series, '{}'::jsonb),
    'totals', coalesce(totals, '{}'::jsonb), 'funnel', funnel, 'imports', imports);
end $$;

-- ops_set_demo (admins): label a venue demo or real, with the reason the owner sees. Stored events and rollups keep the
-- label they were counted with; the switch applies from the next event.
create function public.ops_set_demo(p_venue uuid, p_demo boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb;
begin
  if app.staff_role() is distinct from 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;
  errs := app.validate_set_demo(jsonb_build_object('venueId', p_venue, 'demo', p_demo, 'reason', p_reason));
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  if not exists (select 1 from public.venues where id = p_venue and archived_at is null) then return app.fail('venue_unknown'); end if;
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.reason', app.strip_blank(p_reason), true);
  update public.venues set is_demo = p_demo where id = p_venue and is_demo is distinct from p_demo;
  perform app.log(p_venue, 'venue.set_demo', 'venues', array[p_venue::text], jsonb_build_object('demo', p_demo), 1, app.strip_blank(p_reason));
  perform set_config('mana.via', '', true);
  perform set_config('mana.reason', '', true);
  return jsonb_build_object('ok', true, 'demo', p_demo);
end $$;

-- ================================================================ every foreign key leads an index (the advisor's unindexed_foreign_keys)
-- Each index is named after its constraint, on exactly the key's columns.
create index addon_options_venue_id_group_id_fkey_idx on public.addon_options (venue_id, group_id);
create index addon_options_venue_id_opens_group_id_fkey_idx on public.addon_options (venue_id, opens_group_id);
create index assets_created_by_fkey_idx on public.assets (created_by);
create index assets_venue_id_dish_id_fkey_idx on public.assets (venue_id, dish_id);
create index availability_overrides_created_by_fkey_idx on public.availability_overrides (created_by);
create index availability_overrides_restored_by_fkey_idx on public.availability_overrides (restored_by);
create index dish_addon_groups_venue_id_dish_id_fkey_idx on public.dish_addon_groups (venue_id, dish_id);
create index dish_addon_groups_venue_id_group_id_fkey_idx on public.dish_addon_groups (venue_id, group_id);
create index dish_relations_venue_id_dish_id_fkey_idx on public.dish_relations (venue_id, dish_id);
create index dish_relations_venue_id_related_dish_id_fkey_idx on public.dish_relations (venue_id, related_dish_id);
create index dishes_venue_id_asset_id_fkey_idx on public.dishes (venue_id, asset_id);
create index dishes_venue_id_schedule_id_fkey_idx on public.dishes (venue_id, schedule_id);
create index dishes_venue_id_section_id_fkey_idx on public.dishes (venue_id, section_id);
create index menu_imports_created_by_fkey_idx on public.menu_imports (created_by);
create index menu_revisions_created_by_fkey_idx on public.menu_revisions (created_by);
create index onboarding_progress_updated_by_fkey_idx on public.onboarding_progress (updated_by);
create index sections_venue_id_schedule_id_fkey_idx on public.sections (venue_id, schedule_id);
create index staff_invites_used_by_fkey_idx on public.staff_invites (used_by);
create index support_cases_opened_by_fkey_idx on public.support_cases (opened_by);
create index upsell_rules_venue_id_suggest_dish_id_fkey_idx on public.upsell_rules (venue_id, suggest_dish_id);
create index upsell_rules_venue_id_suggest_option_id_fkey_idx on public.upsell_rules (venue_id, suggest_option_id);
create index venue_members_invited_by_fkey_idx on public.venue_members (invited_by);
create index venues_approved_by_fkey_idx on public.venues (approved_by);
create index venues_created_by_fkey_idx on public.venues (created_by);
create index venues_id_published_revision_id_fkey_idx on public.venues (id, published_revision_id);

-- Foreign keys of public and app whose columns lead no index; supabase/tests requires none, so a later migration that
-- adds a foreign key adds its index too. Whoever applies the migrations runs it after each one, beside audit_grants().
create function app.unindexed_foreign_keys() returns table (tbl text, conname text, cols text)
language sql stable security definer set search_path = '' as $$
  select c.conrelid::regclass::text, c.conname::text, string_agg(a.attname::text, ', ' order by k.ord)
  from pg_catalog.pg_constraint c
  cross join lateral unnest(c.conkey) with ordinality k(attnum, ord)
  join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
  join pg_catalog.pg_class r on r.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = r.relnamespace
  where c.contype = 'f' and n.nspname in ('public', 'app') and r.relkind in ('r', 'p')
    and not exists (select 1 from pg_catalog.pg_index i where i.indrelid = c.conrelid
                    and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
                    and c.conkey @> (i.indkey::int2[])[0:cardinality(c.conkey) - 1])
  group by c.conrelid, c.conname
  order by 1, 2
$$;

-- ================================================================ access: what phase 1 changes (the model of 20261015120500_access.sql)
-- menu_imports: clients read every column but the raw text; every write is one of the import RPCs. The scanner (the
-- service role) keeps what it does itself: marking a read it claimed as failed, and purging.
-- DESTRUCTIVE-LOOKING: revokes the table SELECT, INSERT and UPDATE of authenticated on menu_imports (and with them its
-- column INSERT and UPDATE grants); SELECT comes back at once as a column list without raw_text.
revoke select, insert, update on public.menu_imports from authenticated;
grant select (id, venue_id, source, status, raw_paths, input_sha256, rights_confirmed, parsed, exceptions, error_code, created_by, applied_at,
              created_at, updated_at, raw_purged_at)
  on public.menu_imports to authenticated;
-- DESTRUCTIVE-LOOKING: drops the two policies that let owners and managers insert and change imports directly (no grant
-- reaches them any more; imports_read stays)
drop policy imports_add on public.menu_imports;
drop policy imports_change on public.menu_imports;
-- DESTRUCTIVE-LOOKING: revokes the service role's table INSERT and UPDATE on menu_imports; UPDATE comes back on four columns
revoke insert, update on public.menu_imports from service_role;
grant update (status, error_code, raw_paths, raw_purged_at) on public.menu_imports to service_role;

-- functions: nothing by default, then by name (last in this file, so everything created above is covered; PostgreSQL
-- grants EXECUTE on a new function to PUBLIC).
-- DESTRUCTIVE-LOOKING: revokes every function privilege of PUBLIC, anon and authenticated in public and app; the
-- statements right after grant back exactly the intended list (phase 0's and phase 1's), which audit_grants() checks.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.is_member(uuid), app.is_owner(uuid), app.can_edit(uuid), app.can_operate(uuid), app.can_read(uuid),
  app.can_see_records(uuid), app.is_staff(), app.path_venue(text), app.windows_ok(jsonb), app.until_spec_ok(jsonb)
  to authenticated, service_role;
grant execute on function public.public_menu(text), public.track_events(jsonb),
  public.submit_lead(uuid, text, text, text, text, text, text, text, integer) to anon, authenticated;
-- phase 0
grant execute on function public.slug_available(text), public.create_venue(text, text, text, text, text), public.preview_menu(uuid),
  public.publish_menu(uuid, text), public.restore_revision(uuid, integer), public.unpublish_menu(uuid), public.my_dashboard(uuid, text),
  public.redeem_staff_invite(text), public.create_staff_invite(text, text), public.ops_overview(), public.ops_approve_venue(uuid, text),
  public.ops_set_plan(uuid, text, timestamptz, text, text), public.ops_leads(text, text, timestamptz, integer),
  public.ops_update_lead(uuid, text, text, text), public.act_for_owner(uuid, text, text, jsonb) to authenticated;
-- phase 1 (ADR-008): each checks its caller
grant execute on function public.create_import(uuid, text, text, text[], text, boolean, uuid), public.claim_import_scan(uuid),
  public.discard_import(uuid), public.set_onboarding_step(uuid, text, text, text[]),
  public.open_case(uuid, text, text, text, boolean), public.ops_update_case(uuid, text, text, text),
  public.set_availability(uuid, text, uuid, jsonb, text), public.restore_today(uuid), public.export_menu(uuid),
  public.venue_activity(uuid, bigint, integer, text, text), public.ops_venues(jsonb), public.ops_venue(uuid), public.ops_analytics(jsonb),
  public.ops_set_demo(uuid, boolean, text), public.ops_revision(uuid, integer),
  public.save_addon_group(uuid, jsonb, jsonb, timestamptz, boolean) to authenticated;
-- the service role (edge functions) keeps EXECUTE on every function in public, as before
grant execute on all functions in schema public to service_role;
revoke execute on function app.audit_grants(), app.unindexed_foreign_keys() from public, anon, authenticated;

-- ---------------------------------------------------------------- the grant audit: run it after every migration
-- Returns every grant to anon, authenticated or service_role that is not on the intended list below (for the service
-- role: every write, column writes included, and every TRUNCATE / TRIGGER / REFERENCES on a table in public or app)
-- and every intended grant that is gone. Nothing returned = the access model is exactly the intended one.
create or replace function app.audit_grants() returns table (problem text, grantee text, object text, privilege text)
language plpgsql stable security definer set search_path = '' as $$
declare expected text[] := array[
  'anon|function|public.public_menu(text)|EXECUTE',
  'anon|function|public.submit_lead(uuid,text,text,text,text,text,text,text,integer)|EXECUTE',
  'anon|function|public.track_events(jsonb)|EXECUTE',
  'authenticated|column|public.availability_overrides.note|INSERT',
  'authenticated|column|public.availability_overrides.restored_at|UPDATE',
  'authenticated|column|public.availability_overrides.starts_at|INSERT',
  'authenticated|column|public.availability_overrides.target_id|INSERT',
  'authenticated|column|public.availability_overrides.target_kind|INSERT',
  'authenticated|column|public.availability_overrides.until_kind|INSERT',
  'authenticated|column|public.availability_overrides.until_spec|INSERT',
  'authenticated|column|public.availability_overrides.venue_id|INSERT',
  'authenticated|column|public.menu_imports.applied_at|SELECT',
  'authenticated|column|public.menu_imports.created_at|SELECT',
  'authenticated|column|public.menu_imports.created_by|SELECT',
  'authenticated|column|public.menu_imports.error_code|SELECT',
  'authenticated|column|public.menu_imports.exceptions|SELECT',
  'authenticated|column|public.menu_imports.id|SELECT',
  'authenticated|column|public.menu_imports.input_sha256|SELECT',
  'authenticated|column|public.menu_imports.parsed|SELECT',
  'authenticated|column|public.menu_imports.raw_paths|SELECT',
  'authenticated|column|public.menu_imports.raw_purged_at|SELECT',
  'authenticated|column|public.menu_imports.rights_confirmed|SELECT',
  'authenticated|column|public.menu_imports.source|SELECT',
  'authenticated|column|public.menu_imports.status|SELECT',
  'authenticated|column|public.menu_imports.updated_at|SELECT',
  'authenticated|column|public.menu_imports.venue_id|SELECT',
  'authenticated|column|public.onboarding_progress.blockers|INSERT',
  'authenticated|column|public.onboarding_progress.blockers|UPDATE',
  'authenticated|column|public.onboarding_progress.state|INSERT',
  'authenticated|column|public.onboarding_progress.state|UPDATE',
  'authenticated|column|public.onboarding_progress.step|INSERT',
  'authenticated|column|public.onboarding_progress.venue_id|INSERT',
  'authenticated|column|public.support_cases.body|INSERT',
  'authenticated|column|public.support_cases.status|UPDATE',
  'authenticated|column|public.support_cases.subject|INSERT',
  'authenticated|column|public.support_cases.topic|INSERT',
  'authenticated|column|public.support_cases.topic|UPDATE',
  'authenticated|column|public.support_cases.venue_id|INSERT',
  'authenticated|column|public.venue_members.role|UPDATE',
  'authenticated|column|public.venues.accent|UPDATE',
  'authenticated|column|public.venues.area_en|UPDATE',
  'authenticated|column|public.venues.area_he|UPDATE',
  'authenticated|column|public.venues.book_url|UPDATE',
  'authenticated|column|public.venues.cuisine_en|UPDATE',
  'authenticated|column|public.venues.cuisine_he|UPDATE',
  'authenticated|column|public.venues.default_lang|UPDATE',
  'authenticated|column|public.venues.kind|UPDATE',
  'authenticated|column|public.venues.langs|UPDATE',
  'authenticated|column|public.venues.logo_path|UPDATE',
  'authenticated|column|public.venues.name_en|UPDATE',
  'authenticated|column|public.venues.name_he|UPDATE',
  'authenticated|column|public.venues.order_url|UPDATE',
  'authenticated|column|public.venues.phone|UPDATE',
  'authenticated|column|public.venues.sold_out_display|UPDATE',
  'authenticated|column|public.venues.support_can_act|UPDATE',
  'authenticated|column|public.venues.surface|UPDATE',
  'authenticated|column|public.venues.table_img_path|UPDATE',
  'authenticated|column|public.venues.template|UPDATE',
  'authenticated|column|public.venues.time_zone|UPDATE',
  'authenticated|function|app.can_edit(uuid)|EXECUTE',
  'authenticated|function|app.can_operate(uuid)|EXECUTE',
  'authenticated|function|app.can_read(uuid)|EXECUTE',
  'authenticated|function|app.can_see_records(uuid)|EXECUTE',
  'authenticated|function|app.is_member(uuid)|EXECUTE',
  'authenticated|function|app.is_owner(uuid)|EXECUTE',
  'authenticated|function|app.is_staff()|EXECUTE',
  'authenticated|function|app.path_venue(text)|EXECUTE',
  'authenticated|function|app.until_spec_ok(jsonb)|EXECUTE',
  'authenticated|function|app.windows_ok(jsonb)|EXECUTE',
  'authenticated|function|public.act_for_owner(uuid,text,text,jsonb)|EXECUTE',
  'authenticated|function|public.claim_import_scan(uuid)|EXECUTE',
  'authenticated|function|public.create_import(uuid,text,text,text[],text,boolean,uuid)|EXECUTE',
  'authenticated|function|public.create_staff_invite(text,text)|EXECUTE',
  'authenticated|function|public.create_venue(text,text,text,text,text)|EXECUTE',
  'authenticated|function|public.discard_import(uuid)|EXECUTE',
  'authenticated|function|public.export_menu(uuid)|EXECUTE',
  'authenticated|function|public.my_dashboard(uuid,text)|EXECUTE',
  'authenticated|function|public.open_case(uuid,text,text,text,boolean)|EXECUTE',
  'authenticated|function|public.ops_analytics(jsonb)|EXECUTE',
  'authenticated|function|public.ops_approve_venue(uuid,text)|EXECUTE',
  'authenticated|function|public.ops_leads(text,text,timestamp with time zone,integer)|EXECUTE',
  'authenticated|function|public.ops_overview()|EXECUTE',
  'authenticated|function|public.ops_revision(uuid,integer)|EXECUTE',
  'authenticated|function|public.ops_set_demo(uuid,boolean,text)|EXECUTE',
  'authenticated|function|public.ops_set_plan(uuid,text,timestamp with time zone,text,text)|EXECUTE',
  'authenticated|function|public.ops_update_case(uuid,text,text,text)|EXECUTE',
  'authenticated|function|public.ops_update_lead(uuid,text,text,text)|EXECUTE',
  'authenticated|function|public.ops_venue(uuid)|EXECUTE',
  'authenticated|function|public.ops_venues(jsonb)|EXECUTE',
  'authenticated|function|public.preview_menu(uuid)|EXECUTE',
  'authenticated|function|public.public_menu(text)|EXECUTE',
  'authenticated|function|public.publish_menu(uuid,text)|EXECUTE',
  'authenticated|function|public.redeem_staff_invite(text)|EXECUTE',
  'authenticated|function|public.restore_revision(uuid,integer)|EXECUTE',
  'authenticated|function|public.restore_today(uuid)|EXECUTE',
  'authenticated|function|public.save_addon_group(uuid,jsonb,jsonb,timestamp with time zone,boolean)|EXECUTE',
  'authenticated|function|public.set_availability(uuid,text,uuid,jsonb,text)|EXECUTE',
  'authenticated|function|public.set_onboarding_step(uuid,text,text,text[])|EXECUTE',
  'authenticated|function|public.slug_available(text)|EXECUTE',
  'authenticated|function|public.submit_lead(uuid,text,text,text,text,text,text,text,integer)|EXECUTE',
  'authenticated|function|public.track_events(jsonb)|EXECUTE',
  'authenticated|function|public.unpublish_menu(uuid)|EXECUTE',
  'authenticated|function|public.venue_activity(uuid,bigint,integer,text,text)|EXECUTE',
  'authenticated|table|public.activity_log|SELECT',
  'authenticated|table|public.addon_groups|DELETE',
  'authenticated|table|public.addon_groups|INSERT',
  'authenticated|table|public.addon_groups|SELECT',
  'authenticated|table|public.addon_groups|UPDATE',
  'authenticated|table|public.addon_options|DELETE',
  'authenticated|table|public.addon_options|INSERT',
  'authenticated|table|public.addon_options|SELECT',
  'authenticated|table|public.addon_options|UPDATE',
  'authenticated|table|public.assets|DELETE',
  'authenticated|table|public.assets|INSERT',
  'authenticated|table|public.assets|SELECT',
  'authenticated|table|public.assets|UPDATE',
  'authenticated|table|public.availability_overrides|SELECT',
  'authenticated|table|public.dish_addon_groups|DELETE',
  'authenticated|table|public.dish_addon_groups|INSERT',
  'authenticated|table|public.dish_addon_groups|SELECT',
  'authenticated|table|public.dish_addon_groups|UPDATE',
  'authenticated|table|public.dish_relations|DELETE',
  'authenticated|table|public.dish_relations|INSERT',
  'authenticated|table|public.dish_relations|SELECT',
  'authenticated|table|public.dish_relations|UPDATE',
  'authenticated|table|public.dishes|DELETE',
  'authenticated|table|public.dishes|INSERT',
  'authenticated|table|public.dishes|SELECT',
  'authenticated|table|public.dishes|UPDATE',
  'authenticated|table|public.entitlements|SELECT',
  'authenticated|table|public.menu_revisions|SELECT',
  'authenticated|table|public.onboarding_progress|SELECT',
  'authenticated|table|public.rollups_day|SELECT',
  'authenticated|table|public.rollups_minute|SELECT',
  'authenticated|table|public.schedules|DELETE',
  'authenticated|table|public.schedules|INSERT',
  'authenticated|table|public.schedules|SELECT',
  'authenticated|table|public.schedules|UPDATE',
  'authenticated|table|public.sections|DELETE',
  'authenticated|table|public.sections|INSERT',
  'authenticated|table|public.sections|SELECT',
  'authenticated|table|public.sections|UPDATE',
  'authenticated|table|public.staff|SELECT',
  'authenticated|table|public.support_cases|SELECT',
  'authenticated|table|public.upsell_rules|DELETE',
  'authenticated|table|public.upsell_rules|INSERT',
  'authenticated|table|public.upsell_rules|SELECT',
  'authenticated|table|public.upsell_rules|UPDATE',
  'authenticated|table|public.venue_closures|DELETE',
  'authenticated|table|public.venue_closures|INSERT',
  'authenticated|table|public.venue_closures|SELECT',
  'authenticated|table|public.venue_closures|UPDATE',
  'authenticated|table|public.venue_hours|DELETE',
  'authenticated|table|public.venue_hours|INSERT',
  'authenticated|table|public.venue_hours|SELECT',
  'authenticated|table|public.venue_hours|UPDATE',
  'authenticated|table|public.venue_members|DELETE',
  'authenticated|table|public.venue_members|SELECT',
  'authenticated|table|public.venues|SELECT',
  'service_role|column|public.menu_imports.error_code|UPDATE',
  'service_role|column|public.menu_imports.raw_paths|UPDATE',
  'service_role|column|public.menu_imports.raw_purged_at|UPDATE',
  'service_role|column|public.menu_imports.status|UPDATE',
  'service_role|table|public.assets|INSERT',
  'service_role|table|public.assets|UPDATE'
];
begin
  return query
  with actual as (
    select r.rolname::text as grantee, 'table' as kind, (n.nspname || '.' || c.relname)::text as object, pr.priv as privilege
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege(r.rolname, c.oid, pr.priv)
    union all
    select r.rolname::text, 'column', (n.nspname || '.' || c.relname || '.' || a.attname)::text, pr.priv
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join (values ('anon'), ('authenticated')) r(rolname)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and not has_table_privilege(r.rolname, c.oid, pr.priv) and has_column_privilege(r.rolname, c.oid, a.attnum, pr.priv)
    union all
    select r.rolname::text, 'function', p.oid::regprocedure::text, 'EXECUTE'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    where n.nspname in ('public', 'app') and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    union all
    select 'service_role', 'table', (n.nspname || '.' || c.relname)::text, pr.priv
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p') and has_table_privilege('service_role', c.oid, pr.priv)
    union all
    select 'service_role', 'column', (n.nspname || '.' || c.relname || '.' || a.attname)::text, pr.priv
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join unnest(array['INSERT', 'UPDATE', 'REFERENCES']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p')
      and not has_table_privilege('service_role', c.oid, pr.priv) and has_column_privilege('service_role', c.oid, a.attnum, pr.priv)
  )
  select 'unexpected'::text, a.grantee, a.object, a.privilege from actual a
  where (a.grantee || '|' || a.kind || '|' || a.object || '|' || a.privilege) <> all (expected)
  union all
  select 'missing'::text, split_part(e, '|', 1), split_part(e, '|', 3), split_part(e, '|', 4) from unnest(expected) e
  where e not in (select a.grantee || '|' || a.kind || '|' || a.object || '|' || a.privilege from actual a)
  order by 1, 2, 3, 4;
end $$;
revoke execute on function app.audit_grants() from public, anon, authenticated;
