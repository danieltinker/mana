-- Mana, PROPOSED 0004 (13 Oct 2026): guest-side counts for the Book and seat-map buttons, and the product page's top of the
-- funnel. Never applied from a session. No cookies, no ids, nothing about the person: one number per day per kind.
-- Tested by loading it after db/00*.sql into the studio stack (STACK_EXTRA_SQL=1 node test/stack/start.mjs; npm run test:proposed).
-- Never called from a demo (?demo=) or a preview (?preview=1).

-- 1 ---------------------------------------------------------------- per menu: book, seat (view and start are allowed for a later per-menu use)
create table public.menu_events_daily (
  business_id uuid not null references public.businesses on delete cascade,
  day date not null,
  kind text not null check (kind in ('book', 'seat', 'view', 'start')),
  n integer not null default 0,
  primary key (business_id, day, kind)
);
alter table public.menu_events_daily enable row level security;
revoke all on public.menu_events_daily from anon, authenticated;
grant select on public.menu_events_daily to authenticated;
create policy menu_events_select on public.menu_events_daily for select to authenticated using ((select public.is_member(business_id)));

-- 2 ---------------------------------------------------------------- the product page (no business): a view, a press on "start free"
create table public.site_events_daily (
  day date not null,
  kind text not null check (kind in ('view', 'start')),
  n integer not null default 0,
  primary key (day, kind)
);
alter table public.site_events_daily enable row level security;
revoke all on public.site_events_daily from anon, authenticated;        -- staff read it through ops_overview later; nobody through the API today

-- 3 ---------------------------------------------------------------- the caps: a day's count stops growing at these numbers (a script cannot inflate them further)
insert into public.app_config (key, value) values ('event_caps', '{"menu": 5000, "site": 50000}') on conflict (key) do nothing;

-- a guest pressed Book ('book') or opened the seat map ('seat') on a published menu: one more on that menu's count for today
create or replace function public.track_menu(p_slug text, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_b uuid; v_cap int := coalesce((public.cfg('event_caps')->>'menu')::int, 5000);
begin
  if p_kind is null or p_kind not in ('book', 'seat') then return; end if;
  select bs.id into v_b from public.businesses bs join public.menus m on m.business_id = bs.id
  where bs.slug = lower(trim(coalesce(p_slug, ''))) and m.published_revision_id is not null;
  if v_b is null then return; end if;
  insert into public.menu_events_daily (business_id, day, kind, n) values (v_b, (now() at time zone 'Asia/Jerusalem')::date, p_kind, 1)
  on conflict (business_id, day, kind) do update set n = public.menu_events_daily.n + 1 where public.menu_events_daily.n < v_cap;
exception when others then null;        -- counting must never break a menu
end $$;
revoke all on function public.track_menu(text, text) from public, anon, authenticated;
grant execute on function public.track_menu(text, text) to anon, authenticated;

-- the product page was opened ('view') or "start free" was pressed ('start')
create or replace function public.track_site(p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cap int := coalesce((public.cfg('event_caps')->>'site')::int, 50000);
begin
  if p_kind is null or p_kind not in ('view', 'start') then return; end if;
  insert into public.site_events_daily (day, kind, n) values ((now() at time zone 'Asia/Jerusalem')::date, p_kind, 1)
  on conflict (day, kind) do update set n = public.site_events_daily.n + 1 where public.site_events_daily.n < v_cap;
exception when others then null;
end $$;
revoke all on function public.track_site(text) from public, anon, authenticated;
grant execute on function public.track_site(text) to anon, authenticated;
