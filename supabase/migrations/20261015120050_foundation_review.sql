-- Mana, clean schema 2/8: the review of 1/8 (20261015120000_foundation.sql, which is ALREADY APPLIED to the project
-- `mana` and therefore never edited; its header still says "1/6"). Every change to the foundation's objects after the
-- QA and security reviews of 15 Oct 2026 lives here, as create-or-replace and alter statements.
--
--   * one definition of "blank" (QA M1): app.blank_class(), app.strip_blank(), the app.strip_text() trigger; venues'
--     names are stripped on write
--   * the request source (Sec M1, L8): cf-connecting-ip, then x-real-ip, then the LAST X-Forwarded-For entry (never
--     the leftmost, which the caller writes); a random salt per day, kept two days
--   * settings: lower per-source event cap, a per-(venue, source) daily cap, lead caps, the review switches
--   * staff invites bound to an e-mail, a failure counter, optional MFA for staff (Sec M3)
--   * venues: Halom's approval of the first publish (Sec M4); logo and table photo paths inside the venue's folder (L2)

-- ---------------------------------------------------------------- blank: the same list as packages/contracts BLANK_CLASS
create function app.blank_class() returns text language sql immutable set search_path = '' as
$$ select '[\u0009-\u000D \u0085  ᠎ -‏ -  -⁤⁦-⁩　﻿]' $$;

create function app.strip_blank(p text) returns text language sql immutable set search_path = '' as
$$ select regexp_replace(p, '^' || app.blank_class() || '+|' || app.blank_class() || '+$', '', 'g') $$;

-- BEFORE trigger: strips blank characters at both ends of the text columns named in tg_argv (names, descriptions).
-- A name that is nothing but blanks becomes '' and the table's "a name in one language" check refuses it.
create function app.strip_text() returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new); patch jsonb := '{}'; c text;
begin
  foreach c in array tg_argv loop
    if jsonb_typeof(j->c) = 'string' and (j->>c) is distinct from app.strip_blank(j->>c) then
      patch := patch || jsonb_build_object(c, app.strip_blank(j->>c));
    end if;
  end loop;
  if patch <> '{}'::jsonb then new := jsonb_populate_record(new, patch); end if;
  return new;
end $$;

create trigger venues_clean before insert or update on public.venues
  for each row execute function app.strip_text('name_he', 'name_en', 'area_he', 'area_en', 'cuisine_he', 'cuisine_en');

-- ---------------------------------------------------------------- the request source
create table app.source_salts (
  day date primary key,
  salt text not null check (salt ~ '^[0-9a-f]{48}$')
);
alter table app.source_salts enable row level security;
comment on table app.source_salts is 'One random salt per UTC day for app.request_source(); the daily job deletes salts older than two days.';

-- Who is sending, for caps only: a hash of the caller's address with today's random salt, so it cannot follow anyone
-- from one day to the next. The address is the one our edge put there: cf-connecting-ip, then x-real-ip, then the LAST
-- X-Forwarded-For entry (the hop nearest to us); never the leftmost entry, which any caller can write.
create or replace function app.request_source() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare h json; ip text; xff text[]; d date := (now() at time zone 'UTC')::date; s text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := nullif(btrim(coalesce(h->>'cf-connecting-ip', '')), '');
  if ip is null then ip := nullif(btrim(coalesce(h->>'x-real-ip', '')), ''); end if;
  if ip is null and coalesce(h->>'x-forwarded-for', '') <> '' then
    xff := string_to_array(h->>'x-forwarded-for', ',');
    ip := nullif(btrim(xff[cardinality(xff)]), '');
  end if;
  ip := left(coalesce(ip, 'unknown'), 100);
  select salt into s from app.source_salts where day = d;
  if s is null then
    insert into app.source_salts (day, salt) values (d, encode(extensions.gen_random_bytes(24), 'hex')) on conflict (day) do nothing;
    select salt into s from app.source_salts where day = d;
  end if;
  return encode(extensions.digest(ip || '|' || s, 'sha256'), 'hex');
end $$;

-- ---------------------------------------------------------------- settings
delete from public.app_config where key = 'source_salt';                                  -- replaced by app.source_salts
update public.app_config set key = 'events_retention_months', updated_at = now() where key = 'event_retention_months';
update public.app_config
   set value = jsonb_build_object(
         'per_source_hour', 300,                                                          -- was 600
         'per_venue_source_day', 1500,                                                     -- new: one source, one venue, one day
         'per_venue_day', coalesce((value->>'per_venue_day')::integer, 50000)),
       updated_at = now()
 where key = 'event_caps';
insert into public.app_config (key, value) values
  ('events_retention_months', '13'),
  -- leads: past per_source_hour a lead is kept but marked spam; past hard_day nothing more is stored that day
  ('lead_caps', '{"per_source_hour": 5, "hard_day": 2000}'),
  -- staff sessions must be MFA (aal2) to count as staff; turn on once the back office has its MFA screen
  ('staff_require_aal2', 'false'),
  -- a venue's first publish waits for Halom (ops_approve_venue) before guests see it; until Daniel decides
  ('publish_requires_approval', 'true'),
  -- create_venue needs a confirmed e-mail address
  ('require_confirmed_email', 'true'),
  ('staff_invite_max_failures', '5')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- staff: invites bound to an e-mail, failures counted, MFA when required
alter table public.staff_invites add column email text;
update public.staff_invites i set email = lower(u.email) from auth.users u where u.id = i.used_by and i.email is null;
delete from public.staff_invites where email is null;              -- an invite nobody can be bound to is void
alter table public.staff_invites alter column email set not null;
alter table public.staff_invites add constraint staff_invites_email_ck
  check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
comment on column public.staff_invites.email is 'The invite redeems only for a signed-in user whose confirmed auth e-mail is this address.';

create table app.staff_invite_failures (
  user_id uuid not null,
  day date not null,
  n integer not null default 0,
  primary key (user_id, day)
);
alter table app.staff_invite_failures enable row level security;

create or replace function app.staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select s.role from public.staff s
  where s.user_id = (select auth.uid())
    and (app.cfg('staff_require_aal2') is distinct from 'true'::jsonb or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2')
$$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as
$$ select app.staff_role() is not null $$;

-- ---------------------------------------------------------------- venues: Halom's approval; pictures inside the venue's folder
alter table public.venues add column approved_at timestamptz;
alter table public.venues add column approved_by uuid references auth.users (id) on delete set null;
comment on column public.venues.approved_at is 'When Halom approved the first publish (ops_approve_venue), or when it was published while approval was off. Guests see nothing before.';

alter table public.venues add constraint venues_logo_path_ck
  check (logo_path is null or (starts_with(logo_path, id::text || '/') and logo_path !~ '(\.\.|//|:|\\)'));
alter table public.venues add constraint venues_table_img_path_ck
  check (table_img_path is null or (starts_with(table_img_path, id::text || '/') and table_img_path !~ '(\.\.|//|:|\\)'));
