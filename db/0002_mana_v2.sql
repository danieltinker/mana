-- Mana v2 (7 Oct 2026): placeholder pictures, item / hour / language counts, one-call approve, the owner's dashboard
-- numbers, and the daily allowance for the AI helpers (menu scan, dish description).
-- This file touches ONLY the objects it names: the same database holds another product's schema.

-- 1 ---------------------------------------------------------------- a placeholder picture per item
-- An id from the viewer's stock library (view/stock/stock.json). Shown only while the item has no approved picture of its own.
alter table public.items add column stock_id text;
alter table public.items add constraint items_stock_id_ck check (stock_id is null or stock_id ~ '^[a-z0-9][a-z0-9-]{0,39}$');

-- the snapshot a diner sees: an item without its own picture may carry {"state":"stock","id":"…"}
create or replace function public.build_snapshot(p_business uuid, p_number integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (select * from public.businesses where id = p_business),
       m as (select * from public.menus where business_id = p_business),
       base as (select public.cfg('public_base')#>>'{}' as u)
  select jsonb_build_object(
    'v', 1, 'slug', b.slug, 'revision', p_number, 'publishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'business', jsonb_build_object(
      'name', jsonb_build_object('he', b.name_he, 'en', b.name_en),
      'area', jsonb_build_object('he', b.area_he, 'en', b.area_en),
      'cuisine', jsonb_build_object('he', b.cuisine_he, 'en', b.cuisine_en),
      'kind', b.kind,
      'logo', case when b.logo_path is null then null else base.u || b.logo_path end,
      'orderUrl', b.order_url, 'phone', b.phone),
    'locale', jsonb_build_object('default', b.default_lang, 'langs', to_jsonb(b.langs), 'currency', b.currency),
    'theme', jsonb_build_object('accent', b.accent, 'surface', m.surface,
      'tableImg', case when m.table_img_path is null then null else base.u || m.table_img_path end),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', jsonb_build_object('he', c.name_he, 'en', c.name_en), 'kind', c.kind, 'scene', c.scene,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id,
            'name', jsonb_build_object('he', i.name_he, 'en', i.name_en),
            'desc', jsonb_build_object('he', i.desc_he, 'en', i.desc_en),
            'price', case when i.price_minor is null then null else jsonb_build_object('amount', i.price_minor, 'currency', b.currency,
                       'note', jsonb_build_object('he', i.price_note_he, 'en', i.price_note_en)) end,
            'available', i.available, 'tags', to_jsonb(i.tags),
            'allergens', jsonb_build_object('he', i.allergens_he, 'en', i.allergens_en),
            'details', i.details,
            'asset', case
              when a.id is not null and a.kind = 'photo' then jsonb_build_object('state', 'photo', 'color', base.u || a.color_path, 'thumb', base.u || a.thumb_path)
              when a.id is not null then jsonb_build_object('state', 'relief', 'color', base.u || a.color_path, 'aux', base.u || a.aux_path, 'thumb', base.u || a.thumb_path,
                     'kind', a.relief_class, 'e', a.meta->'e', 'h', a.meta->'h', 'o', a.meta->'o', 's', a.meta->'s')
              when i.stock_id is not null then jsonb_build_object('state', 'stock', 'id', i.stock_id)
              else null end
          ) order by i.position, i.created_at)
          from public.items i left join public.assets a on a.id = i.asset_id and a.status = 'approved'
          where i.category_id = c.id), '[]'::jsonb)
      ) order by c.position, c.created_at)
      from public.categories c
      where c.business_id = p_business and exists (select 1 from public.items i where i.category_id = c.id)), '[]'::jsonb))
  from b, m, base
$$;
revoke all on function public.build_snapshot(uuid, integer) from public, anon, authenticated;

-- 2 ---------------------------------------------------------------- counts: language, hour of day, per item
alter table public.menu_views_daily add column views_en integer not null default 0;
alter table public.menu_views_daily add column views_qr integer not null default 0;      -- opened from the printed QR (the QR carries ?t=1)

create table public.menu_views_hourly (
  business_id uuid not null references public.businesses on delete cascade,
  day date not null,
  hour smallint not null check (hour between 0 and 23),
  views integer not null default 0,
  primary key (business_id, day, hour)
);
alter table public.menu_views_hourly enable row level security;
revoke all on public.menu_views_hourly from anon, authenticated;
grant select on public.menu_views_hourly to authenticated;
create policy views_hourly_select on public.menu_views_hourly for select to authenticated using ((select public.is_member(business_id)));

create table public.item_events_daily (
  business_id uuid not null references public.businesses on delete cascade,
  item_id uuid not null references public.items on delete cascade,
  day date not null,
  opens integer not null default 0,           -- a diner opened the dish
  adds integer not null default 0,            -- a diner put it on "my table"
  primary key (business_id, item_id, day)
);
alter table public.item_events_daily enable row level security;
revoke all on public.item_events_daily from anon, authenticated;
grant select on public.item_events_daily to authenticated;
create policy item_events_select on public.item_events_daily for select to authenticated using ((select public.is_member(business_id)));
create index item_events_business_day_idx on public.item_events_daily (business_id, day);

-- what a diner's phone asks for, v2: the same answer as public_menu, and the view is also counted by language, by hour and by
-- how the diner arrived (p_src 'qr' = the printed code, anything else = a link)
create or replace function public.open_menu(p_slug text, p_lang text default null, p_src text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b record; v_snap jsonb; v_state text; v_now timestamp := now() at time zone 'Asia/Jerusalem';
begin
  select bs.id, bs.name_he, bs.name_en, m.published_revision_id into b
  from public.businesses bs join public.menus m on m.business_id = bs.id
  where bs.slug = lower(trim(coalesce(p_slug, '')));
  if not found or b.published_revision_id is null then return jsonb_build_object('state', 'not_found'); end if;
  v_state := public.entitlement_state(b.id);
  if v_state not in ('trialing', 'active') then
    return jsonb_build_object('state', 'unavailable', 'business', jsonb_build_object('name', jsonb_build_object('he', b.name_he, 'en', b.name_en)));
  end if;
  select snapshot into v_snap from public.menu_revisions where id = b.published_revision_id;
  -- sold out is live: the owner flips it without publishing again
  v_snap := jsonb_set(v_snap, '{categories}', coalesce((
    select jsonb_agg(jsonb_set(c.val, '{items}', coalesce((
      select jsonb_agg(case when i.id is null then it.val else jsonb_set(it.val, '{available}', to_jsonb(i.available)) end order by it.ord)
      from jsonb_array_elements(c.val->'items') with ordinality as it(val, ord)
      left join public.items i on i.id = (it.val->>'id')::uuid and i.business_id = b.id), '[]'::jsonb)) order by c.ord)
    from jsonb_array_elements(v_snap->'categories') with ordinality as c(val, ord)), '[]'::jsonb));
  begin
    insert into public.menu_views_daily (business_id, day, views, views_en, views_qr)
    values (b.id, v_now::date, 1, (coalesce(p_lang, '') = 'en')::int, (coalesce(p_src, '') = 'qr')::int)
    on conflict (business_id, day) do update set views = public.menu_views_daily.views + 1,
      views_en = public.menu_views_daily.views_en + excluded.views_en, views_qr = public.menu_views_daily.views_qr + excluded.views_qr;
    insert into public.menu_views_hourly (business_id, day, hour, views) values (b.id, v_now::date, extract(hour from v_now)::smallint, 1)
    on conflict (business_id, day, hour) do update set views = public.menu_views_hourly.views + 1;
  exception when others then null;      -- counting must never break a menu
  end;
  return jsonb_build_object('state', 'ok', 'snapshot', v_snap);
end $$;
revoke all on function public.open_menu(text, text, text) from public, anon, authenticated;
grant execute on function public.open_menu(text, text, text) to anon, authenticated;

-- the first viewer's call keeps working and counts the same way
create or replace function public.public_menu(p_slug text) returns jsonb
language sql security definer set search_path = '' as $$ select public.open_menu(p_slug, null, null) $$;

-- a diner opened a dish ('open') or put it on "my table" ('add'): one more on that item's count for today. Nothing about the diner is kept.
create or replace function public.track_item(p_slug text, p_item uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_b uuid;
begin
  if p_kind is null or p_kind not in ('open', 'add') or p_item is null then return; end if;
  select bs.id into v_b from public.businesses bs join public.menus m on m.business_id = bs.id
  where bs.slug = lower(trim(coalesce(p_slug, ''))) and m.published_revision_id is not null;
  if v_b is null then return; end if;
  if not exists (select 1 from public.items i where i.id = p_item and i.business_id = v_b) then return; end if;
  insert into public.item_events_daily (business_id, item_id, day, opens, adds)
  values (v_b, p_item, (now() at time zone 'Asia/Jerusalem')::date, (p_kind = 'open')::int, (p_kind = 'add')::int)
  on conflict (business_id, item_id, day) do update
    set opens = public.item_events_daily.opens + excluded.opens, adds = public.item_events_daily.adds + excluded.adds;
exception when others then null;        -- counting must never break a menu
end $$;
revoke all on function public.track_item(text, uuid, text) from public, anon, authenticated;
grant execute on function public.track_item(text, uuid, text) to anon, authenticated;

-- 3 ---------------------------------------------------------------- the owner's dashboard in one call
create or replace function public.my_stats(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d0 date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if not public.is_member(p_business) then raise exception 'not_member' using errcode = '42501'; end if;
  return jsonb_build_object(
    'today', d0,
    'days', (select jsonb_agg(jsonb_build_object('day', g.d::date, 'views', coalesce(v.views, 0), 'en', coalesce(v.views_en, 0), 'qr', coalesce(v.views_qr, 0)) order by g.d)
             from generate_series(d0 - 29, d0, interval '1 day') g(d)
             left join public.menu_views_daily v on v.business_id = p_business and v.day = g.d::date),
    'hours', (select jsonb_agg(coalesce(h.n, 0) order by s.hr)
              from generate_series(0, 23) s(hr)
              left join (select hour, sum(views) n from public.menu_views_hourly where business_id = p_business and day > d0 - 30 group by hour) h on h.hour = s.hr),
    'items', coalesce((select jsonb_agg(to_jsonb(t) order by t.opens desc, t.adds desc) from (
               select e.item_id as id, i.name_he, i.name_en, sum(e.opens)::int as opens, sum(e.adds)::int as adds
               from public.item_events_daily e join public.items i on i.id = e.item_id
               where e.business_id = p_business and e.day > d0 - 30
               group by e.item_id, i.name_he, i.name_en
               order by sum(e.opens) desc, sum(e.adds) desc limit 12) t), '[]'::jsonb),
    'totals', jsonb_build_object(
      'views30', (select coalesce(sum(views), 0) from public.menu_views_daily where business_id = p_business and day > d0 - 30),
      'views7', (select coalesce(sum(views), 0) from public.menu_views_daily where business_id = p_business and day > d0 - 7),
      'viewsPrev7', (select coalesce(sum(views), 0) from public.menu_views_daily where business_id = p_business and day > d0 - 14 and day <= d0 - 7),
      'viewsAll', (select coalesce(sum(views), 0) from public.menu_views_daily where business_id = p_business),
      'en30', (select coalesce(sum(views_en), 0) from public.menu_views_daily where business_id = p_business and day > d0 - 30),
      'qr30', (select coalesce(sum(views_qr), 0) from public.menu_views_daily where business_id = p_business and day > d0 - 30),
      'opens30', (select coalesce(sum(opens), 0) from public.item_events_daily where business_id = p_business and day > d0 - 30),
      'adds30', (select coalesce(sum(adds), 0) from public.item_events_daily where business_id = p_business and day > d0 - 30)),
    'menu', (select jsonb_build_object('live', m.published_revision_id is not null, 'firstPublishedAt', m.first_published_at, 'lastPublishedAt', m.last_published_at)
             from public.menus m where m.business_id = p_business),
    'plan', (select jsonb_build_object('plan', e.plan, 'state', public.entitlement_state(p_business), 'trialEndsAt', e.trial_ends_at, 'periodEnd', e.current_period_end)
             from public.entitlements e where e.business_id = p_business),
    'counts', jsonb_build_object(
      'categories', (select count(*) from public.categories where business_id = p_business),
      'items', (select count(*) from public.items where business_id = p_business),
      'withPicture', (select count(*) from public.items where business_id = p_business and asset_id is not null),
      'withPlaceholder', (select count(*) from public.items where business_id = p_business and asset_id is null and stock_id is not null),
      'soldOut', (select count(*) from public.items where business_id = p_business and not available))
  );
end $$;
revoke all on function public.my_stats(uuid) from public, anon, authenticated;
grant execute on function public.my_stats(uuid) to authenticated;

-- 4 ---------------------------------------------------------------- approve a picture and show it on its item, in one call
-- (the studio still copies the files to the public bucket first; the picture guard checks that they are there)
create or replace function public.approve_asset(p_asset uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.assets;
begin
  select * into a from public.assets where id = p_asset;
  if not found or not public.is_member(a.business_id) then return jsonb_build_object('ok', false, 'code', 'not_member'); end if;
  update public.assets set status = 'approved' where id = p_asset and status <> 'approved';
  if a.item_id is not null then update public.items set asset_id = p_asset where id = a.item_id and business_id = a.business_id; end if;
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'code', sqlerrm);
end $$;
revoke all on function public.approve_asset(uuid) from public, anon, authenticated;
grant execute on function public.approve_asset(uuid) to authenticated;

create or replace function public.my_entitlement_state(p_business uuid) returns text
language sql stable security definer set search_path = '' as
$$ select case when public.is_member(p_business) then public.entitlement_state(p_business) end $$;
revoke all on function public.my_entitlement_state(uuid) from public, anon, authenticated;
grant execute on function public.my_entitlement_state(uuid) to authenticated;

-- 5 ---------------------------------------------------------------- the AI helpers' daily allowance (the edge function menus-ai asks before every call)
insert into public.app_config (key, value) values ('ai_limits', '{"scan_menu": 12, "describe_dish": 80}') on conflict (key) do nothing;

create table public.ai_usage_daily (
  business_id uuid not null references public.businesses on delete cascade,
  day date not null,
  kind text not null check (kind in ('scan_menu', 'describe_dish')),
  n integer not null default 0,
  primary key (business_id, day, kind)
);
alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from anon, authenticated;

create or replace function public.ai_take(p_business uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lim int; cur int; d date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if (select auth.uid()) is null or not public.is_member(p_business) then return jsonb_build_object('ok', false, 'code', 'not_member'); end if;
  if p_kind is null or p_kind not in ('scan_menu', 'describe_dish') then return jsonb_build_object('ok', false, 'code', 'bad_kind'); end if;
  lim := coalesce((public.cfg('ai_limits')->>p_kind)::int, 10);
  insert into public.ai_usage_daily (business_id, day, kind, n) values (p_business, d, p_kind, 1)
  on conflict (business_id, day, kind) do update set n = public.ai_usage_daily.n + 1
  returning n into cur;
  if cur > lim then return jsonb_build_object('ok', false, 'code', 'limit_ai', 'limit', lim); end if;
  return jsonb_build_object('ok', true, 'used', cur, 'limit', lim);
end $$;
revoke all on function public.ai_take(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, text) to authenticated;

-- 6 ---------------------------------------------------------------- staff overview: placeholders and item opens per business
create or replace function public.ops_business_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d0 date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(b.id, jsonb_build_object(
      'withPlaceholder', (select count(*) from public.items i where i.business_id = b.id and i.asset_id is null and i.stock_id is not null),
      'opens30', (select coalesce(sum(e.opens), 0) from public.item_events_daily e where e.business_id = b.id and e.day > d0 - 30),
      'adds30', (select coalesce(sum(e.adds), 0) from public.item_events_daily e where e.business_id = b.id and e.day > d0 - 30),
      'aiScans30', (select coalesce(sum(u.n), 0) from public.ai_usage_daily u where u.business_id = b.id and u.kind = 'scan_menu' and u.day > d0 - 30)))
    from public.businesses b), '{}'::jsonb);
end $$;
revoke all on function public.ops_business_stats() from public, anon, authenticated;
grant execute on function public.ops_business_stats() to authenticated;
