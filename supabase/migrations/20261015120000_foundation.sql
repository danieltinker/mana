-- Mana, clean schema 1/6: foundation. Settings, venues, the people who work in them, Halom staff, entitlements and the
-- role helpers every policy uses.
--
-- For the Supabase project `mana` only (never `halom-studio`). Designed from what db/0001–0007 taught, not replayed.
-- Conventions for every file:
--   * RLS is enabled on every table the moment it exists. WHO may read or write WHAT is written in one place:
--     20261015120500_access.sql. Tables here have no policies until then, so nothing is reachable in between.
--   * Money is integer agorot, VAT included. Times are timestamptz; venue-local time uses venues.time_zone.
--   * Helpers, guards and jobs live in the schema `app`, which the API does not expose (PostgREST serves `public`).
--   * Every SECURITY DEFINER function pins search_path = '' and names every object with its schema.
--   * ON DELETE is deliberate: menu content cascades from its venue; records that must be kept (activity log,
--     published revisions, support cases, events, entitlements) RESTRICT, so a venue with history is archived
--     (venues.archived_at), never deleted by accident.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
comment on schema app is 'Mana internals: role helpers, guards, snapshot builder, jobs. Not exposed through the API.';
revoke all on schema app from public;

-- ---------------------------------------------------------------- settings (never readable through the API)
create table public.app_config (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
comment on table public.app_config is 'Per-environment settings. public_base must be set per environment (see supabase/README.md).';

insert into public.app_config (key, value) values
  -- the public storage address assets are served from, ending in "/"; set per environment after the migrations
  ('public_base', 'null'),
  ('trial_days', '30'),
  ('vat_basis_points', '1800'),
  ('limits', '{"venues_per_user": 5, "sections": 40, "dishes": 400, "addon_groups": 200, "options_per_group": 30, "groups_per_dish": 8, "related": 6, "rules": 50, "schedules": 20, "closures": 60, "hours": 21, "attempts": 5}'),
  ('event_caps', '{"per_source_hour": 600, "per_venue_day": 50000}'),
  ('event_retention_months', '13'),
  ('source_salt', to_jsonb(encode(extensions.gen_random_bytes(24), 'hex'))),
  ('reserved_slugs', '["admin","api","app","studio","view","gen","ops","demo","halom","menu","menus","mana","www","test","help","support","login","signup","new","null","undefined","m","static","assets"]');

create function app.cfg(p_key text) returns jsonb
language sql stable security definer set search_path = '' as
$$ select value from public.app_config where key = p_key $$;

create function app.touch() returns trigger language plpgsql set search_path = '' as
$$ begin new.updated_at := now(); return new; end $$;

-- Who is sending (for per-source caps only): a hash of the caller's address with a salt that changes every day, so it
-- cannot follow anyone from one day to the next. Never stored with an event.
create function app.request_source() returns text
language plpgsql stable security definer set search_path = '' as $$
declare h json; ip text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1));
  if ip = '' then ip := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', 'unknown'); end if;
  return encode(extensions.digest(ip || '|' || coalesce(app.cfg('source_salt')#>>'{}', '') || '|' || current_date::text, 'sha256'), 'hex');
end $$;

-- ---------------------------------------------------------------- venues
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name_he text not null default '' check (char_length(name_he) <= 80),
  name_en text not null default '' check (char_length(name_en) <= 80),
  area_he text not null default '' check (char_length(area_he) <= 80),
  area_en text not null default '' check (char_length(area_en) <= 80),
  cuisine_he text not null default '' check (char_length(cuisine_he) <= 80),
  cuisine_en text not null default '' check (char_length(cuisine_en) <= 80),
  kind text not null default 'restaurant' check (kind in ('restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other')),
  mode text not null default 'view_only' check (mode in ('view_only', 'standalone', 'companion')),
  default_lang text not null default 'he' check (default_lang in ('he', 'en')),
  langs text[] not null default '{he,en}' check (langs <@ array['he', 'en']::text[] and cardinality(langs) between 1 and 2),
  time_zone text not null default 'Asia/Jerusalem' check (char_length(time_zone) between 1 and 64),
  currency text not null default 'ILS' check (currency in ('ILS')),
  accent text not null default '#c8743c' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  surface text not null default 'oak' check (surface ~ '^[a-z][a-z-]{1,24}$'),
  template text check (template is null or template ~ '^[a-z0-9-]{1,40}$'),
  logo_path text check (logo_path is null or char_length(logo_path) <= 200),
  table_img_path text check (table_img_path is null or char_length(table_img_path) <= 200),
  order_url text check (order_url is null or (order_url ~ '^https://\S+$' and char_length(order_url) <= 300)),
  book_url text check (book_url is null or (book_url ~ '^https://\S+$' and char_length(book_url) <= 300)),
  phone text check (phone is null or char_length(phone) <= 40),
  sold_out_display text not null default 'bottom' check (sold_out_display in ('bottom', 'hide')),
  support_can_act boolean not null default true,
  is_demo boolean not null default false,
  published_revision_id uuid,
  first_published_at timestamptz,
  last_published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (name_he <> '' or name_en <> ''),
  check (default_lang = any (langs))
);
alter table public.venues enable row level security;
comment on column public.venues.slug is 'Permanent: QR codes encode it. A trigger refuses any change.';
comment on column public.venues.mode is 'Which flows exist: view_only (menu), standalone (Mana orders and payments, phase 2-3), companion (beside a POS, later).';
comment on column public.venues.support_can_act is 'The owner''s switch for Halom''s logged "act for owner" (D25).';
comment on column public.venues.is_demo is 'Demo venues are labelled everywhere and left out of real totals. Set by Halom only.';
create trigger venues_touch before update on public.venues for each row execute function app.touch();

create function app.guard_venue() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id then raise exception 'id_fixed'; end if;
    if new.slug <> old.slug then raise exception 'slug_permanent'; end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  begin
    perform now() at time zone new.time_zone;
  exception when others then
    raise exception 'time_zone_invalid';
  end;
  return new;
end $$;
create trigger venues_guard before insert or update on public.venues for each row execute function app.guard_venue();

-- ---------------------------------------------------------------- who works in a venue
create table public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'counter')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);
alter table public.venue_members enable row level security;
create index venue_members_user_idx on public.venue_members (user_id);
comment on column public.venue_members.role is 'owner: everything in the venue; manager: menu, hours, availability, publish; counter: reads the menu and sets availability only.';

-- ---------------------------------------------------------------- Halom staff
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('support', 'admin')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
comment on table public.staff is 'Halom staff read across venues; they write into a venue only through act_for_owner (logged, with a reason).';

create table public.staff_invites (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('support', 'admin')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);
alter table public.staff_invites enable row level security;

-- ---------------------------------------------------------------- plan and trial (minimal; billing is phase 3)
create table public.entitlements (
  venue_id uuid primary key references public.venues (id) on delete restrict,
  plan text not null default 'trial' check (plan in ('trial', 'pilot', 'paid')),
  status text not null default 'pending' check (status in ('pending', 'trialing', 'active', 'expired', 'suspended')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create trigger entitlements_touch before update on public.entitlements for each row execute function app.touch();

-- what the stored row means right now: pending | trialing | active | expired | suspended
create function app.entitlement_state(p_venue uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when e.status = 'trialing' and e.trial_ends_at is not null and e.trial_ends_at < now() then 'expired'
    when e.status = 'active' and e.current_period_end is not null and e.current_period_end < now() then 'expired'
    else e.status end
  from public.entitlements e where e.venue_id = p_venue
$$;

-- ---------------------------------------------------------------- role helpers (used by every policy)
create function app.member_role(p_venue uuid) returns text
language sql stable security definer set search_path = '' as
$$ select m.role from public.venue_members m where m.venue_id = p_venue and m.user_id = (select auth.uid()) $$;

create function app.is_member(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.user_id = (select auth.uid())) $$;

create function app.is_owner(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.user_id = (select auth.uid()) and m.role = 'owner') $$;

-- owner or manager: edits the menu, hours and settings
create function app.can_edit(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager')) $$;

-- owner, manager or counter: sets what is available now
create function app.can_operate(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager', 'counter')) $$;

create function app.staff_role() returns text
language sql stable security definer set search_path = '' as
$$ select s.role from public.staff s where s.user_id = (select auth.uid()) $$;

create function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.staff s where s.user_id = (select auth.uid())) $$;

-- reads the venue's menu and settings: any member, or Halom staff
create function app.can_read(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select app.is_member(p_venue) or app.is_staff() $$;

-- reads the venue's records (activity, revisions, imports, cases, numbers): owner, manager, or Halom staff
create function app.can_see_records(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select app.can_edit(p_venue) or app.is_staff() $$;

-- a storage path starts with the venue id: "<venue uuid>/..."
create function app.path_venue(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;
