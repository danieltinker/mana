-- 0006_table_clock.sql — PROPOSED, not applied. The table clock for the host board (view/host/). seating/timers.mjs is
-- the reference these tables mirror; its tests hold the rules. Daniel applies it, if at all, after 0003–0005, and only
-- when the host board leaves the demo. Never run from a session; nothing calls it yet.
--
-- Rules the schema keeps (the same as seating/timers.mjs):
-- - a venue's default time frame is 15–360 minutes in steps of 5 (90 unless the owner changes it); the "ending soon"
--   warning 1–30 minutes; the grace period 1–60 minutes; the default extension 5–120 in steps of 5;
-- - a table may have its own frame (table ids are the layout's: ^[a-z0-9][a-z0-9_-]{0,39}$);
-- - a seating keeps the frame it started with (minutes) and what was added (extended); its end is
--   seated_at + (minutes + extended) minutes; one open seating per table;
-- - a seating ends 'early' (freed before its end), 'manager' (freed or re-seated after time was up) or 'auto' (the grace
--   period passed: end_overdue_seatings() closes it at end + grace).
-- - a party is a number: no name, no phone, nothing personal in these tables.
-- RLS: the venue's owner only (memberships.role = 'owner'). Nothing is readable by anon or by a guest; nothing here is in
-- the guest snapshot.

create or replace function public.is_venue_owner(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.memberships where business_id = p_business and user_id = (select auth.uid()) and role = 'owner') $$;

create table public.table_clock_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  minutes     integer not null default 90 check (minutes between 15 and 360 and minutes % 5 = 0),
  ending_min  integer not null default 5  check (ending_min between 1 and 30),
  grace_min   integer not null default 10 check (grace_min between 1 and 60),
  extend_by   integer not null default 15 check (extend_by between 5 and 120 and extend_by % 5 = 0),
  updated_at  timestamptz not null default now()
);

create table public.table_clock_overrides (
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_id    text not null check (table_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  minutes     integer not null check (minutes between 15 and 360 and minutes % 5 = 0),
  primary key (business_id, table_id)
);

create table public.seatings (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_id    text not null check (table_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  party       integer not null check (party between 1 and 40),
  seated_at   timestamptz not null default now(),
  minutes     integer not null check (minutes between 15 and 360 and minutes % 5 = 0),
  extended    integer not null default 0 check (extended >= 0),
  ended_at    timestamptz,
  ended_how   text check (ended_how in ('early', 'manager', 'auto')),
  check ((ended_at is null) = (ended_how is null)),
  check (ended_at is null or ended_at >= seated_at)
);
create unique index seatings_one_open on public.seatings (business_id, table_id) where ended_at is null;
create index seatings_business_idx on public.seatings (business_id, seated_at desc);

alter table public.table_clock_settings enable row level security;
alter table public.table_clock_overrides enable row level security;
alter table public.seatings enable row level security;
create policy table_clock_settings_owner on public.table_clock_settings for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
create policy table_clock_overrides_owner on public.table_clock_overrides for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
create policy seatings_owner on public.seatings for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
revoke all on public.table_clock_settings, public.table_clock_overrides, public.seatings from anon;

-- The grace period, on the server's clock: every open seating past end + grace is closed as 'auto' at that moment.
-- The board calls it when it opens (and could on a schedule); the owner only, for his own venue.
create or replace function public.end_overdue_seatings(p_business uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_grace integer; v_n integer;
begin
  if not public.is_venue_owner(p_business) then raise exception 'not the owner' using errcode = '42501'; end if;
  select coalesce((select grace_min from public.table_clock_settings where business_id = p_business), 10) into v_grace;
  update public.seatings s
     set ended_at = s.seated_at + make_interval(mins => s.minutes + s.extended + v_grace), ended_how = 'auto'
   where s.business_id = p_business and s.ended_at is null
     and s.seated_at + make_interval(mins => s.minutes + s.extended + v_grace) <= now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.is_venue_owner(uuid), public.end_overdue_seatings(uuid) to authenticated;
revoke execute on function public.is_venue_owner(uuid), public.end_overdue_seatings(uuid) from anon, public;
