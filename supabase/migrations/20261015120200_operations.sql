-- Mana, clean schema 4/8: operations. Onboarding progress, menu imports, support cases, the append-only activity log
-- (with the audit triggers that fill it), and Mana's own leads.

-- ---------------------------------------------------------------- onboarding: one row per step, saved at every step (F03)
create table public.onboarding_progress (
  venue_id uuid not null references public.venues (id) on delete cascade,
  step text not null check (step in ('venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish')),
  state text not null default 'todo' check (state in ('todo', 'doing', 'done', 'skipped', 'blocked')),
  blockers text[] not null default '{}' check (cardinality(blockers) <= 20),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (venue_id, step)
);
alter table public.onboarding_progress enable row level security;
comment on column public.onboarding_progress.blockers is 'Machine words (e.g. dish_without_price, group_without_limits), shown as nudges; never free text.';
create trigger onboarding_touch before update on public.onboarding_progress for each row execute function app.touch();

create function app.guard_onboarding() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.venue_id <> old.venue_id or new.step <> old.step) then raise exception 'step_fixed'; end if;
  if exists (select 1 from unnest(new.blockers) b where b !~ '^[a-z][a-z0-9_]{1,40}$') then raise exception 'blocker_invalid'; end if;
  new.updated_by := (select auth.uid());
  return new;
end $$;
create trigger onboarding_guard before insert or update on public.onboarding_progress for each row execute function app.guard_onboarding();

-- ---------------------------------------------------------------- menu imports (scan, paste, the venue's own Wolt screenshots or text; D33)
-- The raw input stays private (members and Halom staff only). The scanner (an edge function with the service role)
-- writes the parsed draft and its exceptions; nothing reaches the menu until the owner applies it.
create table public.menu_imports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  source text not null check (source in ('scan', 'paste', 'wolt_screenshots', 'wolt_text')),
  status text not null default 'uploaded' check (status in ('uploaded', 'parsing', 'parsed', 'failed', 'applied', 'discarded')),
  raw_paths text[] not null default '{}' check (cardinality(raw_paths) <= 20),
  raw_text text check (raw_text is null or char_length(raw_text) <= 60000),
  input_sha256 text check (input_sha256 is null or input_sha256 ~ '^[0-9a-f]{64}$'),
  rights_confirmed boolean not null default false,
  parsed jsonb check (parsed is null or (jsonb_typeof(parsed) = 'object' and pg_column_size(parsed) < 400000)),
  exceptions jsonb not null default '[]' check (jsonb_typeof(exceptions) = 'array' and jsonb_array_length(exceptions) <= 2000),
  error_code text check (error_code is null or error_code ~ '^[a-z][a-z0-9_]{1,40}$'),
  created_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  check ((source in ('paste', 'wolt_text')) = (raw_text is not null)),
  check ((source in ('scan', 'wolt_screenshots')) = (cardinality(raw_paths) > 0))
);
alter table public.menu_imports enable row level security;
comment on column public.menu_imports.rights_confirmed is 'D33: photos from Wolt are kept only when the owner confirms they own them.';
create index menu_imports_venue_idx on public.menu_imports (venue_id, created_at desc);
-- re-importing the same input finds the earlier import instead of duplicating it (Hopa test 1): one live import per input
create unique index menu_imports_input_idx on public.menu_imports (venue_id, input_sha256)
  where input_sha256 is not null and status <> 'discarded';
create trigger menu_imports_touch before update on public.menu_imports for each row execute function app.touch();

-- clients move an import only from parsed to applied or discarded; the scanner (service role) does the rest
create function app.guard_import() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from unnest(new.raw_paths) rp where app.path_venue(rp) is distinct from new.venue_id) then
      raise exception 'path_of_other_venue';
    end if;
    new.created_by := (select auth.uid());
    if current_user in ('anon', 'authenticated') then
      if new.status <> 'uploaded' or new.parsed is not null or new.exceptions <> '[]'::jsonb or new.applied_at is not null then
        raise exception 'import_bad_start';
      end if;
    end if;
    return new;
  end if;
  if new.venue_id <> old.venue_id or new.source <> old.source or new.raw_paths <> old.raw_paths
     or new.raw_text is distinct from old.raw_text or new.input_sha256 is distinct from old.input_sha256 then
    raise exception 'import_input_fixed';
  end if;
  new.created_by := old.created_by;
  if current_user in ('anon', 'authenticated') and new.status <> old.status then
    if not (old.status = 'parsed' and new.status in ('applied', 'discarded'))
       and not (old.status in ('uploaded', 'failed') and new.status = 'discarded') then
      raise exception 'import_transition';
    end if;
  end if;
  if new.status = 'applied' and old.status <> 'applied' then new.applied_at := now(); end if;
  return new;
end $$;
create trigger menu_imports_guard before insert or update on public.menu_imports for each row execute function app.guard_import();

-- ---------------------------------------------------------------- support cases (the client app's "get help"; F03, F09)
create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete restrict,
  topic text not null default 'other' check (topic in ('onboarding', 'import', 'menu', 'photos', 'account', 'other')),
  status text not null default 'open' check (status in ('open', 'waiting_owner', 'waiting_halom', 'resolved')),
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null default '' check (char_length(body) <= 4000),
  opened_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id)
);
alter table public.support_cases enable row level security;
create index support_cases_open_idx on public.support_cases (status, created_at desc) where status <> 'resolved';
create index support_cases_venue_idx on public.support_cases (venue_id, created_at desc);
create trigger support_cases_touch before update on public.support_cases for each row execute function app.touch();
create trigger support_cases_clean before insert or update on public.support_cases for each row execute function app.strip_text('subject', 'body');

create function app.guard_case() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.opened_by := (select auth.uid());
    new.status := 'open';
    new.resolved_at := null;
    return new;
  end if;
  if new.venue_id <> old.venue_id or new.subject <> old.subject or new.body <> old.body or new.opened_by is distinct from old.opened_by
     or new.created_at <> old.created_at then
    raise exception 'case_fixed';
  end if;
  new.resolved_at := case when new.status = 'resolved' then coalesce(old.resolved_at, now()) end;
  return new;
end $$;
create trigger support_cases_guard before insert or update on public.support_cases for each row execute function app.guard_case();

-- ---------------------------------------------------------------- the activity log: append-only, shown to the owner (F08, F11, D25)
-- Every write to a venue's menu, settings, availability and records lands here, by whom (owner, manager, counter,
-- Halom staff, the system), how (directly, through a function, or as Halom acting for the owner with a reason), and
-- when. Never updated, never deleted: a trigger refuses it even for the database owner.
create table public.activity_log (
  id bigint generated always as identity primary key,
  venue_id uuid references public.venues (id) on delete restrict,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('owner', 'manager', 'counter', 'staff', 'system')),
  via text not null check (via in ('direct', 'rpc', 'act_for_owner', 'system')),
  reason text check (reason is null or char_length(reason) between 1 and 500),
  action text not null check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and char_length(action) <= 80),
  target_table text check (target_table is null or target_table ~ '^[a-z][a-z0-9_]{1,62}$'),
  target_ids text[] not null default '{}' check (cardinality(target_ids) <= 500),
  n integer not null default 1 check (n >= 0),
  detail jsonb not null default '{}' check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 16000),
  check (via <> 'act_for_owner' or reason is not null)
);
alter table public.activity_log enable row level security;
comment on column public.activity_log.actor_id is 'auth.users id, kept as a plain value (no foreign key) so the record outlives the account.';
create index activity_venue_idx on public.activity_log (venue_id, at desc);
create index activity_support_idx on public.activity_log (at desc) where via = 'act_for_owner';
create trigger activity_log_append_only before update or delete on public.activity_log for each row execute function app.append_only();
create trigger activity_log_no_truncate before truncate on public.activity_log for each statement execute function app.append_only();

-- How the current statement reached the database: set (transaction-local) by act_for_owner and by the RPCs.
-- The marker is a transaction-local setting; it counts as act_for_owner only for Halom staff (an owner who managed to set
-- it would still be logged as themselves, directly).
create function app.via() returns text language sql stable security definer set search_path = '' as $$
  select case
    when current_setting('mana.via', true) = 'act_for_owner' and app.is_staff() then 'act_for_owner'
    when current_setting('mana.via', true) = 'rpc' and (select auth.uid()) is not null then 'rpc'
    when (select auth.uid()) is null then 'system'
    else 'direct' end
$$;

-- p_reason: a staff action outside act_for_owner that still needs a reason (approve a venue, set a plan). Reasons are
-- shown to the owner and must not contain personal data.
create function app.log(p_venue uuid, p_action text, p_target_table text default null, p_target_ids text[] default '{}',
                        p_detail jsonb default '{}', p_n integer default 1, p_reason text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_via text := app.via(); v_id bigint;
begin
  insert into public.activity_log (venue_id, actor_id, actor_kind, via, reason, action, target_table, target_ids, n, detail)
  values (p_venue, (select auth.uid()), case when p_venue is null then (case when app.is_staff() then 'staff' else 'system' end) else app.actor_kind(p_venue) end,
          v_via, coalesce(nullif(btrim(coalesce(p_reason, '')), ''), case when v_via = 'act_for_owner' then nullif(current_setting('mana.reason', true), '') end),
          p_action, p_target_table, coalesce(p_target_ids, '{}'), coalesce(p_n, 1), coalesce(p_detail, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- Columns never copied into the log's detail (free text a person typed, raw imports, large documents, bookkeeping).
create function app.audit_hidden(p_col text) returns boolean language sql immutable set search_path = '' as $$
  select p_col in ('raw_text', 'raw_paths', 'parsed', 'exceptions', 'body', 'subject', 'details', 'meta', 'provenance', 'windows',
                   'note', 'notes', 'created_at', 'updated_at', 'until_spec', 'blockers', 'scope_ids', 'basket_has_dishes',
                   'basket_has_sections', 'basket_lacks_dishes', 'basket_lacks_sections',
                   -- personal data of leads never leaves the leads table
                   'contact', 'name', 'message', 'venue_name', 'source_hash', 'client_token')
$$;

-- Columns whose change alone is not an activity (publish and review bookkeeping: publish_menu and ops_approve_venue
-- log those themselves; the daily job forgetting a lead's source hash).
create function app.audit_ignored(p_col text) returns boolean language sql immutable set search_path = '' as $$
  select p_col in ('updated_at', 'published_revision_id', 'first_published_at', 'last_published_at', 'approved_at', 'approved_by',
                   'source_hash')
$$;

-- Which values the log may copy. Numbers, booleans and nulls always; text only for columns that hold ids, codes,
-- times, dates and paths (an allow-list, so a new free-text column is never copied by accident). Names, descriptions,
-- lines, notes and anything else a person typed are recorded as "this column changed", never with the words.
create function app.audit_value_ok(p_col text, p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case
    when app.audit_hidden(p_col) or app.audit_ignored(p_col) then false
    when jsonb_typeof(coalesce(p, 'null'::jsonb)) in ('number', 'boolean', 'null') then true
    when jsonb_typeof(p) = 'string' then char_length(p #>> '{}') <= 200 and p_col ~ ('^(id|[a-z_]+_id|slug|kind|mode|role|status|state|step|scene|room'
      || '|selection|trigger|scope_kind|suggest_kind|target_kind|until_kind|created_by_kind|topic|plan|source|sold_out_display|default_lang'
      || '|time_zone|currency|accent|surface|template|relief_class|error_code|[a-z_]+_at|[a-z_]+_date|valid_from|valid_to|opens|closes'
      || '|from_time|to_time|[a-z_]+_path|weekday)$')
    else false end
$$;

-- A row's identity, whatever its key: id, else (venue_id / user_id / step), else venue_id.
create function app.row_key(p jsonb) returns text language sql immutable set search_path = '' as $$
  select coalesce(p->>'id', nullif(concat_ws('/', p->>'venue_id', p->>'user_id', p->>'step'), ''))
$$;

-- The loggable fields of a row, for a one-row log entry ("dish off until 14:30", "price 6800", never the words).
create function app.audit_scalars(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from jsonb_each(p) e(k, v)
  where jsonb_typeof(v) <> 'null' and app.audit_value_ok(k, v)
$$;

-- One log row per venue per statement (a bulk import of 200 dishes is one row with n = 200, not 200 rows).
-- tg_argv[0] = the column that holds the venue id ('venue_id', 'id' for venues, 'none' for Halom-wide tables).
-- A one-row insert or delete carries the row's short fields; an update lists the columns that changed and, for one
-- row, their old and new values.
create function app.audit_rows() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  vcol text := coalesce(tg_argv[0], 'venue_id');
  op text := lower(tg_op);
  r record;
begin
  if tg_op = 'INSERT' then
    for r in
      select (x.j->>vcol)::uuid as venue_id, array_agg(app.row_key(x.j)) as ids, count(*)::integer as n,
             case when count(*) = 1 then app.audit_scalars((array_agg(x.j))[1]) else '{}'::jsonb end as detail
      from (select to_jsonb(t) as j from new_rows t) x
      group by 1
    loop
      perform app.log(r.venue_id, tg_table_name || '.' || op, tg_table_name, r.ids[1:500], r.detail, r.n);
    end loop;
  elsif tg_op = 'DELETE' then
    for r in
      select (x.j->>vcol)::uuid as venue_id, array_agg(app.row_key(x.j)) as ids, count(*)::integer as n,
             case when count(*) = 1 then app.audit_scalars((array_agg(x.j))[1]) else '{}'::jsonb end as detail
      from (select to_jsonb(t) as j from old_rows t) x
      group by 1
    loop
      -- a venue's content goes with its venue: those deletes are not activity of a venue that no longer exists
      continue when r.venue_id is not null and not exists (select 1 from public.venues v where v.id = r.venue_id);
      perform app.log(r.venue_id, tg_table_name || '.' || op, tg_table_name, r.ids[1:500], r.detail, r.n);
    end loop;
  else
    for r in
      with pairs as (
        select (to_jsonb(n)->>vcol)::uuid as venue_id, app.row_key(to_jsonb(n)) as id, to_jsonb(o) as o, to_jsonb(n) as n
        from new_rows n join old_rows o on app.row_key(to_jsonb(n)) = app.row_key(to_jsonb(o))
      ),
      changed as (
        select p.venue_id, p.id, k.key, p.o->k.key as before, p.n->k.key as after
        from pairs p cross join lateral jsonb_object_keys(p.n) k(key)
        where p.n->k.key is distinct from p.o->k.key and not app.audit_ignored(k.key)
      )
      select c.venue_id, array_agg(distinct c.id) as ids, count(distinct c.id)::integer as n,
             array_agg(distinct c.key order by c.key) as cols,
             case when count(distinct c.id) = 1 then
               coalesce(jsonb_object_agg(c.key, jsonb_build_array(c.before, c.after))
                 filter (where app.audit_value_ok(c.key, c.before) and app.audit_value_ok(c.key, c.after)), '{}'::jsonb)
             end as changes
      from changed c group by c.venue_id
    loop
      perform app.log(r.venue_id, tg_table_name || '.update', tg_table_name, r.ids[1:500],
                      jsonb_strip_nulls(jsonb_build_object('columns', to_jsonb(r.cols), 'changes', r.changes)), r.n);
    end loop;
  end if;
  return null;
end $$;

-- attach the audit to every table whose writes the owner should see
do $$
declare t text; vcol text; op text;
begin
  foreach t in array array['venues', 'venue_members', 'staff', 'entitlements', 'schedules', 'sections', 'dishes', 'assets',
                           'addon_groups', 'addon_options', 'dish_addon_groups', 'dish_relations', 'upsell_rules',
                           'venue_hours', 'venue_closures', 'availability_overrides', 'onboarding_progress', 'menu_imports',
                           'support_cases'] loop
    vcol := case t when 'venues' then 'id' when 'staff' then 'none' else 'venue_id' end;
    foreach op in array array['insert', 'update', 'delete'] loop
      if t = 'venues' and op <> 'update' then continue; end if;     -- create_venue logs the creation; venues are archived, not deleted
      execute format('create trigger %I after %s on public.%I referencing %s table as %s for each statement execute function app.audit_rows(%L)',
                     t || '_audit_' || op, op, t,
                     case op when 'insert' then 'new' when 'delete' then 'old' else 'old table as old_rows new' end,
                     case op when 'delete' then 'old_rows' else 'new_rows' end, vcol);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------- Mana's own leads (the product page's "talk to us")
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  client_token uuid not null unique,
  source text not null default 'mana-landing' check (source ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  message text not null check (char_length(message) between 3 and 4000),
  contact text not null check (char_length(contact) between 5 and 200),
  name text check (name is null or char_length(name) <= 120),
  venue_name text check (venue_name is null or char_length(venue_name) <= 120),
  locale text check (locale is null or locale in ('he', 'en')),
  source_hash text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'onboarding', 'won', 'lost', 'spam')),
  owner text check (owner is null or char_length(owner) <= 80),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leads enable row level security;
comment on table public.leads is 'Personal data (a contact). Halom staff only; written by submit_lead.';
create sequence public.lead_ref_seq;
create index leads_created_idx on public.leads (created_at desc);
create index leads_source_idx on public.leads (source_hash, created_at desc);
create trigger leads_touch before update on public.leads for each row execute function app.touch();
-- staff working a lead is activity (status, owner); the personal fields are never copied into the log (audit_hidden)
create trigger leads_audit_update after update on public.leads referencing old table as old_rows new table as new_rows
  for each statement execute function app.audit_rows('none');
