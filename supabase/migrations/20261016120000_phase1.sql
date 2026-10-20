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
  -- imports a venue creates per (local) day; and the images the scanner may read (each a paid model call), charged when
  -- a claim succeeds: per venue per local day, per person per UTC day, and for all venues together per UTC day
  ('import_caps', '{"per_venue_day": 20, "scan_images_per_venue_day": 60, "scan_images_per_user_day": 120, "scan_images_per_day": 1000}'),
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

-- An instant with an explicit offset (the contracts' EVENT_TIME_RE: Z or +-HH:MM, up to 6 fractional digits) as
-- PostgreSQL reads it, to the microsecond (the contracts' instantMs reads it the same way: a real date, 24:00 the next
-- midnight, :60 the next minute, an offset up to 15:59); null when it is not one. A version a client read and sends
-- back as it read it (js_instant_exact), or a time a query names (js_instant): one rule.
create function app.js_instant_exact(p jsonb) returns timestamptz language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if jsonb_typeof(p) is distinct from 'string' then return null; end if;
  s := p #>> '{}';
  if s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then return null; end if;
  return s::timestamptz;
exception when others then
  return null;
end $$;

create function app.js_instant(p jsonb) returns timestamptz language sql immutable set search_path = '' as
$$ select app.js_instant_exact(p) $$;

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

-- IMPORT_EXCEPTIONS (in this order) with their severity, IMPORT_CHOICES, and EXCEPTION_CHOICES (a check's default is
-- its first)
create function app.import_exception_codes() returns text[] language sql immutable set search_path = '' as $$
  select array['price_missing', 'price_unreadable', 'price_zero', 'option_price_unreadable', 'limits_guessed', 'limits_unreachable',
               'section_duplicate', 'dish_duplicate', 'dish_repeated', 'name_missing_lang', 'translation_check', 'name_symbols', 'nesting_too_deep', 'too_many',
               'photo_rights_unknown', 'allergens_check', 'section_renamed', 'dish_elsewhere', 'dish_other_kind', 'price_differs', 'group_changed',
               'opens_changed']
$$;

create function app.import_exception_severity(p_code text) returns text language sql immutable set search_path = '' as $$
  select case when p_code in ('price_zero', 'limits_guessed', 'dish_repeated', 'name_missing_lang', 'translation_check', 'name_symbols', 'photo_rights_unknown',
                              'allergens_check', 'section_renamed', 'dish_elsewhere', 'dish_other_kind', 'price_differs', 'group_changed', 'opens_changed')
              then 'check' else 'fix' end
$$;

create function app.import_choice_list() returns text[] language sql immutable set search_path = '' as $$
  select array['accept', 'skip', 'no_price', 'free', 'clamp', 'merge', 'keep_both', 'unlink', 'illustration', 'confirm_rights', 'same_section',
               'rename', 'same_dish', 'new_dish', 'keep_mine', 'take_new', 'add_options', 'new_group']
$$;

create function app.import_choices() returns jsonb language sql immutable set search_path = '' as $$
  select '{
    "price_missing": ["no_price", "skip"], "price_unreadable": ["no_price", "skip"], "price_zero": ["accept", "no_price", "skip"],
    "option_price_unreadable": ["free", "skip"], "limits_guessed": ["accept", "skip"], "limits_unreachable": ["clamp", "skip"],
    "section_duplicate": ["merge", "keep_both"], "dish_duplicate": ["skip", "keep_both"], "dish_repeated": ["skip", "keep_both"],
    "name_missing_lang": ["accept"], "translation_check": ["accept"], "name_symbols": ["accept"], "nesting_too_deep": ["unlink", "skip"], "too_many": ["skip"],
    "photo_rights_unknown": ["illustration", "confirm_rights"], "allergens_check": ["accept"],
    "section_renamed": ["same_section", "rename", "keep_both"], "dish_elsewhere": ["same_dish", "new_dish"],
    "dish_other_kind": ["new_dish", "same_dish"], "price_differs": ["keep_mine", "take_new"],
    "group_changed": ["keep_mine", "add_options", "new_group"], "opens_changed": ["keep_mine", "new_group"]
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

-- An import's images lie in its own folder and nowhere else: <venue id>/imports/<import id>/<name>, the name letters,
-- digits, dot, dash and underscore (1-100), never "." or "..". The scanner downloads these paths with the owner's own
-- token, and the purge deletes them with the service role, so a path that climbs out of the folder (or names another
-- venue, or the public bucket) is refused by the table itself.
create function app.import_path_ok(p_venue uuid, p_import uuid, p_path text) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_path ~ ('^' || p_venue::text || '/imports/' || p_import::text || '/[A-Za-z0-9._-]{1,100}$')
                  and p_path !~ '/[.]{1,2}$', false)
$$;
create function app.import_paths_ok(p_venue uuid, p_import uuid, p_paths text[]) returns boolean language sql immutable set search_path = '' as
$$ select not exists (select 1 from unnest(p_paths) x where not app.import_path_ok(p_venue, p_import, x)) $$;
-- (validated: every stored row must hold already; the check before applying is in supabase/README.md)
alter table public.menu_imports add constraint menu_imports_paths_ck check (app.import_paths_ok(venue_id, id, raw_paths));

-- An import whose raw input the guard lets be purged: finished (applied, discarded, failed), or left uploaded or parsed
-- for longer than import_raw_retention_days. Never one being read. (The guard only: what is purged, by the daily job
-- and the scanner's list, is app.import_past_retention's.)
create function app.import_purgeable(p_status text, p_updated_at timestamptz) returns boolean language sql stable security definer set search_path = '' as $$
  select p_status in ('applied', 'discarded', 'failed')
      or (p_status in ('uploaded', 'parsed')
          and p_updated_at < now() - make_interval(days => greatest(coalesce((app.cfg('import_raw_retention_days') #>> '{}')::integer, 30), 0)))
$$;

-- When an import's raw input starts its retention: when it finished (applied, discarded, failed: applied_at, else the
-- last change, which closing it is), or its last change for one left uploaded or parsed. Null for one being read.
create function app.import_finished_at(p_status text, p_applied_at timestamptz, p_updated_at timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select case when p_status in ('applied', 'discarded', 'failed') then coalesce(p_applied_at, p_updated_at)
              when p_status in ('uploaded', 'parsed') then p_updated_at end
$$;

-- The one retention rule (the daily job's, and the scanner's list): finished, or left waiting, longer ago than
-- import_raw_retention_days. A failed scan keeps its screenshots that long, so the owner can try it again.
create function app.import_past_retention(p_status text, p_applied_at timestamptz, p_updated_at timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.import_finished_at(p_status, p_applied_at, p_updated_at)
                  < now() - make_interval(days => greatest(coalesce((app.cfg('import_raw_retention_days') #>> '{}')::integer, 30), 0)), false)
$$;

-- A draft's size is the bytes of its jsonb text form (the contracts' draftBytes, DRAFT_BYTES_MAX): a full menu at the
-- LIMITS is about 1.2 MB, so the cap is 1 500 000 bytes, on the same measure save_import_draft applies.
-- DESTRUCTIVE-LOOKING: drops the column check menu_imports_parsed_check (pg_column_size below 400 000) and adds it
-- back, named, on the new measure. Every stored draft passes it. No data changes.
alter table public.menu_imports drop constraint menu_imports_parsed_check;
alter table public.menu_imports add constraint menu_imports_parsed_ck
  check (parsed is null or (jsonb_typeof(parsed) = 'object' and octet_length(parsed::text) <= 1500000));

-- Images per import by source (create_import): a scan's pages at most 8, Wolt screenshots at most 24.
-- DESTRUCTIVE-LOOKING: drops the column check menu_imports_raw_paths_check (at most 20) and adds it back at 24, the
-- largest per-source count. No data changes.
alter table public.menu_imports drop constraint menu_imports_raw_paths_check;
alter table public.menu_imports add constraint menu_imports_raw_paths_ck check (cardinality(raw_paths) <= 24);

-- What a reader noticed while reading (lines it skipped, prices it could not read): codes and counts only, never the
-- source's text. Written by save_import_draft; clients read it.
alter table public.menu_imports add column notes jsonb not null default '[]'
  check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) <= 2000);
comment on column public.menu_imports.notes is 'Reader notes: [{code, count}], codes and counts only, never the source''s text (save_import_draft).';

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
    -- only the purge, once: by the database or the scanner, emptying everything at once and saying when, and only an
    -- import that may be purged (app.import_purgeable: never one a claim is reading)
    if client or old.raw_purged_at is not null or new.raw_purged_at is null or new.raw_text is not null or cardinality(new.raw_paths) > 0 then
      raise exception 'import_input_fixed';
    end if;
    if not app.import_purgeable(old.status, old.updated_at) or new.status <> old.status then raise exception 'import_not_purgeable'; end if;
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

-- ================================================================ schema change 3b: an hours window carries updated_at
-- An hours window edited on two screens is guarded on its updated_at like every other editable row (the owner app sends
-- the one it read); the same touch trigger as the other tables. venue_closures stays add and delete only.
alter table public.venue_hours add column updated_at timestamptz not null default now();
create trigger venue_hours_touch before update on public.venue_hours for each row execute function app.touch();

-- Opening windows never overlap, per venue: two on one weekday, or a window past midnight (closes <= opens) running into
-- the next day's first window (Saturday's into Sunday's too). Checked under the venue's lock, so two screens adding at
-- once cannot both succeed (the owner app's own check is the same rule: hours_overlap). A window is the half-open span
-- [opens, closes) in minutes of the week; windows that only touch do not overlap.
create function app.hours_span(p_weekday smallint, p_opens time, p_closes time, out s integer, out e integer)
language sql immutable set search_path = '' as $$
  select p_weekday * 1440 + (extract(hour from p_opens) * 60 + extract(minute from p_opens))::integer,
         p_weekday * 1440 + (extract(hour from p_opens) * 60 + extract(minute from p_opens))::integer
           + ((extract(hour from p_closes) * 60 + extract(minute from p_closes)) - (extract(hour from p_opens) * 60 + extract(minute from p_opens)))::integer
           + case when p_closes > p_opens then 0 else 1440 end
$$;
create function app.guard_hours_overlap() returns trigger language plpgsql security definer set search_path = '' as $$
declare w record;
begin
  perform pg_advisory_xact_lock(hashtext('mana:hours:' || new.venue_id::text));
  select * into w from app.hours_span(new.weekday, new.opens, new.closes);
  if exists (select 1 from public.venue_hours h cross join lateral app.hours_span(h.weekday, h.opens, h.closes) z
             cross join unnest(array[-10080, 0, 10080]) k(shift)
             where h.venue_id = new.venue_id and h.id <> new.id and w.s < z.e + k.shift and z.s + k.shift < w.e) then
    raise exception 'hours_overlap';
  end if;
  return new;
end $$;
create trigger venue_hours_overlap before insert or update of weekday, opens, closes on public.venue_hours
  for each row execute function app.guard_hours_overlap();

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
  -- past the retention period, and of imports left uploaded or parsed for as long; the row, its hash and its draft stay.
  -- (The screenshots of image imports are the scanner's to delete: list_purgeable_imports.)
  update public.menu_imports set raw_text = null, raw_purged_at = now()
  where raw_text is not null and app.import_past_retention(status, applied_at, updated_at);
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
  errs := app.v_only_keys(p, array['venueId', 'topic', 'subject', 'body', 'allowAct', 'id']) || app.v_uuid_at(p->'venueId', 'venueId');
  -- the client's own id for the case: absent or null, or a uuid
  if p ? 'id' and not app.js_null(p->'id') then errs := errs || app.v_uuid_at(p->'id', 'id'); end if;
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
  errs := app.v_only_keys(p, array['caseId', 'status', 'topic', 'reason', 'expectedUpdatedAt']) || app.v_uuid_at(p->'caseId', 'caseId');
  -- the case's version as staff read it (absent or null: no check), a time PostgreSQL reads
  if p ? 'expectedUpdatedAt' and not app.js_null(p->'expectedUpdatedAt') and app.js_instant_exact(p->'expectedUpdatedAt') is null then
    errs := errs || app.issue('time_invalid', 'expectedUpdatedAt');
  end if;
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
      || case when p ? 'revision' and not app.js_null(p->'revision')
                   and not (app.js_int(p->'revision') and (p->>'revision')::numeric between 1 and 2147483647)
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
    -- IMPORT_IMAGES_MAX by source: a printed menu's pages (scan) 8, Wolt screenshots 24
    elsif jsonb_array_length(v_paths) > (case p->>'source' when 'scan' then 8 else 24 end) then errs := errs || app.issue('too_many', 'paths');
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

-- ================================================================ the import's rules in SQL (packages/contracts/src/import.ts, ADR-006)
-- The SQL twins of importKey, validateDraft, draftExceptions and validateDecisions. supabase/tests/import-twins
-- runs both sides on the same inputs: every call the contracts' own import tests make, and generated ones.

-- KEY_SEPARATORS: every blank, ASCII punctuation and symbols, Latin-1 punctuation and symbols, × ÷, Hebrew
-- punctuation, general punctuation, currency signs, arrows to dingbats
create function app.key_separators() returns text language sql immutable set search_path = '' as $$
  select substr(app.blank_class(), 2, char_length(app.blank_class()) - 2)
    || '\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E\u00A1-\u00BF\u00D7\u00F7\u05BE\u05C0\u05C3\u05C6'
    || '\u2010-\u2027\u2030-\u205E\u20A0-\u20C0\u2190-\u2BFF'
$$;

-- importKey, in its order: 1. outside the BMP a space; 2. no (c) (r) (tm), keycap or variation selector; 3. NFKD;
-- 4. no Latin diacritics or Hebrew points; 5. no geresh or gershayim, nor an ASCII quote right after a Hebrew letter;
-- 6. A-Z lowercased (no locale); 7. separators as one space; 8. no space at either end
create function app.import_key(p text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
    regexp_replace(
      translate(
        regexp_replace(
          regexp_replace(
            normalize(
              regexp_replace(regexp_replace(coalesce(p, ''), '[\U00010000-\U0010FFFF]', ' ', 'g'),
                             '[\u00A9\u00AE\u2122\u20E3\uFE00-\uFE0F]', '', 'g'),
              nfkd),
            '[\u0300-\u036F\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]', '', 'g'),
          '[\u05F3\u05F4]|(?<=[\u05D0-\u05EA])["'']', '', 'g'),
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),
      '[' || app.key_separators() || ']+', ' ', 'g'),
    '^ | $', '', 'g')
$$;

-- keysOf and scoreKeys: a name's two keys; 2 when the Hebrew keys are equal (and not empty), plus 1 for English
-- keysOf: a name of symbols or emoji only (no importKey in either language, but some text) is keyed by its exact text,
-- '#<he>#<en>' with blank edges stripped, in the Hebrew slot (fallbackKey; no importKey holds a '#')
create function app.keys_of(p_he text, p_en text) returns jsonb language plpgsql immutable set search_path = '' as $$
declare he text := app.import_key(p_he); en text := app.import_key(p_en);
begin
  if he <> '' or en <> '' or (app.strip_blank(coalesce(p_he, '')) = '' and app.strip_blank(coalesce(p_en, '')) = '') then
    return jsonb_build_object('he', he, 'en', en);
  end if;
  return jsonb_build_object('he', '#' || app.strip_blank(coalesce(p_he, '')) || '#' || app.strip_blank(coalesce(p_en, '')), 'en', '');
end $$;

-- symbolsOnly: the name says something, but nothing importKey keeps (name_symbols)
create function app.symbols_only(p_name jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return app.import_key(p_name->>'he') = '' and app.import_key(p_name->>'en') = ''
     and not (app.strip_blank(coalesce(p_name->>'he', '')) = '' and app.strip_blank(coalesce(p_name->>'en', '')) = '');
end $$;

-- scoreKeys: 0 when both have a Hebrew key and they differ, whatever the English says; else 2 for the same Hebrew key,
-- plus 1 for the same English one
create function app.score_keys(a jsonb, b jsonb) returns integer language sql immutable set search_path = '' as $$
  select case when a->>'he' <> '' and b->>'he' <> '' and a->>'he' <> b->>'he' then 0
              else (case when a->>'he' <> '' and a->>'he' = b->>'he' then 2 else 0 end) + (case when a->>'en' <> '' and a->>'en' = b->>'en' then 1 else 0 end) end
$$;

-- JavaScript's truthiness of a JSON value (absent counts as undefined)
create function app.js_truthy(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when p is null then false
              when jsonb_typeof(p) = 'null' then false
              when jsonb_typeof(p) = 'boolean' then p = 'true'::jsonb
              when jsonb_typeof(p) = 'number' then (p::text)::numeric <> 0
              when jsonb_typeof(p) = 'string' then p <> '""'::jsonb
              else true end
$$;

-- str(): a string of at most p_max code points once its blank edges are stripped (absent or not a string: type)
-- (the per-node helpers are PL/pgSQL, which keeps its plans: a SQL function that calls another one plans it again on
-- every call, and a menu of 800 dishes makes thousands of calls)
create function app.draft_str(p jsonb, p_path text, p_max integer) returns jsonb language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p) is distinct from 'string' then return app.issue('type', p_path); end if;
  if char_length(app.strip_blank(p #>> '{}')) > p_max then return app.issue('text_too_long', p_path); end if;
  return '[]'::jsonb;
end $$;

-- text(): {he, en} strings, no other key, each at most p_max code points as stored (blank edges stripped); with p_name,
-- a name in one language at least
create function app.draft_text(p jsonb, p_path text, p_max integer, p_name boolean) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb := '[]'; he text; en text;
begin
  if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'he') is distinct from 'string' or jsonb_typeof(p->'en') is distinct from 'string' then
    return app.issue('type', p_path);
  end if;
  if p - array['he', 'en'] <> '{}'::jsonb then
    errs := (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', p_path || '.' || k)), '[]'::jsonb)
             from jsonb_object_keys(p) k where k not in ('he', 'en'));
  end if;
  he := app.strip_blank(p->>'he');
  en := app.strip_blank(p->>'en');
  if char_length(he) > p_max then errs := errs || app.issue('text_too_long', p_path || '.he'); end if;
  if char_length(en) > p_max then errs := errs || app.issue('text_too_long', p_path || '.en'); end if;
  if p_name and he = '' and en = '' then errs := errs || app.issue('name_missing', p_path); end if;
  return errs;
end $$;

-- translated(): the languages a reader translated, each with text of its own in at least one of the node's texts
create function app.draft_translated(p jsonb, p_path text, p_texts jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb := '[]'; l text;
begin
  if jsonb_typeof(p) is distinct from 'array'
     or exists (select 1 from jsonb_array_elements(p) x where x not in ('"he"'::jsonb, '"en"'::jsonb))
     or (select count(distinct x) from jsonb_array_elements(p) x) <> jsonb_array_length(p) then
    return app.issue('translated_invalid', p_path);
  end if;
  for l in select x from jsonb_array_elements_text(p) x loop
    if not exists (select 1 from jsonb_array_elements(p_texts) t
                   where jsonb_typeof(t) = 'object' and jsonb_typeof(t->l) = 'string' and app.strip_blank(t->>l) <> '') then
      errs := errs || app.issue('translated_invalid', p_path);
    end if;
  end loop;
  return errs;
end $$;

-- priceOk: null, or agorot 0 to LIMITS.price (absent is not null)
create function app.draft_price_ok(p jsonb) returns boolean language plpgsql immutable set search_path = '' as
$$ begin return coalesce(p = 'null'::jsonb, false) or (app.js_int(p) and (p::text)::numeric between 0 and 10000000); end $$;

-- limitOk: null, or p_lo to 30 (absent is not null)
create function app.draft_limit_ok(p jsonb, p_lo integer) returns boolean language plpgsql immutable set search_path = '' as
$$ begin return coalesce(p = 'null'::jsonb, false) or (app.js_int(p) and (p::text)::numeric between p_lo and 30); end $$;

-- draftGroupLimits(g, options): {min, max, stated, capacity}. A single choice is required when it offers a free option
-- or has a default; a multiple one is optional, up to what its options allow.
create function app.draft_group_limits(p_selection text, p_min jsonb, p_max jsonb, p_options jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare o jsonb; total numeric := 0; capacity integer; required boolean := false;
  has_min boolean := p_min is not null and p_min <> 'null'::jsonb;
  has_max boolean := p_max is not null and p_max <> 'null'::jsonb;
begin
  for o in select x from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) x loop
    total := total + coalesce((o->>'maxQty')::numeric, 0);
    if o->'price' = '0'::jsonb or app.js_truthy(o->'default') then required := true; end if;
  end loop;
  capacity := total::integer;
  return jsonb_build_object(
    'min', case when has_min then (p_min::text)::integer when p_selection = 'single' and required then 1 else 0 end,
    'max', case when p_selection = 'single' then 1
                when has_max then (p_max::text)::integer
                else greatest(1, least(capacity, 30), case when has_min then (p_min::text)::integer else 0 end) end,
    'stated', has_min or has_max,
    'capacity', capacity);
end $$;

-- validateDraft: the same codes, at the same paths, in the same order
create function app.validate_import_draft(p jsonb) returns jsonb language plpgsql immutable set search_path = '' set jit = off as $$
declare
  errs jsonb := '[]';
  dups jsonb := '{}';     -- the paths of node keys used before (one namespace for sections, dishes, groups, options)
  gfirst jsonb := '{}';   -- group key -> the first group with that key
  v_groups jsonb := p->'groups'; v_sections jsonb := p->'sections';
  glim jsonb := '{}';     -- group key -> its limits (the last valid group with that key)
  g jsonb; o jsonb; s jsonb; d jsonb; a jsonb; own jsonb; k jsonb; gr jsonb; linked jsonb; e jsonb;
  gi integer; oj integer; si integer; dj integer; ak integer;
  pth text; q text; r text; text_source boolean;
  lim boolean; defaults integer; qty_ok boolean; dishes integer := 0; lo integer; hi integer;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  if p->'v' is distinct from '1'::jsonb then return app.issue('version', 'v'); end if;
  if octet_length(p::text) > 1500000 then return app.issue('too_large', ''); end if;
  errs := (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', x)), '[]'::jsonb)
           from jsonb_object_keys(p) x where x not in ('v', 'source', 'sections', 'groups', 'dropped'));
  if not app.one_of(p->'source', array['scan', 'paste', 'wolt_screenshots', 'wolt_text']) then errs := errs || app.issue('enum_invalid', 'source'); end if;
  if not (app.js_int(p->'dropped') and (p->>'dropped')::numeric between 0 and 100000) then errs := errs || app.issue('count_invalid', 'dropped'); end if;
  if jsonb_typeof(p->'sections') is distinct from 'array' then errs := errs || app.issue('type', 'sections'); end if;
  if jsonb_typeof(p->'groups') is distinct from 'array' then errs := errs || app.issue('type', 'groups'); end if;
  if jsonb_typeof(p->'sections') is distinct from 'array' or jsonb_typeof(p->'groups') is distinct from 'array' then return errs; end if;
  text_source := p->>'source' in ('paste', 'wolt_text');
  -- (the namespace of keys in one pass: groups, each with its options, then sections, each with its dishes; a valid key
  -- used by an earlier node is key_duplicate. Computed once: a menu at the limits has thousands of keys)
  with nodes as (
    select 1 as n_part, g.i as n_a, 0 as n_b, g.x->'key' as n_key, format('groups[%s].key', g.i - 1) as n_path
    from jsonb_array_elements(v_groups) with ordinality g(x, i) where jsonb_typeof(g.x) = 'object'
    union all
    select 1, g.i, o.j, o.y->'key', format('groups[%s].options[%s].key', g.i - 1, o.j - 1)
    from jsonb_array_elements(v_groups) with ordinality g(x, i)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(g.x) = 'object' and jsonb_typeof(g.x->'options') = 'array' then g.x->'options' else '[]' end)
      with ordinality o(y, j)
    where jsonb_typeof(o.y) = 'object'
    union all
    select 2, s.i, 0, s.x->'key', format('sections[%s].key', s.i - 1)
    from jsonb_array_elements(v_sections) with ordinality s(x, i) where jsonb_typeof(s.x) = 'object'
    union all
    select 2, s.i, d.j, d.y->'key', format('sections[%s].dishes[%s].key', s.i - 1, d.j - 1)
    from jsonb_array_elements(v_sections) with ordinality s(x, i)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(s.x) = 'object' and jsonb_typeof(s.x->'dishes') = 'array' then s.x->'dishes' else '[]' end)
      with ordinality d(y, j)
    where jsonb_typeof(d.y) = 'object'
  ), valid as (
    select n_path, row_number() over (partition by n_key #>> '{}' order by n_part, n_a, n_b) as n_nth
    from nodes where jsonb_typeof(n_key) = 'string' and (n_key #>> '{}') ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
  )
  select coalesce(jsonb_object_agg(n_path, true), '{}') into dups from valid where n_nth > 1;
  select coalesce(jsonb_object_agg(z.gk, z.gv), '{}') into gfirst
  from (select distinct on (t.x->>'key') t.x->>'key' as gk, t.x as gv from jsonb_array_elements(v_groups) with ordinality t(x, n)
        where jsonb_typeof(t.x) = 'object' and jsonb_typeof(t.x->'key') = 'string' order by t.x->>'key', t.n) z;

  -- groups first, so dishes and openers can be checked against them
  if jsonb_array_length(v_groups) > 400 then errs := errs || app.issue('too_large', 'groups'); end if;
  for gi in 0 .. jsonb_array_length(v_groups) - 1 loop
    g := v_groups->gi; pth := format('groups[%s]', gi);
    if jsonb_typeof(g) is distinct from 'object' then errs := errs || app.issue('type', pth); continue; end if;
    if g - array['key', 'name', 'translated', 'selection', 'min', 'max', 'options'] <> '{}'::jsonb then
      errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', pth || '.' || x)), '[]'::jsonb)
                     from jsonb_object_keys(g) x where x not in ('key', 'name', 'translated', 'selection', 'min', 'max', 'options'));
    end if;
    k := g->'key';
    if not app.js_str(k) or (k #>> '{}') !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' then errs := errs || app.issue('key_invalid', pth || '.key');
    elsif dups ? (pth || '.key') then errs := errs || app.issue('key_duplicate', pth || '.key');
    end if;
    errs := errs || app.draft_text(g->'name', pth || '.name', 60, true)
                 || app.draft_translated(g->'translated', pth || '.translated', jsonb_build_array(g->'name'));
    if not app.one_of(g->'selection', array['single', 'multiple']) then errs := errs || app.issue('enum_invalid', pth || '.selection'); end if;
    lim := app.draft_limit_ok(g->'min', 0) and app.draft_limit_ok(g->'max', 1)
           and not (app.js_int(g->'min') and app.js_int(g->'max') and (g->>'min')::numeric > (g->>'max')::numeric)
           and not (g->'selection' = '"single"'::jsonb and app.js_int(g->'min') and (g->>'min')::numeric > 1);
    if not lim then errs := errs || app.issue('limits_invalid', pth);
    elsif g->'selection' = '"single"'::jsonb and not app.js_null(g->'max') and g->'max' is distinct from '1'::jsonb then
      errs := errs || app.issue('single_max', pth);
    end if;
    if jsonb_typeof(g->'options') is distinct from 'array' or jsonb_array_length(g->'options') = 0 then
      errs := errs || app.issue('options_empty', pth || '.options');
      continue;
    end if;
    if jsonb_array_length(g->'options') > 60 then errs := errs || app.issue('too_large', pth || '.options'); end if;
    defaults := 0; qty_ok := true;
    for oj in 0 .. jsonb_array_length(g->'options') - 1 loop
      o := g->'options'->oj; q := format('%s.options[%s]', pth, oj);
      if jsonb_typeof(o) is distinct from 'object' then qty_ok := false; errs := errs || app.issue('type', q); continue; end if;
      if o - array['key', 'name', 'translated', 'price', 'priceText', 'maxQty', 'default', 'opens'] <> '{}'::jsonb then
        errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', q || '.' || x)), '[]'::jsonb)
                       from jsonb_object_keys(o) x where x not in ('key', 'name', 'translated', 'price', 'priceText', 'maxQty', 'default', 'opens'));
      end if;
      k := o->'key';
      if not app.js_str(k) or (k #>> '{}') !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' then errs := errs || app.issue('key_invalid', q || '.key');
      elsif dups ? (q || '.key') then errs := errs || app.issue('key_duplicate', q || '.key');
      end if;
      errs := errs || app.draft_text(o->'name', q || '.name', 60, true)
                   || app.draft_translated(o->'translated', q || '.translated', jsonb_build_array(o->'name'));
      if not app.draft_price_ok(o->'price') then errs := errs || app.issue('price_invalid', q || '.price'); end if;
      if not app.js_null(o->'priceText') then errs := errs || app.draft_str(o->'priceText', q || '.priceText', 40); end if;
      if not (app.js_int(o->'maxQty') and (o->>'maxQty')::numeric between 1 and 10) then
        errs := errs || app.issue('option_qty_invalid', q || '.maxQty');
        qty_ok := false;
      end if;
      if jsonb_typeof(o->'default') is distinct from 'boolean' then errs := errs || app.issue('type', q || '.default');
      elsif o->'default' = 'true'::jsonb then defaults := defaults + 1;
      end if;
      if not app.js_null(o->'opens') then
        if not app.js_str(o->'opens') then errs := errs || app.issue('type', q || '.opens');
        elsif o->'opens' = g->'key' then errs := errs || app.issue('opens_self', q || '.opens');
        end if;
        if o->'maxQty' is distinct from '1'::jsonb then errs := errs || app.issue('opener_qty', q || '.maxQty'); end if;
      end if;
    end loop;
    if lim and qty_ok and app.one_of(g->'selection', array['single', 'multiple']) then
      own := app.draft_group_limits(g->>'selection', g->'min', g->'max', g->'options');
      if app.js_str(g->'key') then glim := glim || jsonb_build_object(g->>'key', own); end if;
      if defaults > (own->>'max')::integer then errs := errs || app.issue('defaults_exceed', pth); end if;
    end if;
  end loop;
  for gi in 0 .. jsonb_array_length(v_groups) - 1 loop
    g := v_groups->gi;
    continue when jsonb_typeof(g) is distinct from 'object' or jsonb_typeof(g->'options') is distinct from 'array';
    for oj in 0 .. jsonb_array_length(g->'options') - 1 loop
      o := g->'options'->oj;
      if app.js_obj(o) and app.js_str(o->'opens') and o->'opens' is distinct from g->'key' and not (gfirst ? (o->>'opens')) then
        errs := errs || app.issue('ref_unknown', format('groups[%s].options[%s].opens', gi, oj));
      end if;
    end loop;
  end loop;

  -- sections and dishes
  if jsonb_array_length(v_sections) > 80 then errs := errs || app.issue('too_large', 'sections'); end if;
  for si in 0 .. jsonb_array_length(v_sections) - 1 loop
    s := v_sections->si; pth := format('sections[%s]', si);
    if jsonb_typeof(s) is distinct from 'object' then errs := errs || app.issue('type', pth); continue; end if;
    if s - array['key', 'name', 'translated', 'kind', 'room', 'dishes'] <> '{}'::jsonb then
      errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', pth || '.' || x)), '[]'::jsonb)
                     from jsonb_object_keys(s) x where x not in ('key', 'name', 'translated', 'kind', 'room', 'dishes'));
    end if;
    k := s->'key';
    if not app.js_str(k) or (k #>> '{}') !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' then errs := errs || app.issue('key_invalid', pth || '.key');
    elsif dups ? (pth || '.key') then errs := errs || app.issue('key_duplicate', pth || '.key');
    end if;
    errs := errs || app.draft_text(s->'name', pth || '.name', 60, true)
                 || app.draft_translated(s->'translated', pth || '.translated', jsonb_build_array(s->'name'));
    if not app.one_of(s->'kind', array['food', 'dessert', 'drinks', 'wine', 'beer']) then errs := errs || app.issue('enum_invalid', pth || '.kind'); end if;
    if not app.js_null(s->'room') and not app.one_of(s->'room', array['table', 'vitrine', 'cellar', 'taps', 'cocktail']) then
      errs := errs || app.issue('enum_invalid', pth || '.room');
    end if;
    if jsonb_typeof(s->'dishes') is distinct from 'array' then errs := errs || app.issue('type', pth || '.dishes'); continue; end if;
    dishes := dishes + jsonb_array_length(s->'dishes');
    for dj in 0 .. jsonb_array_length(s->'dishes') - 1 loop
      d := s->'dishes'->dj; q := format('%s.dishes[%s]', pth, dj);
      if jsonb_typeof(d) is distinct from 'object' then errs := errs || app.issue('type', q); continue; end if;
      if d - array['key', 'name', 'desc', 'translated', 'price', 'priceText', 'priceNote', 'tags', 'allergens', 'photo', 'illustration', 'groups'] <> '{}'::jsonb then
        errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', q || '.' || x)), '[]'::jsonb)
                       from jsonb_object_keys(d) x
                       where x not in ('key', 'name', 'desc', 'translated', 'price', 'priceText', 'priceNote', 'tags', 'allergens', 'photo', 'illustration', 'groups'));
      end if;
      k := d->'key';
      if not app.js_str(k) or (k #>> '{}') !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' then errs := errs || app.issue('key_invalid', q || '.key');
      elsif dups ? (q || '.key') then errs := errs || app.issue('key_duplicate', q || '.key');
      end if;
      errs := errs || app.draft_text(d->'name', q || '.name', 90, true) || app.draft_text(d->'desc', q || '.desc', 600, false)
                   || app.draft_translated(d->'translated', q || '.translated', jsonb_build_array(d->'name', d->'desc'));
      if not app.draft_price_ok(d->'price') then errs := errs || app.issue('price_invalid', q || '.price'); end if;
      if not app.js_null(d->'priceText') then errs := errs || app.draft_str(d->'priceText', q || '.priceText', 40); end if;
      errs := errs || app.draft_text(d->'priceNote', q || '.priceNote', 80, false);
      if jsonb_typeof(d->'tags') is distinct from 'array'
         or exists (select 1 from jsonb_array_elements(d->'tags') t where not app.one_of(t, array['vegan', 'vegetarian', 'spicy', 'gf']))
         or (select count(distinct t) from jsonb_array_elements(d->'tags') t) <> jsonb_array_length(d->'tags') then
        errs := errs || app.issue('enum_invalid', q || '.tags');
      end if;
      errs := errs || app.draft_text(d->'allergens', q || '.allergens', 300, false);
      if not app.js_null(d->'photo') then
        if jsonb_typeof(d->'photo') is distinct from 'object' then errs := errs || app.issue('type', q || '.photo');
        else
          if (d->'photo') - array['path', 'rights'] <> '{}'::jsonb then
            errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', q || '.photo.' || x)), '[]'::jsonb)
                           from jsonb_object_keys(d->'photo') x where x not in ('path', 'rights'));
          end if;
          if text_source then errs := errs || app.issue('photo_unexpected', q || '.photo'); end if;
          if not app.js_rel_path(d->'photo'->'path') or char_length(d->'photo'->>'path') > 200 then errs := errs || app.issue('path_invalid', q || '.photo.path'); end if;
          if not app.one_of(d->'photo'->'rights', array['confirmed', 'unknown']) then errs := errs || app.issue('enum_invalid', q || '.photo.rights'); end if;
        end if;
      end if;
      if not app.js_null(d->'illustration') and not (app.js_str(d->'illustration') and (d->>'illustration') ~ '^[a-z0-9][a-z0-9-]{0,39}$') then
        errs := errs || app.issue('stock_invalid', q || '.illustration');
      end if;
      if jsonb_typeof(d->'groups') is distinct from 'array' then errs := errs || app.issue('type', q || '.groups'); continue; end if;
      if jsonb_array_length(d->'groups') > 16 then errs := errs || app.issue('too_large', q || '.groups'); end if;
      linked := '[]';
      for ak in 0 .. jsonb_array_length(d->'groups') - 1 loop
        a := d->'groups'->ak; r := format('%s.groups[%s]', q, ak);
        if jsonb_typeof(a) is distinct from 'object' then errs := errs || app.issue('type', r); continue; end if;
        if a - array['group', 'min', 'max'] <> '{}'::jsonb then
          errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', r || '.' || x)), '[]'::jsonb)
                         from jsonb_object_keys(a) x where x not in ('group', 'min', 'max'));
        end if;
        gr := case when app.js_str(a->'group') then gfirst->(a->>'group') end;
        if gr is null then errs := errs || app.issue('ref_unknown', r || '.group'); continue; end if;
        -- one dish never carries two groups with the same name and selection
        if exists (select 1 from jsonb_array_elements(linked) x(lk)
                   where lk->>'key' = a->>'group'
                      or (lk->'group'->'selection' = gr->'selection' and app.js_obj(lk->'group'->'name') and app.js_obj(gr->'name')
                          and app.score_keys(app.keys_of(lk->'group'->'name'->>'he', lk->'group'->'name'->>'en'),
                                             app.keys_of(gr->'name'->>'he', gr->'name'->>'en')) > 0)) then
          errs := errs || app.issue('addon_duplicate', r); continue;
        end if;
        linked := linked || jsonb_build_array(jsonb_build_object('key', a->>'group', 'group', gr));
        if not app.draft_limit_ok(a->'min', 0) or not app.draft_limit_ok(a->'max', 1)
           or (app.js_int(a->'min') and app.js_int(a->'max') and (a->>'min')::numeric > (a->>'max')::numeric) then
          errs := errs || app.issue('limits_invalid', r); continue;
        end if;
        if gr->'selection' = '"single"'::jsonb and not app.js_null(a->'max') and a->'max' is distinct from '1'::jsonb then
          errs := errs || app.issue('single_max', r); continue;
        end if;
        -- a single choice takes one option at most: a dish minimum above 1 can never be met
        if gr->'selection' = '"single"'::jsonb and app.js_int(a->'min') and (a->>'min')::numeric > 1 then
          errs := errs || app.issue('limits_invalid', r); continue;
        end if;
        own := glim->(a->>'group');
        continue when own is null;
        -- each limit on its own: under a stated one a dish only tightens; an unstated one is a guess that yields to it
        if (app.js_int(a->'min') and app.js_int(gr->'min') and (a->>'min')::numeric < (gr->>'min')::numeric)
           or (app.js_int(a->'max') and app.js_int(gr->'max') and (a->>'max')::numeric > (gr->>'max')::numeric) then
          errs := errs || app.issue('limits_loosened', r); continue;
        end if;
        -- a dish's own limits may not contradict the group's stated ones; what the group's options can reach is the
        -- group's question (limits_unreachable), and the plan lowers a dish minimum to its group's capacity
        if (app.js_int(a->'min') and app.js_int(gr->'max') and (a->>'min')::numeric > (gr->>'max')::numeric)
           or (app.js_int(a->'max') and app.js_int(gr->'min') and (a->>'max')::numeric < (gr->>'min')::numeric) then
          errs := errs || app.issue('limits_invalid', r);
        end if;
      end loop;
    end loop;
  end loop;
  if dishes > 800 then errs := errs || app.issue('too_large', 'sections'); end if;
  if jsonb_array_length(errs) > 0 then return errs; end if;
  if jsonb_array_length(app.import_exceptions(p, array['he', 'en'])) > 2000 then return app.issue('too_many_exceptions', ''); end if;
  return '[]'::jsonb;
end $$;

create function app.exception_one(p_code text, p_key text, p_path text, p_count integer default 1) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('code', p_code, 'severity', app.import_exception_severity(p_code), 'key', p_key, 'path', p_path, 'count', p_count)
$$;

-- draftExceptions(draft, {langs}): the draft's grouped ones first (name_missing_lang, then translation_check, when
-- their count is above 0, under the key _draft), then sections in order (each, then its dishes), then groups in order
-- (each, then its options); within a node the codes in IMPORT_EXCEPTIONS order. Expects a draft the validator accepted.
create function app.import_exceptions(p_draft jsonb, p_langs text[] default array['he', 'en']) returns jsonb
language plpgsql immutable set search_path = '' set jit = off as $$
declare
  out jsonb[] := '{}';     -- (an array: appending to it in PL/pgSQL does not copy it)
  opened jsonb := '{}';
  secs jsonb := p_draft->'sections'; grps jsonb := p_draft->'groups';
  skeys jsonb := '[]';    -- each section's keys, in order
  twin jsonb;             -- flat dish index -> 'duplicate' | 'repeated'
  s jsonb; d jsonb; g jsonb; o jsonb; gl jsonb;
  si integer; dj integer; gi integer; oj integer; k integer;
  p text; q text; dish_n integer := 0; missing integer := 0; translated integer := 0;
begin
  for g in select x from jsonb_array_elements(grps) x loop
    for o in select x from jsonb_array_elements(g->'options') x loop
      if not app.js_null(o->'opens') then opened := opened || jsonb_build_object(o->>'opens', true); end if;
    end loop;
  end loop;
  select coalesce(jsonb_agg(app.keys_of(x->'name'->>'he', x->'name'->>'en') order by i), '[]') into skeys
  from jsonb_array_elements(secs) with ordinality t(x, i);

  -- every dish, flat, with its name keys. dish_duplicate: an earlier dish of the same name in the same section (or a
  -- section of the same name). dish_repeated: a twin (the same name and price in another, differently named section)
  -- that is kept first: the most add-on groups, the section with the smaller share of twins, the section whose twins
  -- are in fewer other sections (counted by index: "Popular" repeats dishes of many, a real section's twins are in
  -- "Popular" only), the larger section, the earlier in the draft.
  with flat as (
    select (row_number() over (order by s.si, x.dj) - 1)::integer as idx, (s.si - 1)::integer as sec,
           app.keys_of(x.d->'name'->>'he', x.d->'name'->>'en')->>'he' as kh, app.keys_of(x.d->'name'->>'he', x.d->'name'->>'en')->>'en' as ken,
           x.d->'price' as price, jsonb_array_length(x.d->'groups') as ng, jsonb_array_length(s.s->'dishes') as sz
    from jsonb_array_elements(secs) with ordinality s(s, si), jsonb_array_elements(s.s->'dishes') with ordinality x(d, dj)
  ), same_sec as (
    -- sections that count as one: the same section, or the same name (at most 80 x 80 pairs)
    select sa.n - 1 as sec_a, sb.n - 1 as sec_b from jsonb_array_elements(skeys) with ordinality sa(sk, n), jsonb_array_elements(skeys) with ordinality sb(sk, n)
    where sa.n = sb.n or (sa.sk->>'he' <> '' and sa.sk->>'he' = sb.sk->>'he')
       or (sa.sk->>'en' <> '' and sa.sk->>'en' = sb.sk->>'en' and not (sa.sk->>'he' <> '' and sb.sk->>'he' <> '' and sa.sk->>'he' <> sb.sk->>'he'))
  ), named_alike as (
    select f.idx as fi, t.idx as ti from flat f join flat t on t.kh = f.kh and t.idx <> f.idx where f.kh <> ''
    union
    select f.idx, t.idx from flat f join flat t on t.ken = f.ken and t.idx <> f.idx
    where f.ken <> '' and not (f.kh <> '' and t.kh <> '' and f.kh <> t.kh)
  ), pairs as (
    select na.fi, na.ti, ss.sec_a is not null as same_section, f.price = t.price as same_price
    from named_alike na join flat f on f.idx = na.fi join flat t on t.idx = na.ti left join same_sec ss on ss.sec_a = f.sec and ss.sec_b = t.sec
  ), dup as (
    select distinct fi from pairs where same_section and ti < fi
  ), twins as (
    select fi, ti from pairs where not same_section and same_price
  ), share as (
    select f.sec, count(distinct f.idx)::bigint as n from flat f join twins w on w.fi = f.idx group by f.sec
  ), spread as (
    select f.sec, count(distinct t.sec)::bigint as n from twins w join flat f on f.idx = w.fi join flat t on t.idx = w.ti group by f.sec
  ), fs as (
    select f.*, coalesce(sh.n, 0) as tn, coalesce(sp.n, 0) as sp from flat f left join share sh on sh.sec = f.sec left join spread sp on sp.sec = f.sec
  ), rep as (
    select distinct w.fi from twins w join fs f on f.idx = w.fi join fs t on t.idx = w.ti
    where t.ng > f.ng or (t.ng = f.ng and (t.tn * f.sz < f.tn * t.sz
          or (t.tn * f.sz = f.tn * t.sz and (t.sp < f.sp
          or (t.sp = f.sp and (t.sz > f.sz or (t.sz = f.sz and t.idx < f.idx)))))))
  )
  select coalesce(jsonb_object_agg(fs.idx::text, case when dup.fi is not null then 'duplicate' else 'repeated' end), '{}') into twin
  from fs left join dup on dup.fi = fs.idx left join rep on rep.fi = fs.idx
  where dup.fi is not null or rep.fi is not null;

  for si in 0 .. jsonb_array_length(secs) - 1 loop
    s := secs->si; p := format('sections[%s]', si);
    if si >= 40 then out := out || app.exception_one('too_many', s->>'key', p); end if;
    if exists (select 1 from generate_series(0, si - 1) j where app.score_keys(skeys->si, skeys->j) > 0) then
      out := out || app.exception_one('section_duplicate', s->>'key', p);
    end if;
    missing := missing + app.named_missing(s->'name', p_langs);
    translated := translated + app.named_translated(s->'name', s->'translated', '[]');
    if app.symbols_only(s->'name') then out := out || app.exception_one('name_symbols', s->>'key', p); end if;
    for dj in 0 .. jsonb_array_length(s->'dishes') - 1 loop
      d := s->'dishes'->dj; q := format('%s.dishes[%s]', p, dj);
      if app.js_null(d->'price') and (app.js_null(d->'priceText') or app.strip_blank(d->>'priceText') = '') then
        out := out || app.exception_one('price_missing', d->>'key', q);
      end if;
      if app.js_null(d->'price') and not app.js_null(d->'priceText') and app.strip_blank(d->>'priceText') <> '' then
        out := out || app.exception_one('price_unreadable', d->>'key', q);
      end if;
      if d->'price' = '0'::jsonb then out := out || app.exception_one('price_zero', d->>'key', q); end if;
      if twin->>(dish_n::text) = 'duplicate' then out := out || app.exception_one('dish_duplicate', d->>'key', q);
      elsif twin->>(dish_n::text) = 'repeated' then out := out || app.exception_one('dish_repeated', d->>'key', q);
      end if;
      missing := missing + app.named_missing(d->'name', p_langs);
      translated := translated + app.named_translated(d->'name', d->'translated', jsonb_build_array(d->'desc'));
      if app.symbols_only(d->'name') then out := out || app.exception_one('name_symbols', d->>'key', q); end if;
      if dish_n >= 400 then out := out || app.exception_one('too_many', d->>'key', q); end if;
      dish_n := dish_n + 1;
      if not app.js_null(d->'photo') and d->'photo'->'rights' is distinct from '"confirmed"'::jsonb then
        out := out || app.exception_one('photo_rights_unknown', d->>'key', q);
      end if;
      if app.strip_blank(d->'allergens'->>'he') <> '' or app.strip_blank(d->'allergens'->>'en') <> '' then
        out := out || app.exception_one('allergens_check', d->>'key', q);
      end if;
      for k in 8 .. jsonb_array_length(d->'groups') - 1 loop
        out := out || app.exception_one('too_many', (d->>'key') || '>' || (d->'groups'->k->>'group'), format('%s.groups[%s]', q, k));
      end loop;
    end loop;
  end loop;

  for gi in 0 .. jsonb_array_length(grps) - 1 loop
    g := grps->gi; p := format('groups[%s]', gi);
    gl := app.draft_group_limits(g->>'selection', g->'min', g->'max', g->'options');
    if gl->'stated' = 'false'::jsonb then out := out || app.exception_one('limits_guessed', g->>'key', p); end if;
    if (gl->>'min')::integer > (gl->>'capacity')::integer then out := out || app.exception_one('limits_unreachable', g->>'key', p); end if;
    missing := missing + app.named_missing(g->'name', p_langs);
    translated := translated + app.named_translated(g->'name', g->'translated', '[]');
    if app.symbols_only(g->'name') then out := out || app.exception_one('name_symbols', g->>'key', p); end if;
    if gi >= 200 then out := out || app.exception_one('too_many', g->>'key', p); end if;
    for oj in 0 .. jsonb_array_length(g->'options') - 1 loop
      o := g->'options'->oj; q := format('%s.options[%s]', p, oj);
      if app.js_null(o->'price') then out := out || app.exception_one('option_price_unreadable', o->>'key', q); end if;
      missing := missing + app.named_missing(o->'name', p_langs);
      translated := translated + app.named_translated(o->'name', o->'translated', '[]');
      if app.symbols_only(o->'name') then out := out || app.exception_one('name_symbols', o->>'key', q); end if;
      if not app.js_null(o->'opens') and opened ? (g->>'key') then out := out || app.exception_one('nesting_too_deep', o->>'key', q); end if;
      if oj >= 30 then out := out || app.exception_one('too_many', o->>'key', q); end if;
    end loop;
  end loop;

  -- the grouped ones, then node order (each key's first exception), then the codes' order, then as found
  return case when missing > 0 then jsonb_build_array(app.exception_one('name_missing_lang', '_draft', '', missing)) else '[]'::jsonb end
      || case when translated > 0 then jsonb_build_array(app.exception_one('translation_check', '_draft', '', translated)) else '[]'::jsonb end
      || (select coalesce(jsonb_agg(z.e order by z.first_at, z.rank, z.i), '[]'::jsonb)
          from (select x.e, x.i, min(x.i) over (partition by x.e->>'key') as first_at,
                       array_position(app.import_exception_codes(), x.e->>'code') as rank
                from unnest(out) with ordinality x(e, i)) z);
end $$;

-- named(): 1 when the name is blank in one of the venue's languages; 1 when the reader translated text it shows
create function app.named_missing(p_name jsonb, p_langs text[]) returns integer language plpgsql immutable set search_path = '' as $$
declare l text;
begin
  foreach l in array p_langs loop
    if app.strip_blank(coalesce(p_name->>l, '')) = '' then return 1; end if;
  end loop;
  return 0;
end $$;

create function app.named_translated(p_name jsonb, p_translated jsonb, p_extra jsonb) returns integer language plpgsql immutable set search_path = '' as $$
declare t jsonb; l text;
begin
  if jsonb_array_length(p_translated) = 0 then return 0; end if;
  for t in select x from jsonb_array_elements(jsonb_build_array(p_name) || p_extra) x loop
    for l in select y from jsonb_array_elements_text(p_translated) y loop
      if app.strip_blank(coalesce(t->>l, '')) <> '' then return 1; end if;
    end loop;
  end loop;
  return 0;
end $$;

-- validateDecisions (the choices' errors come in the database's key order)
create function app.validate_import_decisions(p jsonb) returns jsonb language plpgsql immutable set search_path = '' set jit = off as $$
declare errs jsonb := '[]'; k text; v jsonb; i integer;
begin
  if jsonb_typeof(p) is distinct from 'object' then return app.issue('type', ''); end if;
  errs := (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', x)), '[]'::jsonb)
           from jsonb_object_keys(p) x where x not in ('v', 'pricesConfirmed', 'choices', 'skip'));
  if p->'v' is distinct from '1'::jsonb then errs := errs || app.issue('version', 'v'); end if;
  if jsonb_typeof(p->'pricesConfirmed') is distinct from 'boolean' then errs := errs || app.issue('type', 'pricesConfirmed'); end if;
  if jsonb_typeof(p->'choices') is distinct from 'object' then errs := errs || app.issue('type', 'choices');
  else
    if (select count(*) from jsonb_object_keys(p->'choices')) > 5000 then errs := errs || app.issue('too_large', 'choices'); end if;
    for k, v in select key, value from jsonb_each(p->'choices') loop
      if k !~ '^[a-z_]{1,40}@[a-z0-9_][a-z0-9_.>@-]{0,170}$' or not app.one_of(v, app.import_choice_list()) then
        errs := errs || app.issue('choice_invalid', 'choices.' || k);
      end if;
    end loop;
  end if;
  if p ? 'skip' then
    if jsonb_typeof(p->'skip') is distinct from 'array' then errs := errs || app.issue('type', 'skip');
    else
      if jsonb_array_length(p->'skip') > 5000 then errs := errs || app.issue('too_large', 'skip'); end if;
      for i in 0 .. jsonb_array_length(p->'skip') - 1 loop
        if not app.js_str(p->'skip'->i) or (p->'skip'->>i) !~ '^[a-z0-9][a-z0-9_.-]{0,63}(>[a-z0-9][a-z0-9_.-]{0,63})?$' then
          errs := errs || app.issue('key_invalid', format('skip[%s]', i));
        end if;
      end loop;
    end if;
  end if;
  return errs;
end $$;

-- the save/apply inputs (validateSaveDraft, validateApplyImport): no other keys; the draft's and the decisions' paths prefixed
create function app.prefix_issues(p jsonb, p_prefix text) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(e || jsonb_build_object('path', case when e->>'path' = '' then p_prefix else p_prefix || '.' || (e->>'path') end) order by i), '[]'::jsonb)
  from jsonb_array_elements(p) with ordinality x(e, i)
$$;

-- READER_NOTES: what a reader says about the source, and its severity (codes, keys, lines and counts; never text)
create function app.reader_notes() returns jsonb language sql immutable set search_path = '' as $$
  select '{"empty_input": "info", "input_truncated": "check", "caps_reached": "check", "noise": "info", "line_unknown": "info",
    "section_text": "info", "section_empty": "info", "popular_dropped": "info", "popular_only": "check", "label_dropped": "info",
    "sold_out": "check", "price_range": "check", "price_discount": "check", "price_from_button": "check", "text_clipped": "check",
    "limits_dropped": "check", "defaults_cleared": "check", "group_orphan": "info", "nesting_unmatched": "info", "page_truncated": "check",
    "page_unreadable": "check", "price_ambiguous": "check", "layout_guessed": "check"}'::jsonb
$$;

-- LAYOUT_GUESS_RULES: the guesses a layout_guessed note names in its rule
create function app.layout_guess_rules() returns text[] language sql immutable set search_path = '' as
$$ select array['tag_or_heading', 'desc_habit', 'common_name', 'other_language'] $$;

-- readerNoteIssues(notes, draft, prefix): at most NOTES_MAX (2000) notes; each {code, severity, key, lines, count, rule}:
-- a known code with its severity, a draft key (one the draft has, when the draft is given) or null, 1-based ascending
-- lines (at most 100), a count 1 to 1 000 000, a rule word or null. A layout_guessed note needs a key (null is
-- key_invalid; with the draft, one of its sections or dishes, else ref_unknown) and a rule of app.layout_guess_rules().
create function app.validate_reader_notes(p jsonb, p_draft jsonb default null, p_prefix text default 'notes') returns jsonb
language plpgsql immutable set search_path = '' as $$
declare errs jsonb := '[]'; keys jsonb; dish_or_section jsonb; n jsonb; i integer; q text; lines jsonb; layout boolean;
begin
  if jsonb_typeof(p) is distinct from 'array' then return app.issue('type', p_prefix); end if;
  if jsonb_array_length(p) > 2000 then errs := errs || app.issue('too_many', p_prefix); end if;
  if p_draft is not null then
    select coalesce(jsonb_object_agg(k, true), '{}') into dish_or_section from (
      select s->>'key' as k from jsonb_array_elements(p_draft->'sections') s
      union all select d->>'key' from jsonb_array_elements(p_draft->'sections') s, jsonb_array_elements(s->'dishes') d) z;
    select dish_or_section || coalesce(jsonb_object_agg(k, true), '{}') into keys from (
      select g->>'key' as k from jsonb_array_elements(p_draft->'groups') g
      union all select o->>'key' from jsonb_array_elements(p_draft->'groups') g, jsonb_array_elements(g->'options') o) z;
  end if;
  for i in 0 .. jsonb_array_length(p) - 1 loop
    n := p->i; q := format('%s[%s]', p_prefix, i);
    if jsonb_typeof(n) is distinct from 'object' then errs := errs || app.issue('type', q); continue; end if;
    errs := errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'field_not_allowed', 'path', q || '.' || k)), '[]'::jsonb)
                     from jsonb_object_keys(n) k where not (k = any (array['code', 'severity', 'key', 'lines', 'count', 'rule'])));
    if not app.one_of(n->'code', array(select jsonb_object_keys(app.reader_notes()))) then errs := errs || app.issue('enum_invalid', q || '.code');
    elsif n->'severity' is distinct from app.reader_notes()->(n->>'code') then errs := errs || app.issue('enum_invalid', q || '.severity');
    end if;
    layout := n->'code' = '"layout_guessed"'::jsonb;
    if n->'key' is distinct from 'null'::jsonb then
      if not app.js_str(n->'key') or (n->>'key') !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' then errs := errs || app.issue('key_invalid', q || '.key');
      elsif keys is not null and not (case when layout then dish_or_section else keys end) ? (n->>'key') then errs := errs || app.issue('ref_unknown', q || '.key');
      end if;
    elsif layout then errs := errs || app.issue('key_invalid', q || '.key');
    end if;
    lines := n->'lines';
    if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) > 100
       or exists (select 1 from jsonb_array_elements(lines) with ordinality t(l, j)
                  where case when not app.js_int(l) then true
                             else (l::text)::numeric not between 1 and 1000000
                                  or (j > 1 and (case when app.js_int(lines->(j::integer - 2)) then (l::text)::numeric <= ((lines->(j::integer - 2))::text)::numeric else false end)) end) then
      errs := errs || app.issue('lines_invalid', q || '.lines');
    end if;
    if not (app.js_int(n->'count') and (n->>'count')::numeric between 1 and 1000000) then errs := errs || app.issue('count_invalid', q || '.count'); end if;
    if (case when layout then not (app.js_str(n->'rule') and (n->>'rule') = any (app.layout_guess_rules()))
             else n->'rule' is distinct from 'null'::jsonb and not (app.js_str(n->'rule') and (n->>'rule') ~ '^[a-z][a-z0-9_]{0,39}$') end) then
      errs := errs || app.issue('rule_invalid', q || '.rule');
    end if;
  end loop;
  return errs;
end $$;

create function app.validate_save_draft(p jsonb) returns jsonb language sql immutable set search_path = '' set jit = off as $$
  select case when jsonb_typeof(p) is distinct from 'object' then app.issue('type', '')
    else app.v_only_keys(p, array['importId', 'draft', 'notes']) || app.v_uuid_at(p->'importId', 'importId')
      || app.prefix_issues(app.validate_import_draft(p->'draft'), 'draft')
      || case when p ? 'notes'
              then app.validate_reader_notes(p->'notes', case when jsonb_array_length(app.validate_import_draft(p->'draft')) = 0 then p->'draft' end)
              else '[]'::jsonb end end
$$;

create function app.validate_apply_import(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) is distinct from 'object' then app.issue('type', '')
    else app.v_only_keys(p, array['importId', 'draft', 'decisions'])
      || app.validate_save_draft(jsonb_build_object('importId', p->'importId', 'draft', p->'draft'))
      || app.prefix_issues(app.validate_import_decisions(p->'decisions'), 'decisions') end
$$;

-- ================================================================ the plan (planApply's rules 1-15, packages/contracts/src/import.ts)
-- app.plan_import_on(draft, existing menu as JSON, decisions, langs) is the pure twin of planApply: the same steps,
-- summary, answered exceptions and fromDraft, or the same errors in the same order. app.plan_import reads the venue's
-- menu as ExistingMenu and calls it. Ties are broken as the contracts break them: position, then id (text order),
-- then draft key. supabase/tests/import-twins runs both on every plan the contracts' own tests make.

create function app.kind_family(p text) returns text language sql immutable set search_path = '' as
$$ select case when p in ('food', 'dessert') then 'food' when p in ('drinks', 'wine', 'beer') then 'drink' end $$;

-- assign(): pairs {n, r, score, rank}, best score first, then the lower rank (prefer), then the row's position, its
-- id, the node's key; each node and each row at most once. taken: the rows already used (kept across calls).
create function app.plan_assign(p_pairs jsonb, inout taken jsonb, out map jsonb) language plpgsql immutable set search_path = '' set jit = off as $$
declare pr jsonb;
begin
  map := '{}';
  for pr in select x from jsonb_array_elements(p_pairs) x
            order by (x->>'score')::integer desc, coalesce((x->>'rank')::integer, 0), (x->'r'->>'position')::numeric,
                     (x->'r'->>'id') collate "C", (x->>'n') collate "C" loop
    continue when map ? (pr->>'n') or taken ? (pr->'r'->>'id');
    map := map || jsonb_build_object(pr->>'n', pr->'r');
    taken := taken || jsonb_build_object(pr->'r'->>'id', true);
  end loop;
end $$;

-- cover(): the existing options (rows) the draft's kept options (nodes) match, each at most once
create function app.plan_cover(p_nodes jsonb, p_rows jsonb) returns jsonb language plpgsql immutable set search_path = '' set jit = off as $$
declare pairs jsonb; m jsonb; t jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('n', n->>'key', 'r', r, 'score', app.score_keys(n->'keys', r->'keys'))), '[]') into pairs
  from jsonb_array_elements(coalesce(p_nodes, '[]')) n
  join jsonb_array_elements(coalesce(p_rows, '[]')) r
    on ((n->'keys'->>'he' <> '' and r->'keys'->>'he' = n->'keys'->>'he') or (n->'keys'->>'en' <> '' and r->'keys'->>'en' = n->'keys'->>'en'))
  where app.score_keys(n->'keys', r->'keys') > 0;
  select a.map, a.taken into m, t from app.plan_assign(pairs, '{}') a;
  return m;
end $$;

-- the steps' shapes
create function app.plan_skip(p_kind text, p_key text, p_reason text) returns jsonb language sql immutable set search_path = '' as
$$ select jsonb_build_object('kind', p_kind, 'key', p_key, 'op', 'skip', 'id', null, 'set', '{}'::jsonb, 'refs', '{}'::jsonb, 'reason', p_reason) $$;

create function app.plan_create(p_kind text, p_key text, p_set jsonb, p_refs jsonb) returns jsonb language sql immutable set search_path = '' as
$$ select jsonb_build_object('kind', p_kind, 'key', p_key, 'op', 'create', 'id', null, 'set', p_set, 'refs', p_refs, 'reason', null) $$;

-- update when something changes, else keep
create function app.plan_change(p_kind text, p_key text, p_id text, p_set jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when p_set <> '{}'::jsonb
    then jsonb_build_object('kind', p_kind, 'key', p_key, 'op', 'update', 'id', p_id, 'set', p_set, 'refs', '{}'::jsonb, 'reason', null)
    else jsonb_build_object('kind', p_kind, 'key', p_key, 'op', 'keep', 'id', p_id, 'set', '{}'::jsonb, 'refs', '{}'::jsonb, 'reason', null) end
$$;

-- fillBlank(): the columns whose current value is blank and the draft's is not (stripped)
create function app.plan_fill_blank(p_cur jsonb, p_draft jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare k text; v text; clean text; res jsonb := '{}';
begin
  for k, v in select e.key, e.value from jsonb_each_text(p_draft) e loop
    clean := app.strip_blank(v);
    if clean <> '' and (jsonb_typeof(p_cur->k) is distinct from 'string' or app.strip_blank(p_cur->>k) = '') then
      res := res || jsonb_build_object(k, clean);
    end if;
  end loop;
  return res;
end $$;

-- replaceNames(): the source's names replace the section's (a blank one never does)
create function app.plan_replace_names(p_cur jsonb, p_name jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare he text := app.strip_blank(p_name->>'he'); en text := app.strip_blank(p_name->>'en'); res jsonb := '{}';
begin
  if he <> '' and he is distinct from p_cur->>'name_he' then res := res || jsonb_build_object('name_he', he); end if;
  if en <> '' and en is distinct from p_cur->>'name_en' then res := res || jsonb_build_object('name_en', en); end if;
  return res;
end $$;

create function app.plan_next_position(p_rows jsonb) returns integer language sql immutable set search_path = '' as
$$ select coalesce((select max((r->>'position')::integer) + 1 from jsonb_array_elements(coalesce(p_rows, '[]')) r), 0) $$;

-- a group's targets: the global one (when needed), then the dishes' and options' own groups by id
create function app.plan_targets(p_global jsonb, p_own text[]) returns jsonb language plpgsql immutable set search_path = '' as $$
declare list jsonb := case when p_global is null then '[]'::jsonb else jsonb_build_array(p_global) end; gid text;
begin
  for gid in select x.u from (select distinct u from unnest(p_own) u where u is not null) x order by x.u collate "C" loop
    if (list->0->>'id') is distinct from gid then list := list || jsonb_build_array(jsonb_build_object('id', gid, 'ref', null)); end if;
  end loop;
  return list;
end $$;

-- answer(): an exception takes the owner's answer, or a check its first choice; a fix with no answer, or an answer it
-- does not allow, is an error (at the exception's key, the code as the message)
create function app.plan_ask(p_choice jsonb, p_errs jsonb, p_code text, p_key text, p_path text, p_count integer, p_decisions jsonb,
                             out c text, out choice jsonb, out errs jsonb, out rec jsonb) language plpgsql immutable set search_path = '' as $$
declare allowed jsonb := app.import_choices()->p_code; v jsonb := p_decisions->'choices'->(p_code || '@' || p_key);
begin
  choice := p_choice; errs := p_errs; c := null; rec := null;
  if v is null then
    if app.import_exception_severity(p_code) = 'fix' then errs := errs || app.issue('exception_unresolved', p_key, p_code); return; end if;
    c := allowed->>0;
  elsif not (allowed @> jsonb_build_array(v)) then
    errs := errs || app.issue('choice_invalid', p_key, p_code); return;
  else
    c := v #>> '{}';
  end if;
  choice := choice || jsonb_build_object(p_code || '@' || p_key, c);
  rec := jsonb_build_object('code', p_code, 'severity', app.import_exception_severity(p_code), 'key', p_key, 'path', p_path, 'count', p_count, 'choice', c);
end $$;

-- override(): one node of a grouped exception answered on its own (<code>@<node key>), else the group's answer
create function app.plan_override(p_errs jsonb, p_decisions jsonb, p_code text, p_key text, p_fallback text, out c text, out errs jsonb)
language plpgsql immutable set search_path = '' as $$
declare v jsonb := p_decisions->'choices'->(p_code || '@' || p_key);
begin
  errs := p_errs; c := p_fallback;
  if v is null then return; end if;
  if not ((app.import_choices()->p_code) @> jsonb_build_array(v)) then errs := errs || app.issue('choice_invalid', p_key, p_code); return; end if;
  c := v #>> '{}';
end $$;

-- the cascade of what is left out: a group whose options are all left out is left out (empty); a group left out takes
-- its options and the options that open it; until nothing changes
create function app.plan_cascade(p_grps jsonb, p_openers jsonb, p_skipped jsonb) returns jsonb
language plpgsql immutable set search_path = '' set jit = off as $$
declare v_skipped jsonb := p_skipped; v_changed boolean; v_g jsonb; v_o jsonb; v_gi integer;
begin
  loop
    v_changed := false;
    for v_gi in 0 .. jsonb_array_length(p_grps) - 1 loop
      v_g := p_grps->v_gi;
      if not v_skipped ? (v_g->>'key') and not exists (select 1 from jsonb_array_elements(v_g->'options') x where not v_skipped ? (x->>'key')) then
        v_skipped := v_skipped || jsonb_build_object(v_g->>'key', 'empty'); v_changed := true;
      end if;
      continue when not v_skipped ? (v_g->>'key');
      for v_o in select x from jsonb_array_elements(v_g->'options' || coalesce(p_openers->(v_g->>'key'), '[]')) x loop
        if not v_skipped ? (v_o->>'key') then v_skipped := v_skipped || jsonb_build_object(v_o->>'key', 'parent_skipped'); v_changed := true; end if;
      end loop;
    end loop;
    exit when not v_changed;
  end loop;
  return v_skipped;
end $$;

-- a draft group's global match (rule 10) over the option nodes given ({key, keys}): an existing group with its selection,
-- a name that matches, options that cover the nodes; the best score, then the fewest options, then the smaller id
create function app.plan_global_match(p_k jsonb, p_selection jsonb, p_nodes jsonb, p_groups jsonb, p_options_of jsonb) returns text
language plpgsql immutable set search_path = '' set jit = off as $$
declare y jsonb;
begin
  for y in select x from jsonb_array_elements(p_groups) x
           where ((p_k->>'he' <> '' and x->'keys'->>'he' = p_k->>'he') or (p_k->>'en' <> '' and x->'keys'->>'en' = p_k->>'en'))
             and app.score_keys(p_k, x->'keys') > 0 and x->'selection' = p_selection
           order by app.score_keys(p_k, x->'keys') desc, jsonb_array_length(coalesce(p_options_of->(x->>'id'), '[]')), (x->>'id') collate "C" loop
    if (select count(*) from jsonb_object_keys(app.plan_cover(p_nodes, p_options_of->(y->>'id')))) = jsonb_array_length(p_nodes) then return y->>'id'; end if;
  end loop;
  return null;
end $$;

create function app.plan_import_on(p_draft jsonb, p_existing jsonb, p_decisions jsonb, p_langs text[] default array['he', 'en']) returns jsonb
language plpgsql immutable set search_path = '' set jit = off as $$
declare
  v_secs jsonb := p_draft->'sections'; v_grps jsonb := p_draft->'groups';
  v_errs jsonb := '[]'; v_choice jsonb := '{}'; v_answered jsonb := '[]'; v_plan_asked jsonb := '[]';
  v_c text; v_rec jsonb; v_e jsonb;
  v_skipped jsonb := '{}'; v_asked jsonb := '{}'; v_openers jsonb := '{}'; v_changed boolean; v_more boolean;
  v_unreach_draft jsonb := '{}'; v_asked_unreach jsonb := '{}'; v_gone jsonb := '{}';
  v_ex_sections jsonb; v_ex_dishes jsonb; v_ex_groups jsonb; v_section_by_id jsonb; v_dish_by_id jsonb; v_group_by_id jsonb;
  v_options_of jsonb; v_links_of jsonb; v_dish_path jsonb := '{}'; v_section_path jsonb := '{}'; v_sec_keys jsonb := '{}';
  v_target jsonb := '{}'; v_merged jsonb := '{}'; v_name_matched jsonb := '{}'; v_claimed jsonb := '{}';
  v_kept jsonb := '[]'; v_taken jsonb := '{}'; v_pairs jsonb; v_in_section jsonb; v_elsewhere jsonb; v_other_kind jsonb;
  v_renamed jsonb := '[]'; v_affinity jsonb := '{}'; v_match_of jsonb := '{}'; v_section_price jsonb := '{}';
  v_dish_target jsonb := '{}'; v_dish_steps jsonb[] := '{}'; v_next_dish_pos jsonb := '{}'; v_created_in_section jsonb := '{}';
  v_section_steps jsonb[] := '{}'; v_section_position integer;
  v_group_keys jsonb := '{}'; v_option_nodes jsonb := '{}'; v_cover jsonb := '{}'; v_global_match jsonb := '{}';
  v_link_res jsonb := '{}'; v_needs_global jsonb := '{}'; v_forced_new jsonb := '{}'; v_group_of jsonb := '{}'; v_res_by_group jsonb := '{}';
  v_opener_own jsonb := '{}'; v_opener_add jsonb := '{}'; v_opener_move jsonb := '{}';
  v_group_steps jsonb[] := '{}'; v_option_steps jsonb[] := '{}'; v_capacity jsonb := '{}'; v_link_steps jsonb[] := '{}';
  v_photo_steps jsonb[] := '{}'; v_next_link_pos jsonb := '{}'; v_steps jsonb; v_step_index jsonb; v_plan_ex jsonb; v_summary jsonb;
  v_s jsonb; v_d jsonb; v_g jsonb; v_o jsonb; v_a jsonb; v_t jsonb; v_m jsonb; v_near jsonb; v_far jsonb; v_home jsonb; v_set jsonb;
  v_refs jsonb; v_k jsonb; v_y jsonb; v_ng jsonb; v_res jsonb; v_dt jsonb; v_gt jsonb; v_lim jsonb; v_targets jsonb; v_primary jsonb;
  v_kept_opts jsonb; v_cov jsonb; v_ot jsonb; v_own jsonb; v_price jsonb; v_jmn jsonb; v_jmx jsonb;
  v_si integer; v_dj integer; v_gi integer; v_oj integer; v_ak integer; v_ti integer; v_n integer; v_pos integer; v_mn integer; v_mx integer;
  v_cap integer; v_differing integer;
  v_key text; v_lk text; v_tk text; v_nested text; v_ok text; v_ek text; v_path text; v_q text; v_reason text; v_top text; v_first text;
  v_gk text; v_root text; v_cur text; v_group_price text; v_adding boolean; v_at_upload boolean; v_at text; v_landed jsonb;
  v_link_list jsonb[] := '{}'; v_pass jsonb; v_tie jsonb := '{}'; v_merged_links jsonb := '{}'; v_lkeys jsonb; v_sel jsonb; v_new boolean;
  v_created_used jsonb := '{}'; v_claimed_rows jsonb := '{}'; v_claimed_row boolean;
begin
  -- ---- 1. the draft's answers, in one pass (as plan_ask answers each: a fix without an answer, or an answer the
  -- exception does not allow, is an error at its key, in the exceptions' order)
  with e as (
    select t.x, t.i, app.import_choices()->(t.x->>'code') as allowed, p_decisions->'choices'->((t.x->>'code') || '@' || (t.x->>'key')) as v
    from jsonb_array_elements(app.import_exceptions(p_draft, p_langs)) with ordinality t(x, i)
  ), r as (
    select e.*, case when e.v is null then case when e.x->>'severity' = 'fix' then 'exception_unresolved' end
                     when not e.allowed @> jsonb_build_array(e.v) then 'choice_invalid' end as bad
    from e
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', r.bad, 'path', r.x->>'key', 'message', r.x->>'code') order by r.i) filter (where r.bad is not null), '[]'),
         coalesce(jsonb_agg(r.x || jsonb_build_object('choice', coalesce(r.v, r.allowed->0)) order by r.i) filter (where r.bad is null), '[]'),
         coalesce(jsonb_object_agg((r.x->>'code') || '@' || (r.x->>'key'), coalesce(r.v, r.allowed->0)) filter (where r.bad is null), '{}')
  into v_errs, v_answered, v_choice from r;

  -- ---- 2. what is left out
  select coalesce(jsonb_object_agg(x, true), '{}') into v_asked from jsonb_array_elements_text(coalesce(p_decisions->'skip', '[]')) x;
  select v_asked || coalesce(jsonb_object_agg(substr(x.key, strpos(x.key, '@') + 1), true), '{}') into v_asked
  from jsonb_each_text(v_choice) x where x.value = 'skip';
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    if v_asked ? (v_s->>'key') then v_skipped := v_skipped || jsonb_build_object(v_s->>'key', 'choice'); end if;
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj;
      if v_skipped ? (v_s->>'key') then v_skipped := v_skipped || jsonb_build_object(v_d->>'key', 'parent_skipped');
      elsif v_asked ? (v_d->>'key') then v_skipped := v_skipped || jsonb_build_object(v_d->>'key', 'choice');
      end if;
    end loop;
  end loop;
  for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
    v_g := v_grps->v_gi;
    if v_asked ? (v_g->>'key') then v_skipped := v_skipped || jsonb_build_object(v_g->>'key', 'choice'); end if;
    for v_oj in 0 .. jsonb_array_length(v_g->'options') - 1 loop
      v_o := v_g->'options'->v_oj;
      if v_asked ? (v_o->>'key') then v_skipped := v_skipped || jsonb_build_object(v_o->>'key', 'choice'); end if;
    end loop;
  end loop;
  -- opensOf: the group an option opens, unless the owner unlinked it; openers by the group they open
  for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
    v_g := v_grps->v_gi;
    for v_oj in 0 .. jsonb_array_length(v_g->'options') - 1 loop
      v_o := v_g->'options'->v_oj;
      v_nested := case when not app.js_null(v_o->'opens') and v_choice->>('nesting_too_deep@' || (v_o->>'key')) is distinct from 'unlink' then v_o->>'opens' end;
      if v_nested is not null then v_openers := v_openers || jsonb_build_object(v_nested, coalesce(v_openers->v_nested, '[]') || jsonb_build_array(v_o)); end if;
    end loop;
  end loop;
  -- ---- keys, once per row (the existing menu's, and the draft groups')
  select coalesce(jsonb_agg(x || jsonb_build_object('keys', app.keys_of(x->>'name_he', x->>'name_en'))), '[]') into v_ex_sections
  from jsonb_array_elements(p_existing->'sections') x;
  select coalesce(jsonb_object_agg(x->>'id', x), '{}') into v_section_by_id from jsonb_array_elements(v_ex_sections) x;
  select coalesce(jsonb_agg(x || jsonb_build_object('keys', app.keys_of(x->>'name_he', x->>'name_en'))), '[]') into v_ex_dishes
  from jsonb_array_elements(p_existing->'dishes') x;
  select coalesce(jsonb_object_agg(x->>'id', x), '{}') into v_dish_by_id from jsonb_array_elements(v_ex_dishes) x;
  select coalesce(jsonb_agg(x || jsonb_build_object('keys', app.keys_of(x->>'name_he', x->>'name_en'))), '[]') into v_ex_groups
  from jsonb_array_elements(p_existing->'groups') x;
  select coalesce(jsonb_object_agg(x->>'id', x), '{}') into v_group_by_id from jsonb_array_elements(v_ex_groups) x;
  select coalesce(jsonb_object_agg(z.gid, z.rows), '{}') into v_options_of
  from (select x->>'group_id' as gid, jsonb_agg(x || jsonb_build_object('keys', app.keys_of(x->>'name_he', x->>'name_en')) order by i) as rows
        from jsonb_array_elements(p_existing->'options') with ordinality t(x, i) group by 1) z;
  select coalesce(jsonb_object_agg(z.did, z.rows), '{}') into v_links_of
  from (select x->>'dish_id' as did, jsonb_agg(x order by i) as rows from jsonb_array_elements(p_existing->'dishGroups') with ordinality t(x, i) group by 1) z;
  select coalesce(jsonb_object_agg(s->>'key', format('sections[%s]', si - 1)), '{}'),
         coalesce(jsonb_object_agg(s->>'key', app.keys_of(s->'name'->>'he', s->'name'->>'en')), '{}')
  into v_section_path, v_sec_keys from jsonb_array_elements(v_secs) with ordinality t(s, si);
  select coalesce(jsonb_object_agg(d->>'key', format('sections[%s].dishes[%s]', si - 1, dj - 1)), '{}') into v_dish_path
  from jsonb_array_elements(v_secs) with ordinality a(s, si), jsonb_array_elements(s->'dishes') with ordinality b(d, dj);
  select coalesce(jsonb_object_agg(g.x->>'key', g.x), '{}'), coalesce(jsonb_object_agg(g.x->>'key', app.keys_of(g.x->'name'->>'he', g.x->'name'->>'en')), '{}')
  into v_group_of, v_group_keys from jsonb_array_elements(v_grps) g(x);

  -- a group whose kept options no longer reach its minimum (the draft's own options did), and that does not land on a
  -- venue's group by itself (rule 10's global match, whose limits are the venue's): asked once. One pass at a time:
  -- the groups answered skip are left out first, all at once, with what the cascade takes; the others are then asked
  -- unless that left them out; the next pass looks again, since a skip may make another group unreachable.
  select coalesce(jsonb_object_agg(g->>'key', true), '{}') into v_unreach_draft
  from jsonb_array_elements(v_grps) g, lateral (select app.draft_group_limits(g->>'selection', g->'min', g->'max', g->'options') as l) z
  where (z.l->>'min')::integer > (z.l->>'capacity')::integer;
  v_skipped := app.plan_cascade(v_grps, v_openers, v_skipped);
  loop
    v_pass := '[]';
    for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
      v_g := v_grps->v_gi; v_gk := v_g->>'key';
      continue when v_skipped ? v_gk or v_unreach_draft ? v_gk or v_asked_unreach ? v_gk;
      select coalesce(jsonb_agg(x order by i), '[]') into v_kept_opts from jsonb_array_elements(v_g->'options') with ordinality t(x, i) where not v_skipped ? (x->>'key');
      v_lim := app.draft_group_limits(v_g->>'selection', v_g->'min', v_g->'max', v_kept_opts);
      continue when (v_lim->>'min')::integer <= (v_lim->>'capacity')::integer;
      -- the owner's skip counts whatever the venue has (the same draft and answers leave the same groups out on a
      -- re-import that finds the group the first import made); otherwise only a group with no global match is asked
      continue when (p_decisions->'choices'->('limits_unreachable@' || v_gk)) is distinct from '"skip"'::jsonb
        and app.plan_global_match(v_group_keys->v_gk, v_g->'selection',
        (select coalesce(jsonb_agg(jsonb_build_object('key', x->>'key', 'keys', app.keys_of(x->'name'->>'he', x->'name'->>'en'))), '[]')
         from jsonb_array_elements(v_kept_opts) x), v_ex_groups, v_options_of) is not null;
      v_pass := v_pass || to_jsonb(v_gi);
    end loop;
    v_more := false;
    for v_gi in select (x #>> '{}')::integer from jsonb_array_elements(v_pass) with ordinality t(x, i) order by i loop
      v_gk := v_grps->v_gi->>'key';
      continue when (p_decisions->'choices'->('limits_unreachable@' || v_gk)) is distinct from '"skip"'::jsonb;
      v_asked_unreach := v_asked_unreach || jsonb_build_object(v_gk, true);
      select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
      from app.plan_ask(v_choice, v_errs, 'limits_unreachable', v_gk, format('groups[%s]', v_gi), 1, p_decisions) a;
      if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'group:' || v_gk)); end if;
      v_skipped := v_skipped || jsonb_build_object(v_gk, 'choice'); v_more := true;
    end loop;
    if v_more then v_skipped := app.plan_cascade(v_grps, v_openers, v_skipped); end if;
    for v_gi in select (x #>> '{}')::integer from jsonb_array_elements(v_pass) with ordinality t(x, i) order by i loop
      v_g := v_grps->v_gi; v_gk := v_g->>'key';
      continue when v_asked_unreach ? v_gk or v_skipped ? v_gk;
      v_lim := app.draft_group_limits(v_g->>'selection', v_g->'min', v_g->'max',
        (select coalesce(jsonb_agg(x order by i), '[]') from jsonb_array_elements(v_g->'options') with ordinality t(x, i) where not v_skipped ? (x->>'key')));
      continue when (v_lim->>'min')::integer <= (v_lim->>'capacity')::integer;
      v_asked_unreach := v_asked_unreach || jsonb_build_object(v_gk, true);
      select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
      from app.plan_ask(v_choice, v_errs, 'limits_unreachable', v_gk, format('groups[%s]', v_gi), 1, p_decisions) a;
      if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'group:' || v_gk)); end if;
    end loop;
    exit when not v_more;
  end loop;

  if (exists (select 1 from jsonb_array_elements(v_secs) x, jsonb_array_elements(x->'dishes') y where not app.js_null(y->'price') and not v_skipped ? (y->>'key'))
      or exists (select 1 from jsonb_array_elements(v_grps) x, jsonb_array_elements(x->'options') y
                 where not v_skipped ? (y->>'key') and not app.js_null(y->'price') and (y->>'price')::numeric > 0))
     and not app.js_truthy(p_decisions->'pricesConfirmed') then
    v_errs := v_errs || app.issue('prices_unconfirmed', 'pricesConfirmed');
  end if;

  -- ---- 3. sections by name: the merges first (draft order), then the other kept sections claim existing ones in one
  -- pass (best score, then the row's position, id, draft key), whatever the draft's order
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    continue when v_skipped ? (v_s->>'key') or v_choice->>('section_duplicate@' || (v_s->>'key')) is distinct from 'merge';
    select x->>'key' into v_first from jsonb_array_elements(v_secs) with ordinality t(x, i)
    where i - 1 < v_si and app.score_keys(v_sec_keys->(v_s->>'key'), v_sec_keys->(x->>'key')) > 0 order by i limit 1;
    v_merged := v_merged || jsonb_build_object(v_s->>'key', coalesce(v_merged->>v_first, v_first));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('n', x->>'key', 'r', r, 'score', app.score_keys(v_sec_keys->(x->>'key'), r->'keys'))), '[]') into v_pairs
  from jsonb_array_elements(v_secs) x, jsonb_array_elements(v_ex_sections) r
  where not v_skipped ? (x->>'key') and not v_merged ? (x->>'key') and app.score_keys(v_sec_keys->(x->>'key'), r->'keys') > 0;
  select a.map, a.taken into v_m, v_claimed from app.plan_assign(v_pairs, v_claimed) a;
  select v_target || coalesce(jsonb_object_agg(e.key, jsonb_build_object('id', e.value->>'id', 'ref', null)), '{}'),
         v_name_matched || coalesce(jsonb_object_agg(e.key, true), '{}')
  into v_target, v_name_matched from jsonb_each(v_m) e;
  -- a dish of a section merged into a section left out goes with it (the contracts leave such a dish without a target)
  select coalesce(jsonb_object_agg(d->>'key', true), '{}') into v_gone
  from jsonb_array_elements(v_secs) a(s), jsonb_array_elements(s->'dishes') b(d)
  where not v_skipped ? (d->>'key') and v_skipped ? coalesce(v_merged->>(s->>'key'), s->>'key');

  -- ---- 4-7. dishes: in their section, elsewhere in the family, renamed sections, another kind
  select coalesce(jsonb_agg(jsonb_build_object('key', d->>'key', 'keys', app.keys_of(d->'name'->>'he', d->'name'->>'en'),
                                               'root', coalesce(v_merged->>(s->>'key'), s->>'key'), 'family', app.kind_family(s->>'kind'),
                                               'pr', case when not app.js_null(d->'price') and v_choice->>('price_zero@' || (d->>'key')) = 'no_price'
                                                          then 'null'::jsonb else d->'price' end)
                            order by si, dj), '[]')
  into v_kept
  from jsonb_array_elements(v_secs) with ordinality a(s, si), jsonb_array_elements(s->'dishes') with ordinality b(d, dj)
  where not v_skipped ? (d->>'key') and not v_skipped ? coalesce(v_merged->>(s->>'key'), s->>'key');
  -- 4. in their section
  select coalesce(jsonb_agg(jsonb_build_object('n', n->>'key', 'r', r, 'score', app.score_keys(n->'keys', r->'keys'))), '[]') into v_pairs
  from jsonb_array_elements(v_kept) n
  join jsonb_array_elements(v_ex_dishes) r
    on ((n->'keys'->>'he' <> '' and r->'keys'->>'he' = n->'keys'->>'he') or (n->'keys'->>'en' <> '' and r->'keys'->>'en' = n->'keys'->>'en'))
  where app.score_keys(n->'keys', r->'keys') > 0 and (v_target->(n->>'root')->>'id') is not null and r->>'section_id' = v_target->(n->>'root')->>'id' and not v_taken ? (r->>'id');
  select a.map, a.taken into v_in_section, v_taken from app.plan_assign(v_pairs, v_taken) a;
  -- 5. elsewhere in the family; where the rest of a draft section went: each kept dish votes for the existing section
  -- of its step-4 match, or for every existing section holding a free candidate of its family; the one section with
  -- strictly the most votes, if any. Among equally good candidates, the rank: that section (0, else 2) plus the same
  -- price read (0, else 1; null equals null)
  with votes as (
    select n->>'root' as root, v_in_section->(n->>'key')->>'section_id' as sid
    from jsonb_array_elements(v_kept) n where v_in_section ? (n->>'key')
    union all
    select n->>'root', z.sid
    from jsonb_array_elements(v_kept) n
    cross join lateral (select distinct r->>'section_id' as sid from jsonb_array_elements(v_ex_dishes) r
                        where ((n->'keys'->>'he' <> '' and r->'keys'->>'he' = n->'keys'->>'he') or (n->'keys'->>'en' <> '' and r->'keys'->>'en' = n->'keys'->>'en'))
                          and app.score_keys(n->'keys', r->'keys') > 0
                          and app.kind_family(v_section_by_id->(r->>'section_id')->>'kind') = n->>'family' and not v_taken ? (r->>'id')) z
    where not v_in_section ? (n->>'key')
  ), counted as (
    select root, sid, count(*) as cnt from votes group by 1, 2
  ), ranked as (
    select root, sid, cnt, row_number() over (partition by root order by cnt desc, sid collate "C") as rn,
           lead(cnt) over (partition by root order by cnt desc, sid collate "C") as next_cnt
    from counted
  )
  select coalesce(jsonb_object_agg(root, sid), '{}') into v_affinity from ranked where rn = 1 and (next_cnt is null or cnt > next_cnt);
  select coalesce(jsonb_agg(jsonb_build_object('n', n->>'key', 'r', r, 'score', app.score_keys(n->'keys', r->'keys'),
                                               'rank', case when r->>'section_id' = v_affinity->>(n->>'root') then 0 else 2 end
                                                       + case when n->'pr' = r->'price' then 0 else 1 end)), '[]') into v_pairs
  from jsonb_array_elements(v_kept) n
  join jsonb_array_elements(v_ex_dishes) r
    on ((n->'keys'->>'he' <> '' and r->'keys'->>'he' = n->'keys'->>'he') or (n->'keys'->>'en' <> '' and r->'keys'->>'en' = n->'keys'->>'en'))
  where app.score_keys(n->'keys', r->'keys') > 0 and not v_in_section ? (n->>'key') and app.kind_family(v_section_by_id->(r->>'section_id')->>'kind') = n->>'family' and not v_taken ? (r->>'id');
  select a.map, a.taken into v_elsewhere, v_taken from app.plan_assign(v_pairs, v_taken) a;
  -- a tie: the dish has another free candidate, or its candidate another step-5 dish, at the same score and rank (only
  -- the position or the id decided); a tie never counts toward a renamed section
  select coalesce(jsonb_object_agg(z.n, true), '{}') into v_tie
  from (select p->>'n' as n, p->'r'->>'id' as rid,
               count(*) over (partition by p->>'n', p->>'score', p->>'rank') as per_dish,
               count(*) over (partition by p->'r'->>'id', p->>'score', p->>'rank') as per_row
        from jsonb_array_elements(v_pairs) p) z
  where (v_elsewhere->z.n->>'id') = z.rid and (z.per_dish > 1 or z.per_row > 1);
  -- 6. renamed sections: more than half of all a section's kept dishes (its merged sections' included) matched in step
  -- 5, not by a tie, in one existing section
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    continue when v_skipped ? (v_s->>'key') or v_merged ? (v_s->>'key') or v_name_matched ? (v_s->>'key');
    v_top := null;
    select z.sid into v_top
    from (select v_elsewhere->(n->>'key')->>'section_id' as sid, count(*) as cnt
          from jsonb_array_elements(v_kept) n where n->>'root' = v_s->>'key' and v_elsewhere ? (n->>'key') and not v_tie ? (n->>'key') group by 1) z
    where z.cnt * 2 > (select count(*) from jsonb_array_elements(v_kept) n where n->>'root' = v_s->>'key') limit 1;
    if v_top is not null and not v_claimed ? v_top then v_renamed := v_renamed || jsonb_build_array(jsonb_build_array(v_s->>'key', v_top)); end if;
  end loop;
  for v_t in select x from jsonb_array_elements(v_renamed) x loop
    -- two sections propose the same one: neither
    continue when (select count(*) from jsonb_array_elements(v_renamed) y where y->>1 = v_t->>1) > 1;
    select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
    from app.plan_ask(v_choice, v_errs, 'section_renamed', v_t->>0, v_section_path->>(v_t->>0), 1, p_decisions) a;
    if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'section:' || (v_t->>0))); end if;
    if v_c in ('same_section', 'rename') then
      v_target := v_target || jsonb_build_object(v_t->>0, jsonb_build_object('id', v_t->>1, 'ref', null));
      v_claimed := v_claimed || jsonb_build_object(v_t->>1, true);
    end if;
  end loop;
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    if not v_skipped ? (v_s->>'key') and not v_merged ? (v_s->>'key') and not v_target ? (v_s->>'key') then
      v_target := v_target || jsonb_build_object(v_s->>'key', jsonb_build_object('id', null, 'ref', v_s->>'key'));
    end if;
  end loop;
  -- 7. another kind
  select coalesce(jsonb_agg(jsonb_build_object('n', n->>'key', 'r', r, 'score', app.score_keys(n->'keys', r->'keys'))), '[]') into v_pairs
  from jsonb_array_elements(v_kept) n
  join jsonb_array_elements(v_ex_dishes) r
    on ((n->'keys'->>'he' <> '' and r->'keys'->>'he' = n->'keys'->>'he') or (n->'keys'->>'en' <> '' and r->'keys'->>'en' = n->'keys'->>'en'))
  where app.score_keys(n->'keys', r->'keys') > 0 and not v_in_section ? (n->>'key') and not v_elsewhere ? (n->>'key')
    and app.kind_family(v_section_by_id->(r->>'section_id')->>'kind') is distinct from n->>'family' and not v_taken ? (r->>'id');
  select a.map, a.taken into v_other_kind, v_taken from app.plan_assign(v_pairs, v_taken) a;

  -- ---- 8. dish outcomes: the venue's dish each kept dish lands on (asking dish_elsewhere / dish_other_kind)
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si; v_root := coalesce(v_merged->>(v_s->>'key'), v_s->>'key');
    continue when v_skipped ? v_root;
    v_home := v_target->v_root;
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj; v_key := v_d->>'key';
      continue when v_skipped ? v_key;
      v_m := v_in_section->v_key;
      v_near := v_elsewhere->v_key;
      if v_m is null and v_near is not null then
        if (v_home->>'id') is not null and v_home->>'id' = v_near->>'section_id' then v_m := v_near;
        else
          select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
          from app.plan_ask(v_choice, v_errs, 'dish_elsewhere', v_key, v_dish_path->>v_key, 1, p_decisions) a;
          if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'dish:' || v_key)); end if;
          if v_c = 'same_dish' then v_m := v_near; end if;
        end if;
      end if;
      v_far := v_other_kind->v_key;
      if v_m is null and v_near is null and v_far is not null then
        select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
        from app.plan_ask(v_choice, v_errs, 'dish_other_kind', v_key, v_dish_path->>v_key, 1, p_decisions) a;
        if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'dish:' || v_key)); end if;
        if v_c = 'same_dish' then v_m := v_far; end if;
      end if;
      if v_m is not null then v_match_of := v_match_of || jsonb_build_object(v_key, v_m); end if;
    end loop;
  end loop;
  -- prices read (after price_zero's no_price) that differ from the venue's: one question per draft section
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    select count(*) into v_n from jsonb_array_elements(v_s->'dishes') d
    where v_match_of ? (d->>'key') and not app.js_null(d->'price') and v_choice->>('price_zero@' || (d->>'key')) is distinct from 'no_price'
      and d->'price' is distinct from v_match_of->(d->>'key')->'price';
    if v_n > 0 then
      select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
      from app.plan_ask(v_choice, v_errs, 'price_differs', v_s->>'key', format('sections[%s]', v_si), v_n, p_decisions) a;
      if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'section:' || (v_s->>'key'))); end if;
      v_section_price := v_section_price || jsonb_build_object(v_s->>'key', v_c);
    end if;
  end loop;
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si; v_root := coalesce(v_merged->>(v_s->>'key'), v_s->>'key');
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj; v_key := v_d->>'key';
      v_reason := coalesce(v_skipped->>v_key, case when v_skipped ? v_root then 'parent_skipped' end);
      if v_reason is not null then v_dish_steps := array_append(v_dish_steps, app.plan_skip('dish', v_key, v_reason)); continue; end if;
      v_home := v_target->v_root;
      v_m := v_match_of->v_key;
      v_price := case when not app.js_null(v_d->'price') and v_choice->>('price_zero@' || v_key) = 'no_price' then 'null'::jsonb else v_d->'price' end;
      if v_m is not null then
        v_dish_target := v_dish_target || jsonb_build_object(v_key, jsonb_build_object('id', v_m->>'id', 'ref', null));
        v_set := app.plan_fill_blank(v_m, jsonb_build_object('name_he', v_d->'name'->'he', 'name_en', v_d->'name'->'en', 'desc_he', v_d->'desc'->'he',
          'desc_en', v_d->'desc'->'en', 'price_note_he', v_d->'priceNote'->'he', 'price_note_en', v_d->'priceNote'->'en',
          'allergens_he', v_d->'allergens'->'he', 'allergens_en', v_d->'allergens'->'en'));
        if not app.js_null(v_price) and v_price is distinct from v_m->'price' then
          select o.c, o.errs into v_c, v_errs from app.plan_override(v_errs, p_decisions, 'price_differs', v_key, v_section_price->>(v_s->>'key')) o;
          if v_c = 'take_new' then v_set := v_set || jsonb_build_object('price', v_price); end if;
        end if;
        if exists (select 1 from jsonb_array_elements(v_d->'tags') x where not coalesce(v_m->'tags', '[]') @> jsonb_build_array(x)) then
          v_set := v_set || jsonb_build_object('tags', coalesce(v_m->'tags', '[]') || (select jsonb_agg(x order by i) from jsonb_array_elements(v_d->'tags') with ordinality t(x, i)
                                                                                  where not coalesce(v_m->'tags', '[]') @> jsonb_build_array(x)));
        end if;
        -- an illustration only for a dish with no picture at all (whatever its state) and no illustration
        if app.js_null(v_m->'asset_id') and app.js_null(v_m->'stock_id') and not app.js_null(v_d->'illustration')
           and not exists (select 1 from jsonb_array_elements(coalesce(p_existing->'assets', '[]')) x where x->>'dish_id' = v_m->>'id') then
          v_set := v_set || jsonb_build_object('stock_id', v_d->'illustration');
        end if;
        v_dish_steps := array_append(v_dish_steps, app.plan_change('dish', v_key, v_m->>'id', v_set));
        continue;
      end if;
      v_dish_target := v_dish_target || jsonb_build_object(v_key, jsonb_build_object('id', null, 'ref', v_key));
      v_tk := coalesce(v_home->>'id', 'ref:' || (v_home->>'ref'));
      if not v_next_dish_pos ? v_tk then
        v_next_dish_pos := v_next_dish_pos || jsonb_build_object(v_tk, case when (v_home->>'id') is not null
          then app.plan_next_position((select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(p_existing->'dishes') x where x->>'section_id' = v_home->>'id'))
          else 0 end);
      end if;
      v_pos := (v_next_dish_pos->>v_tk)::integer;
      v_next_dish_pos := v_next_dish_pos || jsonb_build_object(v_tk, v_pos + 1);
      if (v_home->>'ref') is not null then v_created_in_section := v_created_in_section || jsonb_build_object(v_home->>'ref', true); end if;
      v_set := jsonb_build_object('position', v_pos, 'name_he', app.strip_blank(v_d->'name'->>'he'), 'name_en', app.strip_blank(v_d->'name'->>'en'),
        'desc_he', app.strip_blank(v_d->'desc'->>'he'), 'desc_en', app.strip_blank(v_d->'desc'->>'en'),
        'price', case when v_choice->>('price_zero@' || v_key) = 'no_price' then 'null'::jsonb else v_d->'price' end,
        'price_note_he', app.strip_blank(v_d->'priceNote'->>'he'), 'price_note_en', app.strip_blank(v_d->'priceNote'->>'en'),
        'tags', v_d->'tags', 'allergens_he', app.strip_blank(v_d->'allergens'->>'he'), 'allergens_en', app.strip_blank(v_d->'allergens'->>'en'),
        'stock_id', v_d->'illustration');
      if (v_home->>'id') is not null then v_set := v_set || jsonb_build_object('section_id', v_home->>'id'); end if;
      v_dish_steps := array_append(v_dish_steps, app.plan_create('dish', v_key, v_set,
        case when (v_home->>'ref') is not null then jsonb_build_object('section_id', v_home->>'ref') else '{}'::jsonb end));
    end loop;
  end loop;

  -- ---- 9. sections' steps
  v_section_position := app.plan_next_position(p_existing->'sections');
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si; v_key := v_s->>'key';
    if v_skipped ? v_key then v_section_steps := array_append(v_section_steps, app.plan_skip('section', v_key, v_skipped->>v_key)); continue; end if;
    if v_merged ? v_key then v_section_steps := array_append(v_section_steps, app.plan_skip('section', v_key, 'merged')); continue; end if;
    v_t := v_target->v_key;
    if (v_t->>'id') is not null then
      v_m := v_section_by_id->(v_t->>'id');
      v_set := case when v_choice->>('section_renamed@' || v_key) = 'rename' then app.plan_replace_names(v_m, v_s->'name')
                    else app.plan_fill_blank(v_m, jsonb_build_object('name_he', v_s->'name'->'he', 'name_en', v_s->'name'->'en')) end;
      v_section_steps := array_append(v_section_steps, app.plan_change('section', v_key, v_t->>'id', v_set));
      continue;
    end if;
    if not v_created_in_section ? v_key then v_section_steps := array_append(v_section_steps, app.plan_skip('section', v_key, 'empty')); continue; end if;
    v_section_steps := array_append(v_section_steps, app.plan_create('section', v_key, jsonb_build_object('position', v_section_position,
      'name_he', app.strip_blank(v_s->'name'->>'he'), 'name_en', app.strip_blank(v_s->'name'->>'en'), 'kind', v_s->'kind', 'room', v_s->'room'), '{}'));
    v_section_position := v_section_position + 1;
  end loop;

  -- ---- 10. groups: global matches, the dishes' own groups, targets
  select coalesce(jsonb_object_agg(g.x->>'key', (select coalesce(jsonb_agg(jsonb_build_object('key', o.y->>'key',
           'keys', app.keys_of(o.y->'name'->>'he', o.y->'name'->>'en')) order by o.j), '[]')
           from jsonb_array_elements(g.x->'options') with ordinality o(y, j) where not v_skipped ? (o.y->>'key'))), '{}')
  into v_option_nodes from jsonb_array_elements(v_grps) g(x);
  -- a group's global match: the same selection, a name match, options covering its kept ones; the best score, then the
  -- fewest options, then the smaller id
  for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
    v_g := v_grps->v_gi; v_gk := v_g->>'key';
    continue when v_skipped ? v_gk;
    v_k := v_group_keys->v_gk;
    for v_y in select x from jsonb_array_elements(v_ex_groups) x
               where ((v_k->>'he' <> '' and x->'keys'->>'he' = v_k->>'he') or (v_k->>'en' <> '' and x->'keys'->>'en' = v_k->>'en'))
                 and app.score_keys(v_k, x->'keys') > 0
                 and x->'selection' = v_g->'selection'
               order by app.score_keys(v_k, x->'keys') desc, jsonb_array_length(coalesce(v_options_of->(x->>'id'), '[]')), (x->>'id') collate "C" loop
      if not v_cover ? (v_gk || '|' || (v_y->>'id')) then v_cover := v_cover || jsonb_build_object(v_gk || '|' || (v_y->>'id'), app.plan_cover(v_option_nodes->v_gk, v_options_of->(v_y->>'id'))); end if;
      if (select count(*) from jsonb_object_keys(v_cover->(v_gk || '|' || (v_y->>'id')))) = jsonb_array_length(v_option_nodes->v_gk) then
        v_global_match := v_global_match || jsonb_build_object(v_gk, v_y->>'id');
        exit;
      end if;
    end loop;
  end loop;
  -- each kept link of a matched dish whose dish already has a group of that selection and name stays on it
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj;
      for v_ak in 0 .. jsonb_array_length(v_d->'groups') - 1 loop
        v_a := v_d->'groups'->v_ak;
        v_lk := (v_d->>'key') || '>' || (v_a->>'group');
        continue when v_skipped ? (v_d->>'key') or v_gone ? (v_d->>'key') or v_skipped ? (v_a->>'group') or v_asked ? v_lk;
        v_g := v_group_of->(v_a->>'group'); v_gk := v_g->>'key';
        v_dt := v_dish_target->(v_d->>'key');
        v_k := v_group_keys->v_gk;
        v_own := null;
        if (v_dt->>'id') is not null then
          select jsonb_build_object('l', l, 'y', v_group_by_id->(l->>'group_id')) into v_own
          from jsonb_array_elements(coalesce(v_links_of->(v_dt->>'id'), '[]')) l
          where v_group_by_id ? (l->>'group_id') and v_group_by_id->(l->>'group_id')->'selection' = v_g->'selection'
            and app.score_keys(v_k, v_group_by_id->(l->>'group_id')->'keys') > 0
          order by app.score_keys(v_k, v_group_by_id->(l->>'group_id')->'keys') desc, (l->>'position')::numeric, (l->>'id') collate "C" limit 1;
        end if;
        if v_own is not null then
          v_c := null;
          -- a dish's link row that an earlier link of the same dish already stays on: asked nothing (merged in rule 12)
          v_claimed_row := v_claimed_rows ? ((v_d->>'key') || '|' || (v_own->'l'->>'id'));
          v_claimed_rows := v_claimed_rows || jsonb_build_object((v_d->>'key') || '|' || (v_own->'l'->>'id'), true);
          if not v_claimed_row and not v_cover ? (v_gk || '|' || (v_own->'y'->>'id')) then v_cover := v_cover || jsonb_build_object(v_gk || '|' || (v_own->'y'->>'id'), app.plan_cover(v_option_nodes->v_gk, v_options_of->(v_own->'y'->>'id'))); end if;
          if not v_claimed_row and (select count(*) from jsonb_object_keys(v_cover->(v_gk || '|' || (v_own->'y'->>'id')))) <> jsonb_array_length(v_option_nodes->v_gk) then
            select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
            from app.plan_ask(v_choice, v_errs, 'group_changed', v_lk, format('%s.groups[%s]', v_dish_path->>(v_d->>'key'), v_ak), 1, p_decisions) a;
            if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'dish_group:' || v_lk)); end if;
          end if;
          v_link_list := array_append(v_link_list, jsonb_build_object('lk', v_lk, 'res', jsonb_build_object('kind', 'own', 'link', v_own->'l', 'groupId', v_own->'y'->>'id', 'answer', v_c)));
          if v_c = 'new_group' then
            v_forced_new := v_forced_new || jsonb_build_object(v_gk, true); v_needs_global := v_needs_global || jsonb_build_object(v_gk, true);
          end if;
        else
          v_link_list := array_append(v_link_list, jsonb_build_object('lk', v_lk, 'res', jsonb_build_object('kind', 'global')));
          v_needs_global := v_needs_global || jsonb_build_object(v_gk, true);
        end if;
      end loop;
    end loop;
  end loop;
  select coalesce(jsonb_object_agg(x->>'lk', x->'res'), '{}') into v_link_res from unnest(v_link_list) x;
  -- a group opened by a created option needs its global target too (until nothing changes; one nesting level)
  loop
    v_changed := false;
    for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
      v_g := v_grps->v_gi;
      continue when not v_needs_global ? (v_g->>'key') or (not v_forced_new ? (v_g->>'key') and v_global_match ? (v_g->>'key'));
      for v_o in select x from jsonb_array_elements(v_g->'options') x where not v_skipped ? (x->>'key') loop
        v_nested := case when not app.js_null(v_o->'opens') and v_choice->>('nesting_too_deep@' || (v_o->>'key')) is distinct from 'unlink' then v_o->>'opens' end;
        if v_nested is not null and not v_skipped ? v_nested and not v_needs_global ? v_nested then
          v_needs_global := v_needs_global || jsonb_build_object(v_nested, true); v_changed := true;
        end if;
      end loop;
    end loop;
    exit when not v_changed;
  end loop;
  -- how the kept links of each draft group resolved, in draft order
  select coalesce(jsonb_object_agg(z.grp, z.list), '{}') into v_res_by_group
  from (select a.y->>'group' as grp, jsonb_agg(v_link_res->((d.x->>'key') || '>' || (a.y->>'group')) order by s.i, d.j, a.k) as list
        from jsonb_array_elements(v_secs) with ordinality s(x, i), jsonb_array_elements(s.x->'dishes') with ordinality d(x, j),
             jsonb_array_elements(d.x->'groups') with ordinality a(y, k)
        where v_link_res ? ((d.x->>'key') || '>' || (a.y->>'group'))
        group by 1) z;
  -- an option the venue already has keeps the group it opens: that group is a target of the draft's nested group
  for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
    v_g := v_grps->v_gi; v_gk := v_g->>'key';
    continue when v_skipped ? v_gk;
    v_targets := app.plan_targets(
      case when v_needs_global ? v_gk then
        case when not v_forced_new ? v_gk and v_global_match ? v_gk then jsonb_build_object('id', v_global_match->>v_gk, 'ref', null)
             else jsonb_build_object('id', null, 'ref', v_gk) end end,
      array(select x->>'groupId' from jsonb_array_elements(coalesce(v_res_by_group->v_gk, '[]')) x
            where x->>'kind' = 'own' and (x->>'answer') is distinct from 'new_group'));
    for v_t in select x from jsonb_array_elements(v_targets) x where (x->>'id') is not null loop
      if not v_cover ? (v_gk || '|' || (v_t->>'id')) then v_cover := v_cover || jsonb_build_object(v_gk || '|' || (v_t->>'id'), app.plan_cover(v_option_nodes->v_gk, v_options_of->(v_t->>'id'))); end if;
      v_cov := v_cover->(v_gk || '|' || (v_t->>'id'));
      for v_oj in 0 .. jsonb_array_length(v_g->'options') - 1 loop
        v_o := v_g->'options'->v_oj;
        v_nested := case when not app.js_null(v_o->'opens') and v_choice->>('nesting_too_deep@' || (v_o->>'key')) is distinct from 'unlink' then v_o->>'opens' end;
        v_m := v_cov->(v_o->>'key');
        continue when v_nested is null or v_skipped ? v_nested or v_skipped ? (v_o->>'key') or v_m is null;
        v_ng := v_group_of->v_nested;
        v_ok := case when v_t->>'id' = v_targets->0->>'id' then v_o->>'key' else (v_o->>'key') || '@' || (v_t->>'id') end;
        v_ek := v_ok || '>' || v_nested;
        v_path := format('groups[%s].options[%s]', v_gi, v_oj);
        v_y := case when not app.js_null(v_m->'opens_group_id') and v_m ? 'opens_group_id' then v_group_by_id->(v_m->>'opens_group_id') end;
        v_c := null;
        if v_y is not null and v_y->'selection' = v_ng->'selection' and app.score_keys(v_group_keys->v_nested, v_y->'keys') > 0 then
          if not v_cover ? (v_nested || '|' || (v_y->>'id')) then v_cover := v_cover || jsonb_build_object(v_nested || '|' || (v_y->>'id'), app.plan_cover(v_option_nodes->v_nested, v_options_of->(v_y->>'id'))); end if;
          if (select count(*) from jsonb_object_keys(v_cover->(v_nested || '|' || (v_y->>'id')))) <> jsonb_array_length(v_option_nodes->v_nested) then
            select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec from app.plan_ask(v_choice, v_errs, 'group_changed', v_ek, v_path, 1, p_decisions) a;
            if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'option:' || v_ok)); end if;
          end if;
          if v_c is distinct from 'new_group' then v_opener_own := v_opener_own || jsonb_build_object(v_nested, coalesce(v_opener_own->v_nested, '[]') || jsonb_build_array(v_y->>'id')); end if;
          if v_c = 'add_options' then v_opener_add := v_opener_add || jsonb_build_object(v_nested, coalesce(v_opener_add->v_nested, '[]') || jsonb_build_array(v_y->>'id')); end if;
        else
          select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec from app.plan_ask(v_choice, v_errs, 'opens_changed', v_ek, v_path, 1, p_decisions) a;
          if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'option:' || v_ok)); end if;
        end if;
        -- an option that opens a group is taken once (the table's check), and the plan never lowers the venue's quantity
        -- (an update takes nothing away): new_group on an option guests may take more than once is refused, and nothing
        -- moves
        if v_c = 'new_group' and (v_m->'max_qty') is distinct from '1'::jsonb then
          v_errs := v_errs || app.issue('opener_qty', v_ek, 'opens_changed');
          continue;
        end if;
        if v_c = 'new_group' then
          v_forced_new := v_forced_new || jsonb_build_object(v_nested, true);
          v_needs_global := v_needs_global || jsonb_build_object(v_nested, true);
          v_opener_move := v_opener_move || jsonb_build_object(v_ok, v_nested);
          if exists (select 1 from jsonb_array_elements(p_existing->'options') x where x->>'opens_group_id' = v_t->>'id') then
            v_errs := v_errs || app.issue('nesting_too_deep', v_o->>'key');
          end if;
        end if;
      end loop;
    end loop;
  end loop;

  -- a dish never gets two links to one group, nor to two groups of one selection whose names match (score_keys; the
  -- venue's names for its group, the draft's for one this plan creates): in link order, a kept link that lands where an
  -- earlier link of the same dish landed, or on a group whose name matches that one's, is merged
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj;
      v_landed := '[]';
      for v_ak in 0 .. jsonb_array_length(v_d->'groups') - 1 loop
        v_a := v_d->'groups'->v_ak;
        v_lk := (v_d->>'key') || '>' || (v_a->>'group');
        continue when v_skipped ? (v_d->>'key') or v_gone ? (v_d->>'key') or v_skipped ? (v_a->>'group') or v_asked ? v_lk;
        v_res := v_link_res->v_lk;
        v_gt := case when v_res->>'kind' = 'own' then
                       case when v_res->>'answer' = 'new_group' then jsonb_build_object('id', null, 'ref', v_a->>'group')
                            else jsonb_build_object('id', v_res->>'groupId', 'ref', null) end
                     when not v_forced_new ? (v_a->>'group') and v_global_match ? (v_a->>'group') then jsonb_build_object('id', v_global_match->>(v_a->>'group'), 'ref', null)
                     else jsonb_build_object('id', null, 'ref', v_a->>'group') end;
        v_at := coalesce(v_gt->>'id', 'ref:' || (v_gt->>'ref'));
        v_lkeys := case when (v_gt->>'id') is not null then v_group_by_id->(v_gt->>'id')->'keys' else v_group_keys->(v_a->>'group') end;
        v_sel := v_group_of->(v_a->>'group')->'selection';
        if exists (select 1 from jsonb_array_elements(v_landed) l where l->>'at' = v_at or (l->'sel' = v_sel and app.score_keys(l->'keys', v_lkeys) > 0)) then
          v_merged_links := v_merged_links || jsonb_build_object(v_lk, true);
        else
          v_landed := v_landed || jsonb_build_array(jsonb_build_object('at', v_at, 'keys', v_lkeys, 'sel', v_sel));
          if (v_gt->>'id') is null then v_created_used := v_created_used || jsonb_build_object(v_a->>'group', true); end if;
        end if;
      end loop;
    end loop;
  end loop;
  -- the group this plan would create for a draft group is created only when something uses it: a kept link that is not
  -- merged (above), a venue's option moved to open it, or an option created in a group that is itself created (until
  -- nothing changes); with its links all merged and no opener, the draft group loses that target (unused with no other)
  select v_created_used || coalesce(jsonb_object_agg(x.value #>> '{}', true), '{}') into v_created_used from jsonb_each(v_opener_move) x;
  loop
    v_changed := false;
    for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
      v_g := v_grps->v_gi;
      continue when not v_created_used ? (v_g->>'key');
      for v_o in select x from jsonb_array_elements(v_g->'options') x where not v_skipped ? (x->>'key') loop
        v_nested := case when not app.js_null(v_o->'opens') and v_choice->>('nesting_too_deep@' || (v_o->>'key')) is distinct from 'unlink' then v_o->>'opens' end;
        if v_nested is not null and not v_skipped ? v_nested and (v_forced_new ? v_nested or not v_global_match ? v_nested)
           and not v_created_used ? v_nested then
          v_created_used := v_created_used || jsonb_build_object(v_nested, true); v_changed := true;
        end if;
      end loop;
    end loop;
    exit when not v_changed;
  end loop;

  -- ---- 10-11. the groups' steps, then their options, per target
  for v_gi in 0 .. jsonb_array_length(v_grps) - 1 loop
    v_g := v_grps->v_gi; v_key := v_g->>'key'; v_path := format('groups[%s]', v_gi);
    if v_skipped ? v_key then
      v_group_steps := array_append(v_group_steps, app.plan_skip('group', v_key, v_skipped->>v_key));
      select v_option_steps || coalesce(array_agg(app.plan_skip('option', x->>'key', coalesce(v_skipped->>(x->>'key'), 'parent_skipped')) order by i), '{}')
      into v_option_steps from jsonb_array_elements(v_g->'options') with ordinality t(x, i);
      continue;
    end if;
    v_targets := app.plan_targets(
      case when v_needs_global ? v_key then
        case when not v_forced_new ? v_key and v_global_match ? v_key then jsonb_build_object('id', v_global_match->>v_key, 'ref', null)
             when v_created_used ? v_key then jsonb_build_object('id', null, 'ref', v_key) end end,
      array(select x #>> '{}' from jsonb_array_elements(coalesce(v_opener_own->v_key, '[]')) x
            union all
            select x->>'groupId' from jsonb_array_elements(coalesce(v_res_by_group->v_key, '[]')) x
            where x->>'kind' = 'own' and (x->>'answer') is distinct from 'new_group'));
    if jsonb_array_length(v_targets) = 0 then
      v_group_steps := array_append(v_group_steps, app.plan_skip('group', v_key, 'unused'));
      select v_option_steps || coalesce(array_agg(app.plan_skip('option', x->>'key', coalesce(v_skipped->>(x->>'key'), 'unused')) order by i), '{}')
      into v_option_steps from jsonb_array_elements(v_g->'options') with ordinality t(x, i);
      continue;
    end if;
    v_primary := v_targets->0;
    select coalesce(jsonb_agg(x order by i), '[]') into v_kept_opts from jsonb_array_elements(v_g->'options') with ordinality t(x, i) where not v_skipped ? (x->>'key');
    for v_ti in 0 .. jsonb_array_length(v_targets) - 1 loop
      v_t := v_targets->v_ti;
      v_tk := case when (v_t->>'id') is null or v_t->>'id' = v_primary->>'id' then v_key else v_key || '@' || (v_t->>'id') end;
      if (v_t->>'id') is null then
        -- created: limits from the kept options; each limit the source left unstated is a guess, and yields to what the
        -- group's new links state (kept, not merged, landing on the created group): a smaller min; for a multiple
        -- choice, a larger max
        v_lim := app.draft_group_limits(v_g->>'selection', v_g->'min', v_g->'max', v_kept_opts);
        v_mn := (v_lim->>'min')::integer; v_mx := (v_lim->>'max')::integer;
        for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
          v_s := v_secs->v_si;
          for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
            v_d := v_s->'dishes'->v_dj;
            for v_a in select x from jsonb_array_elements(v_d->'groups') x where x->>'group' = v_key loop
              v_lk := (v_d->>'key') || '>' || v_key;
              v_res := v_link_res->v_lk;
              continue when v_res is null or v_skipped ? (v_d->>'key') or v_gone ? (v_d->>'key') or v_asked ? v_lk or v_merged_links ? v_lk;
              v_new := case when v_res->>'kind' = 'own' then v_res->>'answer' = 'new_group' else v_forced_new ? v_key or not v_global_match ? v_key end;
              continue when not v_new;
              if app.js_null(v_g->'min') and not app.js_null(v_a->'min') then v_mn := least(v_mn, (v_a->>'min')::integer); end if;
              if app.js_null(v_g->'max') and v_g->>'selection' = 'multiple' and not app.js_null(v_a->'max') then v_mx := greatest(v_mx, (v_a->>'max')::integer); end if;
            end loop;
          end loop;
        end loop;
        -- never above the kept capacity: lowered to it, as clamp (the answer of a kept group to limits_unreachable)
        if v_mn > (v_lim->>'capacity')::integer then v_mn := (v_lim->>'capacity')::integer; end if;
        v_group_steps := array_append(v_group_steps, app.plan_create('group', v_tk, jsonb_build_object(
          'label', coalesce(nullif(app.strip_blank(v_g->'name'->>'en'), ''), app.strip_blank(v_g->'name'->>'he')),
          'name_he', app.strip_blank(v_g->'name'->>'he'), 'name_en', app.strip_blank(v_g->'name'->>'en'), 'selection', v_g->'selection',
          'min_units', v_mn, 'max_units', v_mx, 'limits_confirmed', v_lim->'stated'), '{}'));
        continue;
      end if;
      v_group_steps := array_append(v_group_steps, app.plan_change('group', v_tk, v_t->>'id',
        app.plan_fill_blank(v_group_by_id->(v_t->>'id'), jsonb_build_object('name_he', v_g->'name'->'he', 'name_en', v_g->'name'->'en'))));
    end loop;
    -- ---- 11. options, per target; prices that differ: one question per draft group, for its options on every target
    v_differing := 0;
    for v_t in select x from jsonb_array_elements(v_targets) x where (x->>'id') is not null loop
      if not v_cover ? (v_key || '|' || (v_t->>'id')) then v_cover := v_cover || jsonb_build_object(v_key || '|' || (v_t->>'id'), app.plan_cover(v_option_nodes->v_key, v_options_of->(v_t->>'id'))); end if;
      v_cov := v_cover->(v_key || '|' || (v_t->>'id'));
      select v_differing + count(*) into v_differing from jsonb_array_elements(v_kept_opts) o
      where v_cov ? (o->>'key') and not app.js_null(o->'price') and o->'price' is distinct from v_cov->(o->>'key')->'price';
    end loop;
    v_group_price := null;
    if v_differing > 0 then
      select a.c, a.choice, a.errs, a.rec into v_c, v_choice, v_errs, v_rec
      from app.plan_ask(v_choice, v_errs, 'price_differs', v_key, v_path, v_differing, p_decisions) a;
      if v_rec is not null then v_plan_asked := v_plan_asked || jsonb_build_array(jsonb_build_object('e', v_rec, 'step', 'group:' || v_key)); end if;
      v_group_price := v_c;
    end if;
    for v_ti in 0 .. jsonb_array_length(v_targets) - 1 loop
      v_t := v_targets->v_ti;
      v_pos := case when (v_t->>'id') is null then 0 else app.plan_next_position(coalesce(v_options_of->(v_t->>'id'), '[]')) end;
      v_adding := (v_t->>'id') is not null and (
        exists (select 1 from jsonb_array_elements(coalesce(v_res_by_group->v_key, '[]')) x
                where x->>'kind' = 'own' and x->>'groupId' = v_t->>'id' and x->>'answer' = 'add_options')
        or coalesce(v_opener_add->v_key, '[]') @> jsonb_build_array(v_t->>'id'));
      v_cov := case when (v_t->>'id') is null then '{}'::jsonb else v_cover->(v_key || '|' || (v_t->>'id')) end;
      for v_oj in 0 .. jsonb_array_length(v_g->'options') - 1 loop
        v_o := v_g->'options'->v_oj;
        v_ok := case when (v_t->>'id') is null or v_t->>'id' = v_primary->>'id' then v_o->>'key' else (v_o->>'key') || '@' || (v_t->>'id') end;
        if v_skipped ? (v_o->>'key') then
          if v_ti = 0 then v_option_steps := array_append(v_option_steps, app.plan_skip('option', v_o->>'key', v_skipped->>(v_o->>'key'))); end if;
          continue;
        end if;
        v_m := v_cov->(v_o->>'key');
        if v_m is not null then
          v_set := app.plan_fill_blank(v_m, jsonb_build_object('name_he', v_o->'name'->'he', 'name_en', v_o->'name'->'en'));
          if not app.js_null(v_o->'price') and v_o->'price' is distinct from v_m->'price' then
            select o.c, o.errs into v_c, v_errs from app.plan_override(v_errs, p_decisions, 'price_differs', v_o->>'key', v_group_price) o;
            if v_c = 'take_new' then v_set := v_set || jsonb_build_object('price', v_o->'price'); end if;
          end if;
          if v_opener_move ? v_ok then
            v_option_steps := array_append(v_option_steps, jsonb_build_object('kind', 'option', 'key', v_ok, 'op', 'update', 'id', v_m->>'id', 'set', v_set,
              'refs', jsonb_build_object('opens_group_id', v_opener_move->>v_ok), 'reason', null));
          else
            v_option_steps := array_append(v_option_steps, app.plan_change('option', v_ok, v_m->>'id', v_set));
          end if;
          continue;
        end if;
        if (v_t->>'id') is not null and not v_adding then v_option_steps := array_append(v_option_steps, app.plan_skip('option', v_ok, 'choice')); continue; end if;
        v_set := jsonb_build_object('position', v_pos, 'name_he', app.strip_blank(v_o->'name'->>'he'), 'name_en', app.strip_blank(v_o->'name'->>'en'),
          'price', coalesce(nullif(v_o->'price', 'null'::jsonb), '0'::jsonb), 'max_qty', v_o->'maxQty',
          'is_default', (v_t->>'id') is null and v_o->'default' = 'true'::jsonb);
        v_pos := v_pos + 1;
        v_refs := '{}';
        if (v_t->>'id') is null then v_refs := jsonb_build_object('group_id', v_key); else v_set := v_set || jsonb_build_object('group_id', v_t->>'id'); end if;
        v_nested := case when (v_t->>'id') is null and not app.js_null(v_o->'opens')
                              and v_choice->>('nesting_too_deep@' || (v_o->>'key')) is distinct from 'unlink' then v_o->>'opens' end;
        v_ot := case when v_nested is not null and not v_skipped ? v_nested then
                  case when not v_forced_new ? v_nested and v_global_match ? v_nested then jsonb_build_object('id', v_global_match->>v_nested, 'ref', null)
                       else jsonb_build_object('id', null, 'ref', v_nested) end end;
        if (v_ot->>'id') is not null then
          if exists (select 1 from jsonb_array_elements(coalesce(v_options_of->(v_ot->>'id'), '[]')) x where not app.js_null(x->'opens_group_id') and x ? 'opens_group_id') then
            v_errs := v_errs || app.issue('nesting_too_deep', v_o->>'key');
          end if;
          v_set := v_set || jsonb_build_object('opens_group_id', v_ot->>'id');
        elsif (v_ot->>'ref') is not null then v_refs := v_refs || jsonb_build_object('opens_group_id', v_ot->>'ref');
        else v_set := v_set || jsonb_build_object('opens_group_id', null);
        end if;
        v_option_steps := array_append(v_option_steps, app.plan_create('option', v_ok, v_set, v_refs));
      end loop;
    end loop;
  end loop;

  -- ---- 12. links and photos
  -- each group's capacity once the plan is applied (by target key): its options' max_qty, the venue's and the ones this
  -- plan creates in it
  select coalesce(jsonb_object_agg(u.k, u.n), '{}') into v_capacity
  from (select z.k, sum(z.q)::integer as n
        from (select x->>'group_id' as k, (x->>'max_qty')::integer as q from jsonb_array_elements(p_existing->'options') x
              union all
              select coalesce(x->'set'->>'group_id', 'ref:' || (x->'refs'->>'group_id')), (x->'set'->>'max_qty')::integer
              from unnest(v_option_steps) x where x->>'kind' = 'option' and x->>'op' = 'create') z
        group by z.k) u;
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj;
      for v_ak in 0 .. jsonb_array_length(v_d->'groups') - 1 loop
        v_a := v_d->'groups'->v_ak;
        v_lk := (v_d->>'key') || '>' || (v_a->>'group');
        v_reason := case when v_skipped ? (v_d->>'key') or v_gone ? (v_d->>'key') or v_skipped ? (v_a->>'group') then 'parent_skipped'
                         when v_asked ? v_lk then 'choice' end;
        if v_reason is not null then v_link_steps := array_append(v_link_steps, app.plan_skip('dish_group', v_lk, v_reason)); continue; end if;
        if v_merged_links ? v_lk then v_link_steps := array_append(v_link_steps, app.plan_skip('dish_group', v_lk, 'merged')); continue; end if;
        v_res := v_link_res->v_lk;
        v_gt := case when v_res->>'kind' = 'own' then
                       case when v_res->>'answer' = 'new_group' then jsonb_build_object('id', null, 'ref', v_a->>'group')
                            else jsonb_build_object('id', v_res->>'groupId', 'ref', null) end
                     when not v_forced_new ? (v_a->>'group') and v_global_match ? (v_a->>'group') then jsonb_build_object('id', v_global_match->>(v_a->>'group'), 'ref', null)
                     else jsonb_build_object('id', null, 'ref', v_a->>'group') end;
        v_cap := coalesce((v_capacity->>coalesce(v_gt->>'id', 'ref:' || (v_gt->>'ref')))::integer, 0);
        if v_res->>'kind' = 'own' and v_res->>'answer' = 'new_group' then
          -- moved to the group this plan creates: like a created link, a minimum above its capacity is lowered to it
          v_jmn := case when app.js_null(v_a->'min') then 'null'::jsonb else to_jsonb(least((v_a->>'min')::integer, v_cap)) end;
          v_link_steps := array_append(v_link_steps, jsonb_build_object('kind', 'dish_group', 'key', v_lk, 'op', 'update', 'id', v_res->'link'->>'id',
            'set', jsonb_build_object('min_units', v_jmn, 'max_units', v_a->'max'), 'refs', jsonb_build_object('group_id', v_a->>'group'), 'reason', null));
          continue;
        end if;
        if v_res->>'kind' = 'own' then v_link_steps := array_append(v_link_steps, app.plan_change('dish_group', v_lk, v_res->'link'->>'id', '{}')); continue; end if;
        v_dt := v_dish_target->(v_d->>'key');
        v_tk := coalesce(v_dt->>'id', 'ref:' || (v_dt->>'ref'));
        if not v_next_link_pos ? v_tk then
          v_next_link_pos := v_next_link_pos || jsonb_build_object(v_tk, case when (v_dt->>'id') is not null
            then app.plan_next_position(coalesce(v_links_of->(v_dt->>'id'), '[]')) else 0 end);
        end if;
        v_pos := (v_next_link_pos->>v_tk)::integer;
        v_next_link_pos := v_next_link_pos || jsonb_build_object(v_tk, v_pos + 1);
        v_jmn := v_a->'min'; v_jmx := v_a->'max';
        if (v_gt->>'id') is not null then
          -- a dish only tightens an existing group: a stated limit outside the group's own is dropped; a minimum above
          -- what its options reach is lowered to it, or dropped when that is below the group's own minimum
          v_y := v_group_by_id->(v_gt->>'id');
          if not app.js_null(v_jmn) and ((v_jmn::text)::numeric < (v_y->>'min_units')::numeric or (v_jmn::text)::numeric > (v_y->>'max_units')::numeric) then v_jmn := 'null'; end if;
          if not app.js_null(v_jmx) and ((v_jmx::text)::numeric > (v_y->>'max_units')::numeric or (v_jmx::text)::numeric < (v_y->>'min_units')::numeric) then v_jmx := 'null'; end if;
          if not app.js_null(v_jmn) and not app.js_null(v_jmx) and (v_jmn::text)::numeric > (v_jmx::text)::numeric then v_jmn := 'null'; v_jmx := 'null'; end if;
          if not app.js_null(v_jmn) and (v_jmn::text)::numeric > v_cap then
            v_jmn := case when v_cap >= (v_y->>'min_units')::numeric then to_jsonb(v_cap) else 'null'::jsonb end;
          end if;
        elsif not app.js_null(v_jmn) then v_jmn := to_jsonb(least((v_jmn::text)::integer, v_cap));
        end if;
        v_set := jsonb_build_object('position', v_pos, 'min_units', v_jmn, 'max_units', v_jmx);
        v_refs := '{}';
        if (v_dt->>'id') is not null then v_set := v_set || jsonb_build_object('dish_id', v_dt->>'id'); else v_refs := v_refs || jsonb_build_object('dish_id', v_dt->>'ref'); end if;
        if (v_gt->>'id') is not null then v_set := v_set || jsonb_build_object('group_id', v_gt->>'id'); else v_refs := v_refs || jsonb_build_object('group_id', v_gt->>'ref'); end if;
        v_link_steps := array_append(v_link_steps, app.plan_create('dish_group', v_lk, v_set, v_refs));
      end loop;
    end loop;
  end loop;
  for v_si in 0 .. jsonb_array_length(v_secs) - 1 loop
    v_s := v_secs->v_si;
    for v_dj in 0 .. jsonb_array_length(v_s->'dishes') - 1 loop
      v_d := v_s->'dishes'->v_dj; v_key := v_d->>'key';
      continue when app.js_null(v_d->'photo');
      v_dt := v_dish_target->v_key;
      if v_dt is null then v_photo_steps := array_append(v_photo_steps, app.plan_skip('photo', v_key, 'parent_skipped')); continue; end if;
      -- the dish's picture stays whatever the rights of the one read; only a dish without one may get it
      v_cur := null;
      if (v_dt->>'id') is not null then
        v_cur := nullif(v_dish_by_id->(v_dt->>'id')->>'asset_id', '');
        if v_cur is null then
          select min(x->>'id' collate "C") into v_cur from jsonb_array_elements(coalesce(p_existing->'assets', '[]')) x
          where x->>'dish_id' = v_dt->>'id' and x->>'status' in ('uploaded', 'processing', 'ready_for_review', 'approved');
        end if;
      end if;
      if v_cur is not null then v_photo_steps := array_append(v_photo_steps, app.plan_change('photo', v_key, v_cur, '{}')); continue; end if;
      v_at_upload := v_d->'photo'->>'rights' = 'confirmed';
      if not v_at_upload and v_choice->>('photo_rights_unknown@' || v_key) is distinct from 'confirm_rights' then
        v_photo_steps := array_append(v_photo_steps, app.plan_skip('photo', v_key, 'choice')); continue;
      end if;
      v_set := jsonb_build_object('kind', 'photo', 'status', 'uploaded', 'original_path', v_d->'photo'->'path',
        'provenance', jsonb_build_object('from', 'import', 'source', p_draft->'source', 'rights', case when v_at_upload then 'confirmed_at_upload' else 'confirmed_at_apply' end));
      if (v_dt->>'id') is not null then v_set := v_set || jsonb_build_object('dish_id', v_dt->>'id'); end if;
      v_photo_steps := array_append(v_photo_steps, app.plan_create('photo', v_key, v_set,
        case when (v_dt->>'ref') is not null then jsonb_build_object('dish_id', v_dt->>'ref') else '{}'::jsonb end));
    end loop;
  end loop;

  -- ---- 15. limits, counting what the venue already has
  if jsonb_array_length(p_existing->'sections') + (select count(*) from unnest(v_section_steps) x where x->>'op' = 'create') > 40 then
    v_errs := v_errs || app.issue('too_many', 'sections');
  end if;
  if jsonb_array_length(p_existing->'dishes') + (select count(*) from unnest(v_dish_steps) x where x->>'op' = 'create') > 400 then
    v_errs := v_errs || app.issue('too_many', 'dishes');
  end if;
  if jsonb_array_length(p_existing->'groups') + (select count(*) from unnest(v_group_steps) x where x->>'op' = 'create') > 200 then
    v_errs := v_errs || app.issue('too_many', 'groups');
  end if;
  v_errs := v_errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'too_many', 'path', z.gid) order by z.first_at), '[]')
                       from (select x->'set'->>'group_id' as gid, count(*) as cnt, min(i) as first_at
                             from unnest(v_option_steps) with ordinality t(x, i)
                             where x->>'op' = 'create' and x->'set' ? 'group_id' group by 1) z
                       where jsonb_array_length(coalesce(v_options_of->z.gid, '[]')) + z.cnt > 30);
  v_errs := v_errs || (select coalesce(jsonb_agg(jsonb_build_object('code', 'too_many', 'path', z.key) order by z.i), '[]')
                       from (select x->>'key' as key, i,
                                    coalesce(jsonb_array_length(v_links_of->(x->'set'->>'dish_id')), 0) * (case when x->'set' ? 'dish_id' then 1 else 0 end)
                                    + count(*) over (partition by coalesce(x->'set'->>'dish_id', 'ref:' || (x->'refs'->>'dish_id')) order by i) as n
                             from unnest(v_link_steps) with ordinality t(x, i) where x->>'op' = 'create') z
                       where z.n > 8);
  if jsonb_array_length(v_errs) > 0 then return jsonb_build_object('ok', false, 'errors', v_errs); end if;

  v_steps := to_jsonb(v_section_steps || v_group_steps || v_option_steps || v_dish_steps || v_link_steps || v_photo_steps);
  select coalesce(jsonb_object_agg(z.k, z.i), '{}') into v_step_index
  from (select (x->>'kind') || ':' || (x->>'key') as k, max(i) as i from jsonb_array_elements(v_steps) with ordinality t(x, i) group by 1) z;
  select coalesce(jsonb_agg(x->'e' order by coalesce((v_step_index->>(x->>'step'))::integer, 1), array_position(app.import_exception_codes(), x->'e'->>'code'), i), '[]')
  into v_plan_ex from jsonb_array_elements(v_plan_asked) with ordinality t(x, i);
  select jsonb_object_agg(k.kind, jsonb_build_object(
           'create', (select count(*) from jsonb_array_elements(v_steps) x where x->>'kind' = k.kind and x->>'op' = 'create'),
           'update', (select count(*) from jsonb_array_elements(v_steps) x where x->>'kind' = k.kind and x->>'op' = 'update'),
           'keep', (select count(*) from jsonb_array_elements(v_steps) x where x->>'kind' = k.kind and x->>'op' = 'keep'),
           'skip', (select count(*) from jsonb_array_elements(v_steps) x where x->>'kind' = k.kind and x->>'op' = 'skip'),
           'skipped', (select jsonb_object_agg(r.reason, (select count(*) from jsonb_array_elements(v_steps) x
                                                           where x->>'kind' = k.kind and x->>'op' = 'skip' and x->>'reason' = r.reason))
                       from unnest(array['choice', 'merged', 'empty', 'parent_skipped', 'unused']) r(reason))))
  into v_summary from unnest(array['section', 'group', 'option', 'dish', 'dish_group', 'photo']) k(kind);
  return jsonb_build_object('ok', true, 'value', jsonb_build_object('v', 1, 'steps', v_steps, 'summary', v_summary,
    'exceptions', v_answered || v_plan_ex, 'fromDraft', jsonb_array_length(v_answered)));
end $$;

-- ExistingMenu: what the venue has, as the plan reads it
create function app.existing_menu(p_venue uuid) returns jsonb language sql stable security definer set search_path = '' set jit = off as $$
  select jsonb_build_object(
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'position', s.position, 'name_he', s.name_he, 'name_en', s.name_en, 'kind', s.kind)
                                           order by s.position, s.id), '[]') from public.sections s where s.venue_id = p_venue),
    'dishes', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'section_id', d.section_id, 'position', d.position, 'name_he', d.name_he,
                 'name_en', d.name_en, 'desc_he', d.desc_he, 'desc_en', d.desc_en, 'price', d.price, 'price_note_he', d.price_note_he,
                 'price_note_en', d.price_note_en, 'tags', to_jsonb(d.tags), 'allergens_he', d.allergens_he, 'allergens_en', d.allergens_en,
                 'asset_id', d.asset_id, 'stock_id', d.stock_id) order by d.position, d.id), '[]') from public.dishes d where d.venue_id = p_venue),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name_he', g.name_he, 'name_en', g.name_en, 'selection', g.selection,
                 'min_units', g.min_units, 'max_units', g.max_units) order by g.id), '[]') from public.addon_groups g where g.venue_id = p_venue),
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'group_id', o.group_id, 'position', o.position, 'name_he', o.name_he,
                 'name_en', o.name_en, 'price', o.price, 'max_qty', o.max_qty, 'opens_group_id', o.opens_group_id) order by o.position, o.id), '[]')
                from public.addon_options o where o.venue_id = p_venue),
    'dishGroups', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'dish_id', l.dish_id, 'group_id', l.group_id, 'position', l.position)
                     order by l.position, l.id), '[]') from public.dish_addon_groups l where l.venue_id = p_venue),
    'assets', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'dish_id', a.dish_id, 'status', a.status) order by a.id), '[]')
               from public.assets a where a.venue_id = p_venue and a.dish_id is not null))
$$;

create function app.plan_import(p_venue uuid, p_draft jsonb, p_decisions jsonb, p_langs text[]) returns jsonb
language sql stable security definer set search_path = '' set jit = off as
$$ select app.plan_import_on(p_draft, app.existing_menu(p_venue), p_decisions, coalesce(p_langs, array['he', 'en'])) $$;

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
               where not app.js_null(d->'photo') and d ? 'photo'),
    'dropped', case when app.js_int(p->'dropped') then (p->>'dropped')::integer else 0 end)
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
  -- (the validator counts the images by source: a scan at most 8, Wolt screenshots at most 24)
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  -- the scanner downloads these with the service role: each one exactly <venue>/imports/<import id>/<name> (the
  -- table's check says the same)
  if p_source in ('scan', 'wolt_screenshots') and not app.import_paths_ok(p_venue, p_import_id, p_paths) then return app.fail('path_invalid'); end if;
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

-- claim_import_scan: the scanner, with the owner's own token, before any paid call, naming what it reads (p_mode: the
-- source, scan or wolt_screenshots). uploaded | failed → parsing in one statement; a claim older than 10 minutes (a
-- crashed read) may be claimed again; a purged import never. Owners and managers only: anyone else, and an import that
-- does not exist, get the same import_unknown (no oracle on other venues' imports). A mode that is not the import's
-- source is not_scannable and costs nothing. The images are charged when the claim succeeds, against three caps (import_caps): the venue's local
-- day, the person's UTC day, and all venues' UTC day; rate_limited names the cap.
create function public.claim_import_scan(p_import uuid, p_mode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i record; c record; caps jsonb := app.cfg('import_caps'); n integer; k text; used integer; cap integer;
  me uuid := (select auth.uid()); venue_day timestamptz; utc_day timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  counters jsonb;
begin
  if me is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, venue_id, source, status, updated_at, raw_purged_at, raw_paths into i from public.menu_imports where id = p_import;
  if not found or not app.can_edit(i.venue_id) then return app.fail('import_unknown'); end if;
  -- the scanner names what it reads: the import's source (scan or wolt_screenshots)
  if i.source not in ('scan', 'wolt_screenshots') or p_mode is distinct from i.source then
    return app.fail('not_scannable');
  end if;
  -- IMPORT_IMAGES_MAX by source (create_import holds new imports to it; an older row with more is never read)
  if cardinality(i.raw_paths) > (case i.source when 'scan' then 8 else 24 end) then return app.fail('not_scannable'); end if;
  if i.raw_purged_at is not null or i.status in ('parsed', 'applied', 'discarded') then return app.fail('import_closed'); end if;
  if i.status = 'parsing' and i.updated_at > now() - interval '10 minutes' then return app.fail('import_busy'); end if;
  perform pg_advisory_xact_lock(hashtext('mana:import:' || i.venue_id::text));
  perform pg_advisory_xact_lock(hashtext('mana:import-images'));
  n := cardinality(i.raw_paths);
  venue_day := app.local_day_start(i.venue_id);
  counters := jsonb_build_array(
    jsonb_build_array('scan_images_per_venue_day', 'import-images:venue:' || i.venue_id, venue_day),
    jsonb_build_array('scan_images_per_user_day', 'import-images:user:' || me, utc_day),
    jsonb_build_array('scan_images_per_day', 'import-images:all', utc_day));
  for k, cap, used in
    select x->>0, coalesce((caps->>(x->>0))::integer, case x->>0 when 'scan_images_per_venue_day' then 60 when 'scan_images_per_user_day' then 120 else 1000 end),
           coalesce((select e.n from app.event_counters e where e.key = x->>1 and e.window_start = (x->>2)::timestamptz), 0)
    from jsonb_array_elements(counters) with ordinality t(x, o) order by o
  loop
    if used + n > cap then return jsonb_build_object('ok', false, 'code', 'rate_limited', 'cap', k); end if;
  end loop;
  perform set_config('mana.via', 'rpc', true);
  update public.menu_imports set status = 'parsing', error_code = null
  where id = p_import and raw_purged_at is null
    and (status in ('uploaded', 'failed') or (status = 'parsing' and updated_at <= now() - interval '10 minutes'))
  returning id, venue_id, source, raw_paths, rights_confirmed into c;
  if not found then
    perform set_config('mana.via', '', true);
    return app.fail('import_busy');
  end if;
  insert into app.event_counters as e (key, window_start, n)
  select x->>1, (x->>2)::timestamptz, n from jsonb_array_elements(counters) x
  on conflict (key, window_start) do update set n = e.n + excluded.n;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'importId', c.id, 'venueId', c.venue_id, 'source', c.source, 'paths', to_jsonb(c.raw_paths),
                            'images', cardinality(c.raw_paths), 'rightsConfirmed', c.rights_confirmed,
                            'langs', (select to_jsonb(v.langs) from public.venues v where v.id = c.venue_id));
end $$;

-- list_purgeable_imports (the scanner's purge mode, service role only): image imports whose screenshots may be deleted
-- now, by the daily job's rule (app.import_past_retention: finished, or left waiting, longer ago than
-- import_raw_retention_days), with their venue, so it deletes exactly <venue>/imports/<id>/<name>, and finishedAt (when
-- the retention started, to the microsecond). Oldest first, by (finishedAt, importId); p_after, the last row's
-- {finishedAt, importId} as it came, gives the page after it, so rows the scanner cannot purge never hold back the rest
-- (a malformed cursor: 22023 cursor_invalid). Then it marks each purged (raw_paths '{}', raw_purged_at now(), on the
-- condition that it is still unpurged; the guard, app.import_purgeable, refuses anything else).
create function public.list_purgeable_imports(p_limit integer default 50, p_after jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare after_at timestamptz; after_id uuid;
begin
  if not app.is_service() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_after is not null and p_after <> 'null'::jsonb then
    -- exactly {finishedAt, importId} (the contracts' PurgeCursor)
    if jsonb_typeof(p_after) <> 'object' or not app.uuid_ok(p_after->'importId') or not p_after ? 'finishedAt'
       or (select count(*) from jsonb_object_keys(p_after)) <> 2 then
      raise exception 'cursor_invalid' using errcode = '22023';
    end if;
    after_at := app.js_instant_exact(p_after->'finishedAt');
    if after_at is null then raise exception 'cursor_invalid' using errcode = '22023'; end if;
    after_id := (p_after->>'importId')::uuid;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('importId', z.id, 'venueId', z.venue_id, 'status', z.status, 'paths', to_jsonb(z.raw_paths),
                                                       'finishedAt', to_jsonb(z.finished_at)) order by z.finished_at, z.id)
                   from (select i.id, i.venue_id, i.status, i.raw_paths, app.import_finished_at(i.status, i.applied_at, i.updated_at) as finished_at
                         from public.menu_imports i
                         where i.raw_purged_at is null and cardinality(i.raw_paths) > 0 and app.import_past_retention(i.status, i.applied_at, i.updated_at)
                           and (after_at is null or (app.import_finished_at(i.status, i.applied_at, i.updated_at), i.id) > (after_at, after_id))
                         order by 5, 1 limit greatest(1, least(coalesce(p_limit, 50), 500))) z), '[]'::jsonb);
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

-- save_import_draft: what a reader made of the input. Owners and managers (an import uploaded, failed or parsed: text
-- they parsed on the phone, or a correction); the scanner with the service role (an import it claimed, still parsing).
-- Anyone else, and an import that does not exist, get the same import_unknown. The draft is checked by
-- app.validate_import_draft (the twin of validateDraft); its photos must lie in the import's own folder, and a photo
-- the reader marks confirmed needs the owner's confirmation at upload. The exceptions are computed here, in the venue's
-- languages. p_notes: what the reader says about the source (ReaderNote: codes, draft keys, lines and counts, never
-- text), checked by app.validate_reader_notes (the twin of readerNoteIssues) and stored in menu_imports.notes.
create function public.save_import_draft(p_import uuid, p_draft jsonb, p_notes jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' set jit = off as $$
declare svc boolean := app.is_service(); i record; errs jsonb; exc jsonb; v_notes jsonb := coalesce(p_notes, '[]'::jsonb);
begin
  if not svc and (select auth.uid()) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, venue_id, source, status, rights_confirmed into i from public.menu_imports where id = p_import for update;
  if not found or (not svc and not app.can_edit(i.venue_id)) then return app.fail('import_unknown'); end if;
  if svc then
    -- the scanner saves only a read it claimed: anything else means the claim is gone
    if i.status <> 'parsing' then return app.fail('import_closed'); end if;
  elsif i.status = 'parsing' then return app.fail('import_busy');
  elsif i.status in ('applied', 'discarded') then return app.fail('import_closed');
  end if;
  if p_draft is null or octet_length(p_draft::text) > 1500000 then return app.fail('too_large'); end if;
  errs := app.validate_import_draft(p_draft);
  if jsonb_array_length(errs) > 0 then return app.fail('invalid_draft', errs); end if;
  if p_draft->>'source' <> i.source then return app.fail('source_mismatch'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('code', 'path_invalid', 'path', format('sections[%s].dishes[%s].photo.path', si - 1, dj - 1)) order by si, dj), '[]')
  into errs
  from jsonb_array_elements(p_draft->'sections') with ordinality s(s, si), jsonb_array_elements(s->'dishes') with ordinality d(d, dj)
  where app.js_obj(d->'photo') and not app.import_path_ok(i.venue_id, i.id, d->'photo'->>'path');
  if jsonb_array_length(errs) > 0 then return app.fail('invalid_draft', errs); end if;
  if not i.rights_confirmed then
    select coalesce(jsonb_agg(jsonb_build_object('code', 'rights_unconfirmed', 'path', format('sections[%s].dishes[%s].photo.rights', si - 1, dj - 1)) order by si, dj), '[]')
    into errs
    from jsonb_array_elements(p_draft->'sections') with ordinality s(s, si), jsonb_array_elements(s->'dishes') with ordinality d(d, dj)
    where d->'photo'->'rights' = '"confirmed"'::jsonb;
    if jsonb_array_length(errs) > 0 then return app.fail('rights_unconfirmed', errs); end if;
  end if;
  errs := app.validate_reader_notes(v_notes, p_draft);
  if jsonb_array_length(errs) > 0 then return app.fail('invalid_draft', errs); end if;
  exc := app.import_exceptions(p_draft, (select v.langs from public.venues v where v.id = i.venue_id));
  perform set_config('mana.via', 'rpc', true);
  update public.menu_imports set parsed = p_draft, exceptions = exc, notes = v_notes, status = 'parsed', error_code = null where id = p_import;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'exceptions', exc, 'counts', app.draft_counts(p_draft));
end $$;

-- Runs a plan on the venue's tables: one statement per table and operation (so the log has one row per statement,
-- n = the rows), the ids of created rows made first so later rows can point at them. Nothing is ever deleted. A
-- trigger or constraint that refuses a row undoes everything this function did and answers {code, path} (the code is
-- the trigger's, path the table); null when every step ran.
create function app.apply_import_plan(p_venue uuid, p_import uuid, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = '' set jit = off as $$
declare steps jsonb := p_plan->'steps'; ids jsonb; stage text := 'sections';
begin
  select coalesce(jsonb_object_agg((s->>'kind') || ':' || (s->>'key'), gen_random_uuid()), '{}') into ids
  from jsonb_array_elements(steps) s where s->>'op' = 'create' and s->>'kind' in ('section', 'group', 'dish');
  begin
    stage := 'sections';
    insert into public.sections (id, venue_id, position, name_he, name_en, kind, room)
    select (ids->>('section:' || (s->>'key')))::uuid, p_venue, (s->'set'->>'position')::integer, s->'set'->>'name_he', s->'set'->>'name_en',
           s->'set'->>'kind', s->'set'->>'room'
    from jsonb_array_elements(steps) with ordinality x(s, i) where s->>'kind' = 'section' and s->>'op' = 'create' order by i;
    update public.sections t set name_he = coalesce(u.s->'set'->>'name_he', t.name_he), name_en = coalesce(u.s->'set'->>'name_en', t.name_en)
    from (select s from jsonb_array_elements(steps) s where s->>'kind' = 'section' and s->>'op' = 'update') u
    where t.id = (u.s->>'id')::uuid and t.venue_id = p_venue;

    stage := 'addon_groups';
    insert into public.addon_groups (id, venue_id, label, name_he, name_en, selection, min_units, max_units, limits_confirmed)
    select (ids->>('group:' || (s->>'key')))::uuid, p_venue, s->'set'->>'label', s->'set'->>'name_he', s->'set'->>'name_en', s->'set'->>'selection',
           (s->'set'->>'min_units')::integer, (s->'set'->>'max_units')::integer, (s->'set'->>'limits_confirmed')::boolean
    from jsonb_array_elements(steps) with ordinality x(s, i) where s->>'kind' = 'group' and s->>'op' = 'create' order by i;
    update public.addon_groups t set name_he = coalesce(u.s->'set'->>'name_he', t.name_he), name_en = coalesce(u.s->'set'->>'name_en', t.name_en)
    from (select s from jsonb_array_elements(steps) s where s->>'kind' = 'group' and s->>'op' = 'update') u
    where t.id = (u.s->>'id')::uuid and t.venue_id = p_venue;

    stage := 'addon_options';
    insert into public.addon_options (venue_id, group_id, position, name_he, name_en, price, max_qty, is_default, opens_group_id)
    select p_venue, coalesce(s->'set'->>'group_id', ids->>('group:' || (s->'refs'->>'group_id')))::uuid, (s->'set'->>'position')::integer,
           s->'set'->>'name_he', s->'set'->>'name_en', (s->'set'->>'price')::integer, (s->'set'->>'max_qty')::integer, (s->'set'->>'is_default')::boolean,
           case when s->'set' ? 'opens_group_id' then (s->'set'->>'opens_group_id')::uuid else (ids->>('group:' || (s->'refs'->>'opens_group_id')))::uuid end
    from jsonb_array_elements(steps) with ordinality x(s, i) where s->>'kind' = 'option' and s->>'op' = 'create' order by i;
    -- (a venue's option answered new_group opens the group this plan creates: refs.opens_group_id)
    update public.addon_options t set name_he = coalesce(u.s->'set'->>'name_he', t.name_he), name_en = coalesce(u.s->'set'->>'name_en', t.name_en),
           price = case when u.s->'set' ? 'price' then (u.s->'set'->>'price')::integer else t.price end,
           opens_group_id = case when u.s->'refs' ? 'opens_group_id' then (ids->>('group:' || (u.s->'refs'->>'opens_group_id')))::uuid else t.opens_group_id end
    from (select s from jsonb_array_elements(steps) s where s->>'kind' = 'option' and s->>'op' = 'update') u
    where t.id = (u.s->>'id')::uuid and t.venue_id = p_venue;

    stage := 'dishes';
    insert into public.dishes (id, venue_id, section_id, position, name_he, name_en, desc_he, desc_en, price, price_note_he, price_note_en, tags,
                               allergens_he, allergens_en, stock_id)
    select (ids->>('dish:' || (s->>'key')))::uuid, p_venue, coalesce(s->'set'->>'section_id', ids->>('section:' || (s->'refs'->>'section_id')))::uuid,
           (s->'set'->>'position')::integer, s->'set'->>'name_he', s->'set'->>'name_en', s->'set'->>'desc_he', s->'set'->>'desc_en',
           (s->'set'->>'price')::integer, s->'set'->>'price_note_he', s->'set'->>'price_note_en',
           array(select jsonb_array_elements_text(s->'set'->'tags')), s->'set'->>'allergens_he', s->'set'->>'allergens_en', s->'set'->>'stock_id'
    from jsonb_array_elements(steps) with ordinality x(s, i) where s->>'kind' = 'dish' and s->>'op' = 'create' order by i;
    update public.dishes t set
      name_he = coalesce(u.s->'set'->>'name_he', t.name_he), name_en = coalesce(u.s->'set'->>'name_en', t.name_en),
      desc_he = coalesce(u.s->'set'->>'desc_he', t.desc_he), desc_en = coalesce(u.s->'set'->>'desc_en', t.desc_en),
      price_note_he = coalesce(u.s->'set'->>'price_note_he', t.price_note_he), price_note_en = coalesce(u.s->'set'->>'price_note_en', t.price_note_en),
      allergens_he = coalesce(u.s->'set'->>'allergens_he', t.allergens_he), allergens_en = coalesce(u.s->'set'->>'allergens_en', t.allergens_en),
      price = case when u.s->'set' ? 'price' then (u.s->'set'->>'price')::integer else t.price end,
      tags = case when u.s->'set' ? 'tags' then array(select jsonb_array_elements_text(u.s->'set'->'tags')) else t.tags end,
      stock_id = case when u.s->'set' ? 'stock_id' then u.s->'set'->>'stock_id' else t.stock_id end
    from (select s from jsonb_array_elements(steps) s where s->>'kind' = 'dish' and s->>'op' = 'update') u
    where t.id = (u.s->>'id')::uuid and t.venue_id = p_venue;

    stage := 'dish_addon_groups';
    -- a dish's link answered new_group moves to the group this plan creates, with the draft's limits (refs.group_id)
    update public.dish_addon_groups t set
      group_id = case when u.s->'refs' ? 'group_id' then (ids->>('group:' || (u.s->'refs'->>'group_id')))::uuid else t.group_id end,
      min_units = case when u.s->'set' ? 'min_units' then (u.s->'set'->>'min_units')::integer else t.min_units end,
      max_units = case when u.s->'set' ? 'max_units' then (u.s->'set'->>'max_units')::integer else t.max_units end
    from (select s from jsonb_array_elements(steps) s where s->>'kind' = 'dish_group' and s->>'op' = 'update') u
    where t.id = (u.s->>'id')::uuid and t.venue_id = p_venue;
    insert into public.dish_addon_groups (venue_id, dish_id, group_id, position, min_units, max_units)
    select p_venue, coalesce(s->'set'->>'dish_id', ids->>('dish:' || (s->'refs'->>'dish_id')))::uuid,
           coalesce(s->'set'->>'group_id', ids->>('group:' || (s->'refs'->>'group_id')))::uuid, (s->'set'->>'position')::integer,
           (s->'set'->>'min_units')::integer, (s->'set'->>'max_units')::integer
    from jsonb_array_elements(steps) with ordinality x(s, i) where s->>'kind' = 'dish_group' and s->>'op' = 'create' order by i;

    -- photos enter the picture pipeline (uploaded) and wait for the owner's approval like any upload
    stage := 'assets';
    insert into public.assets (venue_id, dish_id, kind, status, original_path, provenance)
    select p_venue, coalesce(s->'set'->>'dish_id', ids->>('dish:' || (s->'refs'->>'dish_id')))::uuid, s->'set'->>'kind', s->'set'->>'status',
           s->'set'->>'original_path', s->'set'->'provenance' || jsonb_build_object('importId', p_import)
    from jsonb_array_elements(steps) with ordinality x(s, i) where s->>'kind' = 'photo' and s->>'op' = 'create' order by i;
  exception when raise_exception or integrity_constraint_violation or data_exception then
    return jsonb_build_object('code', case sqlstate when 'P0001' then sqlerrm when '23514' then 'check_violation' when '23505' then 'unique_violation'
                                                    when '23503' then 'foreign_key_violation' when '23502' then 'not_null_violation'
                                                    else 'data_invalid' end, 'path', stage);
  end;
  return null;
end $$;

-- apply_import: the draft the owner looked at (it must be the stored one) and their answers, applied in one
-- transaction: create, update or keep, never a delete, never a publish. Owners and managers; anyone else, and an
-- import that does not exist, get import_unknown. Stores the draft's own exceptions with the answers used
-- (exceptions[0:fromDraft], at most 2000 by the validator); the plan's own are counted per code in the import.apply
-- row (planExceptions). Marks onboarding's menu and review done.
create function public.apply_import(p_import uuid, p_draft jsonb, p_decisions jsonb) returns jsonb
language plpgsql security definer set search_path = '' set jit = off as $$
declare i record; errs jsonb; plan jsonb; failed jsonb; stored jsonb; plan_asked jsonb;
begin
  if (select auth.uid()) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, venue_id, source, status, parsed into i from public.menu_imports where id = p_import for update;
  if not found or not app.can_edit(i.venue_id) then return app.fail('import_unknown'); end if;
  perform pg_advisory_xact_lock(hashtext('mana:import:' || i.venue_id::text));
  if i.status in ('applied', 'discarded') then return app.fail('import_closed'); end if;
  if i.status <> 'parsed' then return app.fail('not_parsed'); end if;
  if p_draft is null or i.parsed is distinct from p_draft then return app.fail('draft_changed'); end if;
  errs := app.validate_import_decisions(p_decisions);
  if jsonb_array_length(errs) > 0 then return app.fail('invalid_decisions', errs); end if;
  plan := app.plan_import(i.venue_id, p_draft, p_decisions, (select v.langs from public.venues v where v.id = i.venue_id));
  if plan->>'ok' = 'false' then return app.fail('plan_invalid', plan->'errors'); end if;
  plan := plan->'value';
  select coalesce(jsonb_agg(x order by n), '[]') into stored
  from jsonb_array_elements(plan->'exceptions') with ordinality t(x, n) where n <= (plan->>'fromDraft')::integer;
  select coalesce(jsonb_object_agg(z.code, z.cnt), '{}') into plan_asked
  from (select x->>'code' as code, count(*) as cnt from jsonb_array_elements(plan->'exceptions') with ordinality t(x, n)
        where n > (plan->>'fromDraft')::integer group by 1) z;
  perform set_config('mana.via', 'rpc', true);
  failed := app.apply_import_plan(i.venue_id, i.id, plan);
  if failed is not null then
    perform set_config('mana.via', '', true);
    return app.fail('apply_failed', jsonb_build_array(failed));
  end if;
  update public.menu_imports set status = 'applied', exceptions = stored where id = i.id;
  insert into public.onboarding_progress (venue_id, step, state) values (i.venue_id, 'menu', 'done'), (i.venue_id, 'review', 'done')
  on conflict (venue_id, step) do update set state = 'done' where public.onboarding_progress.state <> 'done';
  perform app.log(i.venue_id, 'import.apply', 'menu_imports', array[i.id::text],
                  jsonb_build_object('source', i.source, 'summary', plan->'summary', 'planExceptions', plan_asked));
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'plan', plan);
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
                                          'auto', st.step = any (app.onboarding_auto_steps()), 'updatedAt', to_jsonb(st.updated_at)) order by st.i),
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

-- act_for_owner('onboarding.set', {step, state, blockers?, expectedUpdatedAt}): the same validator and the same
-- internal. expectedUpdatedAt is the step's updatedAt as staff read it (null: never written), compared to the
-- microsecond; another one answers stale with the step as it is, and nothing is written.
create or replace function app.afo_onboarding_set(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare input jsonb := jsonb_build_object('venueId', p_venue, 'step', p->'step', 'state', p->'state'); errs jsonb; res jsonb;
  expected timestamptz := app.js_instant_exact(p->'expectedUpdatedAt'); cur record;
begin
  if not p ? 'expectedUpdatedAt' or (p->'expectedUpdatedAt' <> 'null'::jsonb and expected is null) then raise exception 'payload_invalid'; end if;
  if p ? 'blockers' then input := input || jsonb_build_object('blockers', p->'blockers'); end if;
  errs := app.validate_set_step(input);
  if jsonb_array_length(errs) > 0 then raise exception '%', errs->0->>'code'; end if;
  select state, blockers, updated_at into cur from public.onboarding_progress where venue_id = p_venue and step = p->>'step' for update;
  if cur.updated_at is distinct from expected then
    return jsonb_build_object('ok', false, 'code', 'stale', 'action', 'onboarding.set', 'current', jsonb_build_object(
      'step', p->>'step', 'state', coalesce(cur.state, 'todo'), 'blockers', to_jsonb(coalesce(cur.blockers, '{}'::text[])), 'updatedAt', to_jsonb(cur.updated_at)));
  end if;
  res := app.set_onboarding_step(p_venue, p->>'step', p->>'state',
                                 case when p ? 'blockers' then array(select jsonb_array_elements_text(p->'blockers')) end);
  return jsonb_build_object('step', p->>'step', 'state', p->>'state', 'progress', res);
end $$;

-- ================================================================ support cases ("get help", F03 and F09)
-- SupportCase, as the owner and Halom read it. updatedAt is the case's version, at full precision (as to_jsonb writes
-- a timestamptz): staff send it back to ops_update_case as p_expected_updated_at, exactly as they read it.
create function app.case_json(p_case uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'venueId', c.venue_id, 'topic', c.topic, 'status', c.status, 'subject', c.subject, 'body', c.body,
    'openedBy', case when m.role in ('owner', 'manager') then m.role when s.user_id is not null then 'staff' end,
    'openedAt', app.iso(c.created_at), 'updatedAt', to_jsonb(c.updated_at), 'resolvedAt', app.iso(c.resolved_at), 'supportCanAct', v.support_can_act)
  from public.support_cases c
  join public.venues v on v.id = c.venue_id
  left join public.venue_members m on m.venue_id = c.venue_id and m.user_id = c.opened_by
  left join public.staff s on s.user_id = c.opened_by
  where c.id = p_case
$$;

-- open_case: owners and managers ask Halom for help; allowAct (the owner's alone) sets the support switch with it
-- p_id: the client's own id for the case (a retry after a lost answer): the same id again answers the stored case
-- (reused: true), writes nothing and is not counted by the rate limit; an id another venue's case holds answers
-- id_taken, never that case
create function public.open_case(p_venue uuid, p_topic text, p_subject text, p_body text default '', p_allow_act boolean default null,
                                 p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; n integer; cid uuid; can_act boolean; held_by uuid;
  cap integer := coalesce((app.cfg('case_caps')->>'per_venue_day')::integer, 10);
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue and archived_at is null) then return app.fail('venue_unknown'); end if;
  errs := app.validate_open_case(jsonb_build_object('venueId', p_venue, 'topic', p_topic, 'subject', p_subject, 'body', p_body)
            || case when p_allow_act is null then '{}'::jsonb else jsonb_build_object('allowAct', p_allow_act) end);
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  if p_allow_act is not null and not app.is_owner(p_venue) then return app.fail('owner_only'); end if;
  perform pg_advisory_xact_lock(hashtext('mana:case:' || p_venue::text));
  if p_id is not null then
    select venue_id into held_by from public.support_cases where id = p_id;
    if found then
      if held_by <> p_venue then return app.fail('id_taken'); end if;
      return jsonb_build_object('ok', true, 'caseId', p_id, 'supportCanAct', (select v.support_can_act from public.venues v where v.id = p_venue),
                                'reused', true);
    end if;
  end if;
  select count(*) into n from public.support_cases where venue_id = p_venue and created_at >= app.local_day_start(p_venue);
  if n >= cap then return app.fail('rate_limited'); end if;
  perform set_config('mana.via', 'rpc', true);
  insert into public.support_cases (id, venue_id, topic, subject, body)
  values (coalesce(p_id, gen_random_uuid()), p_venue, p_topic, p_subject, coalesce(p_body, '')) returning id into cid;
  if p_allow_act is not null then
    update public.venues set support_can_act = p_allow_act where id = p_venue and support_can_act is distinct from p_allow_act;
  end if;
  perform set_config('mana.via', '', true);
  select support_can_act into can_act from public.venues where id = p_venue;
  return jsonb_build_object('ok', true, 'caseId', cid, 'supportCanAct', can_act, 'reused', false);
end $$;

-- ops_update_case: staff change a case's status or topic. Halom's own record, so the owner's support switch does not
-- apply; the reason is on the audit row, and the owner sees it. p_expected_updated_at: the case's updatedAt as staff
-- read it (SupportCase.updatedAt, full precision); a case changed since answers stale with the case as stored, and
-- nothing is written (two staff pages never overwrite each other's answer). Null: no check (as before).
create function public.ops_update_case(p_case uuid, p_status text default null, p_topic text default null, p_reason text default null,
                                       p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare errs jsonb; at timestamptz;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  errs := app.validate_update_case(jsonb_build_object('caseId', p_case, 'reason', p_reason)
            || case when p_status is null then '{}'::jsonb else jsonb_build_object('status', p_status) end
            || case when p_topic is null then '{}'::jsonb else jsonb_build_object('topic', p_topic) end);
  if jsonb_array_length(errs) > 0 then return app.fail(errs->0->>'code'); end if;
  select updated_at into at from public.support_cases where id = p_case for update;
  if not found then return app.fail('case_unknown'); end if;
  if p_expected_updated_at is not null and at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current', app.case_json(p_case));
  end if;
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.actor', 'staff', true);
  perform set_config('mana.reason', app.strip_blank(p_reason), true);
  update public.support_cases set status = coalesce(p_status, status), topic = coalesce(p_topic, topic) where id = p_case;
  perform set_config('mana.via', '', true);
  perform set_config('mana.actor', '', true);
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
-- givenText: a text column left out takes the table's default (''); given, it is a string (the columns are NOT NULL, so
-- null is type) of at most p_max once its blank edges are stripped
create function app.v_given_text(p_obj jsonb, p_key text, p_path text, p_max integer) returns jsonb language sql immutable set search_path = '' as $$
  select case when not p_obj ? p_key then '[]'::jsonb
              when jsonb_typeof(p_obj->p_key) <> 'string' then app.issue('type', p_path)
              when char_length(app.strip_blank(p_obj->>p_key)) > p_max then app.issue('text_too_long', p_path)
              else '[]'::jsonb end
$$;

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
    errs := errs || app.v_given_text(g, 'label', 'group.label', 60) || app.v_given_text(g, 'name_he', 'group.name_he', 60)
                 || app.v_given_text(g, 'name_en', 'group.name_en', 60);
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
    errs := errs || app.v_given_text(x, 'name_he', at || '.name_he', 60) || app.v_given_text(x, 'name_en', at || '.name_en', 60);
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
    when 'schedules' then (select jsonb_build_object('he', x.name_he, 'en', x.name_en) from public.schedules x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
    -- "taken off", "brought back": the name of what was taken off (its section, dish or option), as it reads now
    when 'availability_overrides' then (
      select app.target_name(p_venue, case x.target_kind when 'section' then 'sections' when 'dish' then 'dishes' when 'option' then 'addon_options'
                                                         when 'group' then 'addon_groups' end, x.target_id::text)
      from public.availability_overrides x where x.id = app.as_uuid(p_id) and x.venue_id = p_venue)
  end
$$;

-- the name of something an availability action names by id alone: a section, dish, add-on option or group of the venue
create function app.menu_node_name(p_venue uuid, p_id text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(app.target_name(p_venue, 'dishes', p_id), app.target_name(p_venue, 'sections', p_id),
                  app.target_name(p_venue, 'addon_options', p_id), app.target_name(p_venue, 'addon_groups', p_id))
$$;

-- `you`: the reader made the change. The actor's id never leaves: Halom's staff are never named to the owner.
-- targetName: the row's one target as it reads now; for Halom's act_for_owner row, what the action names first (the
-- target taken off or brought back, the dish changed)
create function app.activity_entry(p_row public.activity_log, p_viewer uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p_row.id, 'at', app.iso(p_row.at), 'actorKind', p_row.actor_kind, 'you', coalesce(p_row.actor_id = p_viewer, false),
    'via', p_row.via, 'action', p_row.action, 'targetTable', p_row.target_table, 'targetIds', to_jsonb(p_row.target_ids), 'n', p_row.n,
    'targetName', case
      when p_row.action = 'support.act_for_owner' and p_row.detail->>'action' in ('availability.set', 'availability.restore')
        then app.menu_node_name(p_row.venue_id, p_row.target_ids[1])
      when p_row.action = 'support.act_for_owner' and p_row.detail->>'action' = 'dish.update' then app.target_name(p_row.venue_id, 'dishes', p_row.target_ids[1])
      when cardinality(p_row.target_ids) = 1 then app.target_name(p_row.venue_id, p_row.target_table, p_row.target_ids[1]) end,
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
  -- a staff member's export is Halom's, whatever venue they also belong to (SEC-L3)
  if app.is_staff() then perform set_config('mana.actor', 'staff', true); end if;
  perform app.log(p_venue, 'menu.export', 'venues', array[p_venue::text], jsonb_build_object('counts', counts));
  perform set_config('mana.via', '', true);
  perform set_config('mana.actor', '', true);
  return out;
end $$;

-- ================================================================ the client dashboard v2 (F08, ClientDashboard)
-- totals, opens by source and language, top dishes, for local days p_from..p_to (counted as the venue counts: demo
-- traffic on a demo venue, real traffic otherwise)
-- (an id read from a rollup key, dish:<id>, is looked up only inside p_venue: another venue may hold a row with the
-- same id, a dish deleted here and made again there, and its name must never show on this venue's dashboard)
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
      join public.dishes d on d.id = z.dish_id and d.venue_id = p_venue), '[]'::jsonb))
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
  select * into v from public.venues where id = p_venue;
  if not found then return app.fail('venue_unknown'); end if;
  select max(number) into latest from public.menu_revisions where venue_id = p_venue;
  select * into r from public.menu_revisions where venue_id = p_venue and number = coalesce(p_revision, latest);
  if not found then return app.fail('revision_unknown'); end if;
  -- (mana.via is set only around the log row: an error path leaves nothing set)
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.actor', 'staff', true);
  perform app.log(p_venue, 'menu.read', 'menu_revisions', array[r.id::text], jsonb_build_object('revision', r.number));
  perform set_config('mana.via', '', true);
  perform set_config('mana.actor', '', true);
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
  if app.member_role(p_venue) is not null then return app.fail('own_venue'); end if;
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.actor', 'staff', true);
  perform set_config('mana.reason', app.strip_blank(p_reason), true);
  update public.venues set is_demo = p_demo where id = p_venue and is_demo is distinct from p_demo;
  perform app.log(p_venue, 'venue.set_demo', 'venues', array[p_venue::text], jsonb_build_object('demo', p_demo), 1, app.strip_blank(p_reason));
  perform set_config('mana.via', '', true);
  perform set_config('mana.actor', '', true);
  perform set_config('mana.reason', '', true);
  return jsonb_build_object('ok', true, 'demo', p_demo);
end $$;

-- ================================================================ staff writes, after the back office's review (SEC-M1, QA)
-- Who an entry names (SEC-L3): a staff-only RPC (ops_approve_venue, ops_set_plan, ops_set_demo, ops_update_case,
-- ops_revision, export_menu by a staff member) and act_for_owner act as Halom, logged 'staff' whatever venue the staff
-- member also belongs to; they say so with mana.actor = 'staff' around their writes and log rows. A staff member who
-- belongs to a venue never approves it, sets its plan or its demo label (own_venue).
create or replace function app.actor_kind(p_venue uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  if (select auth.uid()) is null then return 'system'; end if;
  if (current_setting('mana.via', true) = 'act_for_owner' or current_setting('mana.actor', true) = 'staff') and app.is_staff() then return 'staff'; end if;
  r := app.member_role(p_venue);
  if r is not null then return r; end if;
  if app.is_staff() then return 'staff'; end if;
  return 'system';
end $$;

-- A staff reason is checked like every other reason (app.v_reason, the twin of isReason: 3 to 500 characters once its
-- blank edges are stripped, so zero-width spaces, tabs, NBSPs and the like are not a reason) and stored stripped.

-- ops_approve_venue takes the revision the reviewer looked at: the one guests will see once approved, the number of
-- the venue's published revision (restore_revision moves it back without making a revision, so not simply the newest).
-- Another one answers revision_changed with that number, under the venue row's lock (publishing and restoring take it);
-- nothing published (never, or unpublished since) answers not_published.
-- DESTRUCTIVE-LOOKING: drops public.ops_approve_venue(uuid, text) of 20261015120400_publish_and_rpc.sql; the
-- three-argument version below replaces it (the grants and audit_grants() list follow at the end of this file).
drop function public.ops_approve_venue(uuid, text);
create function public.ops_approve_venue(p_venue uuid, p_reason text, p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; reason text; ends timestamptz; latest integer;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if not app.v_reason(to_jsonb(p_reason)) then return app.fail('reason_required'); end if;
  reason := app.strip_blank(p_reason);
  if p_expected_revision is null or p_expected_revision < 1 then return app.fail('revision_invalid'); end if;
  select * into v from public.venues where id = p_venue and archived_at is null for update;
  if not found then return app.fail('venue_unknown'); end if;
  if app.member_role(p_venue) is not null then return app.fail('own_venue'); end if;
  if v.approved_at is not null then return app.fail('already_approved'); end if;
  if v.first_published_at is null or v.published_revision_id is null then return app.fail('not_published'); end if;
  select r.number into latest from public.menu_revisions r where r.venue_id = p_venue and r.id = v.published_revision_id;
  if latest is distinct from p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'revision_changed', 'revision', latest);
  end if;
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.actor', 'staff', true);
  update public.venues set approved_at = now(), approved_by = (select auth.uid()) where id = p_venue;
  ends := app.start_trial(p_venue);
  perform app.log(p_venue, 'venue.approve', 'venues', array[p_venue::text],
                  jsonb_build_object('trialEndsAt', app.iso(ends), 'revision', latest), 1, reason);
  perform set_config('mana.via', '', true);
  perform set_config('mana.actor', '', true);
  return jsonb_build_object('ok', true, 'trialEndsAt', app.iso(ends));
end $$;

-- ops_set_plan never approves: a venue still waiting for approval answers approval_first for trialing or active
-- (approval happens only through ops_approve_venue). Admins only, as before.
create or replace function public.ops_set_plan(p_venue uuid, p_state text, p_until timestamptz default null, p_reason text default null,
                                               p_plan text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare reason text; v record; n integer;
begin
  if app.staff_role() is distinct from 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;
  if not app.v_reason(to_jsonb(p_reason)) then return app.fail('reason_required'); end if;
  reason := app.strip_blank(p_reason);
  if coalesce(p_state, '') not in ('pending', 'trialing', 'active', 'expired', 'suspended') then return app.fail('state_invalid'); end if;
  if p_plan is not null and p_plan not in ('trial', 'pilot', 'paid') then return app.fail('plan_invalid'); end if;
  if p_until is not null and p_until <= now() and p_state in ('trialing', 'active') then return app.fail('until_in_past'); end if;
  select id, approved_at into v from public.venues where id = p_venue and archived_at is null for update;
  if not found then return app.fail('venue_unknown'); end if;
  if app.member_role(p_venue) is not null then return app.fail('own_venue'); end if;
  if p_state in ('trialing', 'active') and v.approved_at is null then return app.fail('approval_first'); end if;
  perform set_config('mana.via', 'rpc', true);
  perform set_config('mana.actor', 'staff', true);
  update public.entitlements set
    status = p_state,
    plan = coalesce(p_plan, plan),
    trial_started_at = case when p_state = 'trialing' then coalesce(trial_started_at, now()) else trial_started_at end,
    trial_ends_at = case when p_state = 'trialing'
                         then coalesce(p_until, now() + make_interval(days => coalesce((app.cfg('trial_days') #>> '{}')::integer, 30)))
                         else trial_ends_at end,
    current_period_end = case when p_state = 'active' then p_until else current_period_end end
  where venue_id = p_venue;
  get diagnostics n = row_count;
  if n = 0 then
    perform set_config('mana.via', '', true);
    perform set_config('mana.actor', '', true);
    return app.fail('venue_unknown');
  end if;
  perform app.log(p_venue, 'plan.set', 'entitlements', array[p_venue::text],
                  jsonb_build_object('state', p_state, 'plan', p_plan, 'until', app.iso(p_until)), 1, reason);
  perform set_config('mana.via', '', true);
  perform set_config('mana.actor', '', true);
  return jsonb_build_object('ok', true, 'state', app.entitlement_state(p_venue));
end $$;

-- act_for_owner('dish.update', {dishId, patch, expectedUpdatedAt}): staff edit what the owner edits, so the edit names
-- the dish's updated_at the staff member read, to the microsecond; another one (the owner saved meanwhile) answers
-- stale with the dish as it is now and writes nothing (onboarding.set does the same with the step's updatedAt; the
-- availability actions add and end overrides, support_case.update moves a case). A patch that leaves the dish with no
-- name breaks the table's check: payload_invalid.
create or replace function app.afo_dish_update(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  allowed text[] := array['name_he', 'name_en', 'desc_he', 'desc_en', 'price', 'price_note_he', 'price_note_en', 'tags', 'allergens_he',
                          'allergens_en', 'hidden', 'stock_id', 'position'];
  patch jsonb := p->'patch'; k text; expected timestamptz := app.js_instant_exact(p->'expectedUpdatedAt'); d record;
begin
  if not app.uuid_ok(p->'dishId') or jsonb_typeof(patch) is distinct from 'object' or patch = '{}'::jsonb or expected is null then
    raise exception 'payload_invalid';
  end if;
  -- each value of its column's JSON type, as the contracts check it ("3900" is not a price, "yes" not a boolean)
  for k in select jsonb_object_keys(patch) loop
    if not (k = any (allowed)) then raise exception 'payload_invalid'; end if;
    if not (case k
         when 'price' then app.js_null(patch->k) or app.js_int(patch->k)
         when 'hidden' then jsonb_typeof(patch->k) = 'boolean'
         when 'position' then app.js_int(patch->k)
         when 'stock_id' then app.js_null(patch->k) or jsonb_typeof(patch->k) = 'string'
         when 'tags' then jsonb_typeof(patch->k) = 'array' and not exists (select 1 from jsonb_array_elements(patch->k) t where jsonb_typeof(t) <> 'string')
         else jsonb_typeof(patch->k) = 'string' end) then
      raise exception 'payload_invalid';
    end if;
  end loop;
  select * into d from public.dishes where id = (p->>'dishId')::uuid and venue_id = p_venue for update;
  if not found then raise exception 'target_unknown'; end if;
  -- compared to the microsecond: staff send back exactly the updated_at they read
  if d.updated_at <> expected then
    return jsonb_build_object('ok', false, 'code', 'stale', 'action', 'dish.update', 'current', jsonb_build_object(
      'id', d.id, 'updated_at', to_jsonb(d.updated_at), 'name_he', d.name_he, 'name_en', d.name_en, 'desc_he', d.desc_he, 'desc_en', d.desc_en,
      'price', d.price, 'price_note_he', d.price_note_he, 'price_note_en', d.price_note_en, 'tags', to_jsonb(d.tags),
      'allergens_he', d.allergens_he, 'allergens_en', d.allergens_en, 'hidden', d.hidden, 'stock_id', d.stock_id, 'position', d.position));
  end if;
  update public.dishes t set
    name_he = case when patch ? 'name_he' then patch->>'name_he' else t.name_he end,
    name_en = case when patch ? 'name_en' then patch->>'name_en' else t.name_en end,
    desc_he = case when patch ? 'desc_he' then patch->>'desc_he' else t.desc_he end,
    desc_en = case when patch ? 'desc_en' then patch->>'desc_en' else t.desc_en end,
    price = case when patch ? 'price' then (patch->>'price')::integer else t.price end,
    price_note_he = case when patch ? 'price_note_he' then patch->>'price_note_he' else t.price_note_he end,
    price_note_en = case when patch ? 'price_note_en' then patch->>'price_note_en' else t.price_note_en end,
    tags = case when patch ? 'tags' then array(select jsonb_array_elements_text(patch->'tags')) else t.tags end,
    allergens_he = case when patch ? 'allergens_he' then patch->>'allergens_he' else t.allergens_he end,
    allergens_en = case when patch ? 'allergens_en' then patch->>'allergens_en' else t.allergens_en end,
    hidden = case when patch ? 'hidden' then (patch->>'hidden')::boolean else t.hidden end,
    stock_id = case when patch ? 'stock_id' then patch->>'stock_id' else t.stock_id end,
    position = case when patch ? 'position' then (patch->>'position')::integer else t.position end
  where t.id = d.id;
  return jsonb_build_object('dishId', p->>'dishId', 'fields', (select jsonb_agg(k2 order by k2) from jsonb_object_keys(patch) k2));
end $$;

-- act_for_owner('availability.restore', {targetKind, targetId}): a target of this venue (another venue's id, or none:
-- target_unknown, nothing written or logged, like the other actions)
create or replace function app.afo_availability_restore(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if coalesce(p->>'targetKind', '') not in ('section', 'dish', 'option') or not app.uuid_ok(p->'targetId') then raise exception 'payload_invalid'; end if;
  if not (case p->>'targetKind'
       when 'section' then exists (select 1 from public.sections s where s.id = (p->>'targetId')::uuid and s.venue_id = p_venue)
       when 'dish' then exists (select 1 from public.dishes d where d.id = (p->>'targetId')::uuid and d.venue_id = p_venue)
       else exists (select 1 from public.addon_options o where o.id = (p->>'targetId')::uuid and o.venue_id = p_venue) end) then
    raise exception 'target_unknown';
  end if;
  update public.availability_overrides set restored_at = now()
  where venue_id = p_venue and target_kind = p->>'targetKind' and target_id = (p->>'targetId')::uuid
    and restored_at is null and (until_at is null or until_at > now());
  get diagnostics n = row_count;
  return jsonb_build_object('restored', n);
end $$;

-- act_for_owner: the reason checked by app.v_reason and kept stripped; an action that answers {ok: false} (a stale dish
-- or step) writes nothing and is returned as it is. menu.publish is not an action in phase 1 (it would publish the
-- owner's draft unreviewed; staff help with publishing by approving): action_unknown.
create or replace function public.act_for_owner(p_venue uuid, p_reason text, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  reason text;
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v record; res jsonb; log_id bigint; ids text[];
begin
  if (select auth.uid()) is null or app.staff_role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  if not app.v_reason(to_jsonb(p_reason)) then return app.fail('reason_required'); end if;
  reason := app.strip_blank(p_reason);
  -- the owner's switch, read under a share lock: an act waits for a switch change in flight and sees its result
  -- (SEC-L2), and the switch cannot change under an act that is running
  select id, support_can_act into v from public.venues where id = p_venue and archived_at is null for share;
  if not found then return app.fail('venue_unknown'); end if;
  if not v.support_can_act then return app.fail('owner_declined'); end if;
  if coalesce(p_action, '') not in ('availability.set', 'availability.restore', 'dish.update', 'onboarding.set', 'support_case.update') then
    return app.fail('action_unknown');
  end if;
  if jsonb_typeof(payload) <> 'object' then return app.fail('payload_invalid'); end if;

  perform set_config('mana.via', 'act_for_owner', true);
  perform set_config('mana.reason', reason, true);
  begin
    res := case p_action
      when 'availability.set' then app.afo_availability_set(p_venue, payload)
      when 'availability.restore' then app.afo_availability_restore(p_venue, payload)
      when 'dish.update' then app.afo_dish_update(p_venue, payload)
      when 'onboarding.set' then app.afo_onboarding_set(p_venue, payload)
      when 'support_case.update' then app.afo_support_case_update(p_venue, payload)
    end;
    if res->>'ok' = 'false' then
      perform set_config('mana.via', '', true);
      perform set_config('mana.reason', '', true);
      return res;
    end if;
    ids := array_remove(array[payload->>'targetId', payload->>'dishId', payload->>'caseId', res->>'overrideId'], null);
    log_id := app.log(p_venue, 'support.act_for_owner', null, ids,
                      jsonb_strip_nulls(jsonb_build_object(
                        'action', p_action,
                        'keys', (select jsonb_agg(k order by k) from jsonb_object_keys(payload) k),
                        'patchKeys', case when jsonb_typeof(payload->'patch') = 'object'
                                          then (select jsonb_agg(k order by k) from jsonb_object_keys(payload->'patch') k) end,
                        'until', case when jsonb_typeof(payload->'until') = 'object' then payload->'until'->'kind' end,
                        'result', app.loggable(res))), 1, reason);
  exception
    when raise_exception then
      perform set_config('mana.via', '', true);
      perform set_config('mana.reason', '', true);
      return app.fail(sqlerrm);
    when data_exception or integrity_constraint_violation then
      perform set_config('mana.via', '', true);
      perform set_config('mana.reason', '', true);
      return app.fail('payload_invalid');
  end;
  perform set_config('mana.via', '', true);
  perform set_config('mana.reason', '', true);
  return jsonb_build_object('ok', true, 'action', p_action, 'result', res, 'logId', log_id);
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
              created_at, updated_at, raw_purged_at, notes)
  on public.menu_imports to authenticated;
-- DESTRUCTIVE-LOOKING: drops the two policies that let owners and managers insert and change imports directly (no grant
-- reaches them any more; imports_read stays)
drop policy imports_add on public.menu_imports;
drop policy imports_change on public.menu_imports;
-- DESTRUCTIVE-LOOKING: revokes the service role's table INSERT and UPDATE on menu_imports; UPDATE comes back on four columns
revoke insert, update on public.menu_imports from service_role;
grant update (status, error_code, raw_paths, raw_purged_at) on public.menu_imports to service_role;

-- support cases: open_case is the only way to make one (its daily cap and its client id), as for menu_imports.
-- DESTRUCTIVE-LOOKING: revokes the column INSERT of authenticated on support_cases (venue_id, topic, subject, body) and
-- drops the policy cases_open that let owners and managers insert cases directly. No rows change.
revoke insert on public.support_cases from authenticated;
drop policy cases_open on public.support_cases;

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
  public.redeem_staff_invite(text), public.create_staff_invite(text, text), public.ops_overview(),
  public.ops_set_plan(uuid, text, timestamptz, text, text), public.ops_leads(text, text, timestamptz, integer),
  public.ops_update_lead(uuid, text, text, text), public.act_for_owner(uuid, text, text, jsonb) to authenticated;
-- phase 1 (ADR-008): each checks its caller
grant execute on function public.create_import(uuid, text, text, text[], text, boolean, uuid), public.claim_import_scan(uuid, text),
  public.discard_import(uuid), public.set_onboarding_step(uuid, text, text, text[]),
  public.open_case(uuid, text, text, text, boolean, uuid), public.ops_update_case(uuid, text, text, text, timestamptz),
  public.set_availability(uuid, text, uuid, jsonb, text), public.restore_today(uuid), public.export_menu(uuid),
  public.venue_activity(uuid, bigint, integer, text, text), public.ops_venues(jsonb), public.ops_venue(uuid), public.ops_analytics(jsonb),
  public.ops_set_demo(uuid, boolean, text), public.ops_revision(uuid, integer),
  public.save_addon_group(uuid, jsonb, jsonb, timestamptz, boolean), public.save_import_draft(uuid, jsonb, jsonb),
  public.apply_import(uuid, jsonb, jsonb), public.ops_approve_venue(uuid, text, integer) to authenticated;
-- the service role (edge functions) keeps EXECUTE on every function in public, as before; and the three app functions
-- its writes to menu_imports run (the purge's guard and the paths check)
grant execute on all functions in schema public to service_role;
grant execute on function app.import_purgeable(text, timestamptz), app.import_path_ok(uuid, uuid, text), app.import_paths_ok(uuid, uuid, text[])
  to service_role;
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
  'authenticated|column|public.menu_imports.notes|SELECT',
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
  'authenticated|column|public.support_cases.status|UPDATE',
  'authenticated|column|public.support_cases.topic|UPDATE',
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
  'authenticated|function|public.apply_import(uuid,jsonb,jsonb)|EXECUTE',
  'authenticated|function|public.claim_import_scan(uuid,text)|EXECUTE',
  'authenticated|function|public.create_import(uuid,text,text,text[],text,boolean,uuid)|EXECUTE',
  'authenticated|function|public.create_staff_invite(text,text)|EXECUTE',
  'authenticated|function|public.create_venue(text,text,text,text,text)|EXECUTE',
  'authenticated|function|public.discard_import(uuid)|EXECUTE',
  'authenticated|function|public.export_menu(uuid)|EXECUTE',
  'authenticated|function|public.my_dashboard(uuid,text)|EXECUTE',
  'authenticated|function|public.open_case(uuid,text,text,text,boolean,uuid)|EXECUTE',
  'authenticated|function|public.ops_analytics(jsonb)|EXECUTE',
  'authenticated|function|public.ops_approve_venue(uuid,text,integer)|EXECUTE',
  'authenticated|function|public.ops_leads(text,text,timestamp with time zone,integer)|EXECUTE',
  'authenticated|function|public.ops_overview()|EXECUTE',
  'authenticated|function|public.ops_revision(uuid,integer)|EXECUTE',
  'authenticated|function|public.ops_set_demo(uuid,boolean,text)|EXECUTE',
  'authenticated|function|public.ops_set_plan(uuid,text,timestamp with time zone,text,text)|EXECUTE',
  'authenticated|function|public.ops_update_case(uuid,text,text,text,timestamp with time zone)|EXECUTE',
  'authenticated|function|public.ops_update_lead(uuid,text,text,text)|EXECUTE',
  'authenticated|function|public.ops_venue(uuid)|EXECUTE',
  'authenticated|function|public.ops_venues(jsonb)|EXECUTE',
  'authenticated|function|public.preview_menu(uuid)|EXECUTE',
  'authenticated|function|public.public_menu(text)|EXECUTE',
  'authenticated|function|public.publish_menu(uuid,text)|EXECUTE',
  'authenticated|function|public.redeem_staff_invite(text)|EXECUTE',
  'authenticated|function|public.restore_revision(uuid,integer)|EXECUTE',
  'authenticated|function|public.restore_today(uuid)|EXECUTE',
  'authenticated|function|public.save_import_draft(uuid,jsonb,jsonb)|EXECUTE',
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
