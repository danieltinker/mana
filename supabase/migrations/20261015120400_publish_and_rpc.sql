-- Mana, clean schema 6/8: the published snapshot v2 (builder, validator, lint) and the phase-1 RPCs.
--
-- RPCs (public, called through PostgREST):
--   anon + signed in: public_menu(slug), track_events(batch), submit_lead(...)
--   signed in:        slug_available, create_venue, preview_menu, publish_menu, restore_revision, unpublish_menu,
--                     my_dashboard, redeem_staff_invite
--   Halom staff:      ops_overview, ops_approve_venue, ops_set_plan, ops_leads, ops_update_lead, act_for_owner (the ONLY
--                     way staff write into a venue's menu); admins: create_staff_invite
-- Errors a caller can act on come back as { ok: false, code }; "you may not" raises SQLSTATE 42501.

create function app.iso(p timestamptz) returns text language sql immutable set search_path = '' as
$$ select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

create function app.slug_ok(p_slug text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_slug, '') ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and not coalesce(app.cfg('reserved_slugs') ? p_slug, false)
$$;

create function app.tz_ok(p_tz text) returns boolean language plpgsql stable set search_path = '' as $$
begin
  if coalesce(p_tz, '') = '' then return false; end if;
  perform now() at time zone p_tz;
  return true;
exception when others then
  return false;
end $$;

-- not_requested (never published) | pending (published, waiting for Halom) | approved
create function app.review_of(p_approved_at timestamptz, p_first_published_at timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case when p_approved_at is not null then 'approved' when p_first_published_at is not null then 'pending' else 'not_requested' end
$$;

-- ================================================================ the snapshot builder
-- Only what guests may see: sections and dishes that are not hidden (sections with no dish left are dropped), approved
-- pictures (paths relative to assetBase), the add-on groups those dishes reach (attached, or opened by their options),
-- the schedules those sections and dishes use, and the active upsell rules that still make sense. A rule is left out
-- (and named in `warnings`) when its scope, its suggestion, or every target of its "basket has" condition is gone: a
-- condition is never published as "no condition". A dish's limits are clamped to its group's (a dish only tightens).
create function app.build_snapshot_full(p_venue uuid, p_number integer) returns jsonb
language sql stable security definer set search_path = '' as $$
with v as (select * from public.venues where id = p_venue),
secs as (
  select s.* from public.sections s
  where s.venue_id = p_venue and not s.hidden
    and exists (select 1 from public.dishes d where d.section_id = s.id and not d.hidden)),
dsh as (select d.* from public.dishes d join secs s on s.id = d.section_id where not d.hidden),
g1 as (select distinct dag.group_id as id from public.dish_addon_groups dag join dsh d on d.id = dag.dish_id),
g2 as (select distinct o.opens_group_id as id from public.addon_options o join g1 on g1.id = o.group_id where o.opens_group_id is not null),
grp as (select g.* from public.addon_groups g where g.venue_id = p_venue and g.id in (select id from g1 union select id from g2)),
sch as (
  select sc.* from public.schedules sc
  where sc.venue_id = p_venue
    and (sc.id in (select schedule_id from secs where schedule_id is not null) or sc.id in (select schedule_id from dsh where schedule_id is not null))),
rules0 as (
  select r.*,
    array(select x from unnest(r.scope_ids) x
          where (r.scope_kind = 'dish' and x in (select id from dsh)) or (r.scope_kind = 'section' and x in (select id from secs))) as scope_f,
    array(select x from unnest(r.basket_has_dishes) x where x in (select id from dsh)) as has_d,
    array(select x from unnest(r.basket_has_sections) x where x in (select id from secs)) as has_s,
    array(select x from unnest(r.basket_lacks_dishes) x where x in (select id from dsh)) as lacks_d,
    array(select x from unnest(r.basket_lacks_sections) x where x in (select id from secs)) as lacks_s,
    cardinality(r.basket_has_dishes) + cardinality(r.basket_has_sections) > 0 as has_condition,
    o.group_id as option_group
  from public.upsell_rules r left join public.addon_options o on o.id = r.suggest_option_id
  where r.venue_id = p_venue and r.active),
rules as (
  select r.*, case
    when r.scope_kind <> 'all' and cardinality(r.scope_f) = 0 then 'scope_empty'
    when not ((r.suggest_kind = 'dish' and r.suggest_dish_id in (select id from dsh))
           or (r.suggest_kind = 'option' and r.option_group in (select id from grp))) then 'suggestion_hidden'
    when r.has_condition and cardinality(r.has_d) + cardinality(r.has_s) = 0 then 'basket_has_empty'
  end as left_out
  from rules0 r)
select jsonb_build_object(
 'snapshot', jsonb_build_object(
  'v', 2,
  'venueId', v.id,
  'slug', v.slug,
  'revision', p_number,
  'publishedAt', app.iso(now()),
  'assetBase', app.cfg('public_base') #>> '{}',
  'venue', jsonb_build_object(
    'name', jsonb_build_object('he', v.name_he, 'en', v.name_en),
    'area', jsonb_build_object('he', v.area_he, 'en', v.area_en),
    'cuisine', jsonb_build_object('he', v.cuisine_he, 'en', v.cuisine_en),
    'kind', v.kind, 'mode', v.mode, 'logo', v.logo_path, 'orderUrl', v.order_url, 'bookUrl', v.book_url, 'phone', v.phone,
    'soldOut', v.sold_out_display, 'timeZone', v.time_zone),
  'locale', jsonb_build_object('default', v.default_lang, 'langs', to_jsonb(v.langs), 'currency', v.currency),
  'pricing', jsonb_build_object('includesVat', true, 'vatBasisPoints', coalesce((app.cfg('vat_basis_points') #>> '{}')::integer, 1800)),
  'theme', jsonb_build_object('accent', v.accent, 'surface', v.surface, 'template', v.template, 'tableImg', v.table_img_path),
  'schedules', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sc.id, 'kind', sc.kind, 'name', jsonb_build_object('he', sc.name_he, 'en', sc.name_en),
      'windows', sc.windows, 'validFrom', sc.valid_from, 'validTo', sc.valid_to) order by sc.created_at, sc.id)
    from sch sc), '[]'::jsonb),
  'sections', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', jsonb_build_object('he', s.name_he, 'en', s.name_en), 'kind', s.kind, 'scene', s.scene, 'room', s.room,
      'scheduleId', s.schedule_id,
      'dishes', (
        select jsonb_agg(jsonb_build_object(
          'id', d.id,
          'name', jsonb_build_object('he', d.name_he, 'en', d.name_en),
          'desc', jsonb_build_object('he', d.desc_he, 'en', d.desc_en),
          'price', case when d.price is null then null
                        else jsonb_build_object('amount', d.price, 'note', jsonb_build_object('he', d.price_note_he, 'en', d.price_note_en)) end,
          'tags', (select coalesce(jsonb_agg(t.tag order by t.first), '[]'::jsonb)
                   from (select u.tag, min(u.ord) as first from unnest(d.tags) with ordinality u(tag, ord) group by u.tag) t),
          'allergens', jsonb_build_object('he', d.allergens_he, 'en', d.allergens_en),
          'details', d.details,
          'asset', case
            when a.id is not null and a.kind = 'photo' then jsonb_build_object('state', 'photo', 'color', a.color_path, 'thumb', a.thumb_path)
            when a.id is not null then jsonb_build_object('state', 'relief', 'color', a.color_path, 'aux', a.aux_path, 'thumb', a.thumb_path,
                                         'kind', a.relief_class, 'e', a.meta->'e', 'h', a.meta->'h',
                                         'o', coalesce(a.meta->'o', 'null'::jsonb), 's', coalesce(a.meta->'s', 'null'::jsonb))
            when d.stock_id is not null then jsonb_build_object('state', 'stock', 'id', d.stock_id)
            else null end,
          'scheduleId', d.schedule_id,
          'addons', coalesce((
            select jsonb_agg(jsonb_build_object('groupId', dag.group_id,
                                                'min', greatest(dag.min_units, g.min_units), 'max', least(dag.max_units, g.max_units))
                             order by dag.position, dag.created_at, dag.id)
            from public.dish_addon_groups dag join public.addon_groups g on g.id = dag.group_id where dag.dish_id = d.id), '[]'::jsonb),
          'related', coalesce((
            select jsonb_agg(r.related_dish_id order by r.position, r.created_at, r.id)
            from public.dish_relations r where r.dish_id = d.id and r.related_dish_id in (select id from dsh)), '[]'::jsonb)
        ) order by d.position, d.created_at, d.id)
        from dsh d left join public.assets a on a.id = d.asset_id and a.status = 'approved'
        where d.section_id = s.id)
    ) order by s.position, s.created_at, s.id)
    from secs s), '[]'::jsonb),
  'addonGroups', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', jsonb_build_object('he', g.name_he, 'en', g.name_en), 'selection', g.selection,
      'min', g.min_units, 'max', g.max_units,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o.id, 'name', jsonb_build_object('he', o.name_he, 'en', o.name_en), 'price', o.price, 'maxQty', o.max_qty,
          'default', o.is_default, 'opensGroupId', o.opens_group_id) order by o.position, o.created_at, o.id)
        from public.addon_options o where o.group_id = g.id), '[]'::jsonb)
    ) order by g.created_at, g.id)
    from grp g), '[]'::jsonb),
  'upsellRules', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'trigger', r.trigger,
      'scope', case when r.scope_kind = 'all' then jsonb_build_object('kind', 'all')
                    else jsonb_build_object('kind', r.scope_kind, 'ids', to_jsonb(r.scope_f)) end,
      'when', case when cardinality(r.days) = 0 and r.from_time is null then null
                   else jsonb_build_object(
                     'days', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct unnest(r.days) as x) dd),
                     'from', to_char(r.from_time, 'HH24:MI'), 'to', to_char(r.to_time, 'HH24:MI')) end,
      'basketHas', case when r.has_condition then jsonb_build_object('dishes', to_jsonb(r.has_d), 'sections', to_jsonb(r.has_s)) end,
      'basketLacks', case when cardinality(r.lacks_d) + cardinality(r.lacks_s) > 0
                          then jsonb_build_object('dishes', to_jsonb(r.lacks_d), 'sections', to_jsonb(r.lacks_s)) end,
      'suggest', case when r.suggest_kind = 'dish' then jsonb_build_object('kind', 'dish', 'dishId', r.suggest_dish_id)
                      else jsonb_build_object('kind', 'option', 'groupId', r.option_group, 'optionId', r.suggest_option_id) end,
      'line', jsonb_build_object('he', r.line_he, 'en', r.line_en),
      'priority', r.priority, 'cap', r.cap, 'active', true
    ) order by r.priority desc, r.id)
    from rules r where r.left_out is null), '[]'::jsonb)),
 'warnings', coalesce((
    select jsonb_agg(jsonb_build_object('code', 'rule_left_out', 'path', 'upsellRules', 'id', r.id, 'reason', r.left_out, 'label', r.label)
                     order by r.priority desc, r.id)
    from rules r where r.left_out is not null), '[]'::jsonb)
)
from v
$$;

create function app.build_snapshot(p_venue uuid, p_number integer) returns jsonb
language sql stable security definer set search_path = '' as $$ select app.build_snapshot_full(p_venue, p_number) -> 'snapshot' $$;

-- ================================================================ the snapshot validator (same codes as packages/contracts validateSnapshotV2)
-- Covers every rule the tables cannot enforce on their own (cross-row limits, nesting, references, ranges). supabase/tests
-- runs both validators over the same broken menus and checks they agree.

-- a storage path relative to assetBase: 1–300 characters, no leading "/", no "..", "//", ":" or backslash (isRelPath)
create function app.rel_path(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'string' then
    char_length(p #>> '{}') between 1 and 300 and left(p #>> '{}', 1) <> '/' and position('..' in (p #>> '{}')) = 0
    and position('//' in (p #>> '{}')) = 0 and position(':' in (p #>> '{}')) = 0 and position(E'\\' in (p #>> '{}')) = 0
  else false end
$$;

create function app.issue(p_code text, p_path text) returns jsonb language sql immutable set search_path = '' as
$$ select jsonb_build_array(jsonb_build_object('code', p_code, 'path', p_path)) $$;

create function app.arr(p jsonb) returns jsonb language sql immutable set search_path = '' as
$$ select case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end $$;

-- a name in at least one language, blank characters not counting (hasName in the contracts)
create function app.named(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'object' then app.strip_blank(coalesce(p->>'he', '')) <> '' or app.strip_blank(coalesce(p->>'en', '')) <> ''
  else false end
$$;

create function app.int_in(p jsonb, p_lo bigint, p_hi bigint) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'number' and p::text ~ '^-?[0-9]{1,15}$' then p::text::bigint between p_lo and p_hi else false end
$$;

create function app.is_int(p jsonb) returns boolean language sql immutable set search_path = '' as
$$ select app.int_in(p, -999999999999999, 999999999999999) $$;

create function app.uuid_in(p jsonb, p_known text[]) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'string' then coalesce((p #>> '{}') = any (p_known), false) else false end
$$;

-- a list of ids: duplicates and unknown ids reported at their index
create function app.check_ids(p jsonb, p_path text, p_known text[]) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb := '[]'; seen text[] := '{}'; i integer; x jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' then return app.issue('type', p_path); end if;
  for i in 0 .. jsonb_array_length(p) - 1 loop
    x := p->i;
    if jsonb_typeof(x) is distinct from 'string' or (x #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      errs := errs || app.issue('id_invalid', format('%s[%s]', p_path, i));
    elsif (x #>> '{}') = any (seen) then
      errs := errs || app.issue('id_duplicate', format('%s[%s]', p_path, i));
    else
      seen := seen || (x #>> '{}');
      if p_known is not null and not ((x #>> '{}') = any (p_known)) then errs := errs || app.issue('ref_unknown', format('%s[%s]', p_path, i)); end if;
    end if;
  end loop;
  return errs;
end $$;

-- time windows, reported at the same paths as the contracts' validator
create function app.check_windows(p jsonb, p_path text) returns jsonb language plpgsql immutable set search_path = '' as $$
declare errs jsonb := '[]'; i integer; w jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) = 0 then return app.issue('window_invalid', p_path); end if;
  if jsonb_array_length(p) > 14 then errs := errs || app.issue('too_many', p_path); end if;
  for i in 0 .. jsonb_array_length(p) - 1 loop
    w := p->i;
    if jsonb_typeof(w) is distinct from 'object' then errs := errs || app.issue('window_invalid', format('%s[%s]', p_path, i)); continue; end if;
    if jsonb_typeof(w->'days') is distinct from 'array' or jsonb_array_length(w->'days') = 0
       or exists (select 1 from jsonb_array_elements(w->'days') d where d::text !~ '^[0-6]$')
       or (select count(distinct d) from jsonb_array_elements(w->'days') d) <> jsonb_array_length(w->'days') then
      errs := errs || app.issue('window_invalid', format('%s[%s].days', p_path, i));
    end if;
    if coalesce(w->>'from', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(w->>'to', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or jsonb_typeof(w->'from') is distinct from 'string' or jsonb_typeof(w->'to') is distinct from 'string' then
      errs := errs || app.issue('window_invalid', format('%s[%s].from', p_path, i));
    end if;
  end loop;
  return errs;
end $$;

create function app.validate_snapshot(s jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  errs jsonb := '[]';
  grp jsonb := '{}';        -- group id -> group
  cap jsonb := '{}';        -- group id -> units it can give
  optg jsonb := '{}';       -- option id -> its group id
  dish_ids text[] := '{}';
  sec_ids text[] := '{}';
  sch_ids text[] := '{}';
  rule_ids text[] := '{}';
  seen text[];
  g jsonb; o jsonb; sec jsonb; d jsonb; a jsonb; r jsonb; x jsonb; nested jsonb; gg jsonb; m jsonb; k text;
  gi integer; oi integer; si integer; di integer; ai integer; ri integer;
  p text; q text; units integer; defaults integer;
begin
  if jsonb_typeof(s) is distinct from 'object' then return app.issue('type', ''); end if;
  if s->'v' is distinct from '2'::jsonb then return app.issue('version', 'v'); end if;

  if jsonb_typeof(s->'venueId') is distinct from 'string' or (s->>'venueId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    errs := errs || app.issue('id_invalid', 'venueId');
  end if;
  if coalesce(s->>'slug', '') !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then errs := errs || app.issue('slug_invalid', 'slug'); end if;
  if jsonb_typeof(s->'assetBase') is distinct from 'string' or (s->>'assetBase') !~ '^https?://\S+/$' then errs := errs || app.issue('url_invalid', 'assetBase'); end if;

  -- venue
  if not coalesce(app.named(s#>'{venue,name}'), false) then errs := errs || app.issue('name_missing', 'venue.name'); end if;
  if coalesce(s#>>'{venue,kind}', '') not in ('restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other') then errs := errs || app.issue('enum_invalid', 'venue.kind'); end if;
  if coalesce(s#>>'{venue,mode}', '') not in ('view_only', 'standalone', 'companion') then errs := errs || app.issue('enum_invalid', 'venue.mode'); end if;
  if s#>'{venue,logo}' is distinct from 'null'::jsonb and not app.rel_path(s#>'{venue,logo}') then errs := errs || app.issue('path_invalid', 'venue.logo'); end if;
  if s#>'{venue,orderUrl}' <> 'null'::jsonb and coalesce(s#>>'{venue,orderUrl}', '') !~ '^https://\S+$' then errs := errs || app.issue('url_invalid', 'venue.orderUrl'); end if;
  if s#>'{venue,bookUrl}' <> 'null'::jsonb and coalesce(s#>>'{venue,bookUrl}', '') !~ '^https://\S+$' then errs := errs || app.issue('url_invalid', 'venue.bookUrl'); end if;
  if coalesce(s#>>'{venue,soldOut}', '') not in ('bottom', 'hide') then errs := errs || app.issue('enum_invalid', 'venue.soldOut'); end if;
  if not app.tz_ok(s#>>'{venue,timeZone}') then errs := errs || app.issue('time_zone_invalid', 'venue.timeZone'); end if;

  -- locale, theme
  x := s->'locale';
  if jsonb_typeof(x->'langs') is distinct from 'array' or jsonb_array_length(x->'langs') = 0
     or exists (select 1 from jsonb_array_elements(x->'langs') l where l not in ('"he"'::jsonb, '"en"'::jsonb))
     or (select count(distinct l) from jsonb_array_elements(x->'langs') l) <> jsonb_array_length(x->'langs')
     or not coalesce((x->'langs') @> jsonb_build_array(x->'default'), false)
     or x->'default' not in ('"he"'::jsonb, '"en"'::jsonb)
     or x->'currency' is distinct from '"ILS"'::jsonb then
    errs := errs || app.issue('locale_invalid', 'locale');
  end if;
  if coalesce(s#>>'{theme,accent}', '') !~ '^#[0-9a-fA-F]{6}$' then errs := errs || app.issue('color_invalid', 'theme.accent'); end if;
  if s#>'{theme,tableImg}' is distinct from 'null'::jsonb and not app.rel_path(s#>'{theme,tableImg}') then errs := errs || app.issue('path_invalid', 'theme.tableImg'); end if;

  -- schedules
  if jsonb_typeof(s->'schedules') is distinct from 'array' then errs := errs || app.issue('type', 'schedules'); end if;
  for si in 0 .. jsonb_array_length(app.arr(s->'schedules')) - 1 loop
    x := s->'schedules'->si; p := format('schedules[%s]', si);
    if (x->>'id') = any (sch_ids) then errs := errs || app.issue('id_duplicate', p || '.id'); else sch_ids := sch_ids || (x->>'id'); end if;
    errs := errs || app.check_windows(x->'windows', p || '.windows');
    begin
      if (x->'validFrom' <> 'null'::jsonb and (x->>'validFrom')::date is null) or (x->'validTo' <> 'null'::jsonb and (x->>'validTo')::date is null) then
        errs := errs || app.issue('date_invalid', p || '.validFrom');
      elsif x->'validFrom' <> 'null'::jsonb and x->'validTo' <> 'null'::jsonb and (x->>'validFrom')::date > (x->>'validTo')::date then
        errs := errs || app.issue('date_invalid', p || '.validTo');
      end if;
    exception when others then
      errs := errs || app.issue('date_invalid', p || '.validFrom');
    end;
  end loop;

  -- add-on groups
  if jsonb_typeof(s->'addonGroups') is distinct from 'array' then errs := errs || app.issue('type', 'addonGroups'); end if;
  for gi in 0 .. jsonb_array_length(app.arr(s->'addonGroups')) - 1 loop
    g := s->'addonGroups'->gi; p := format('addonGroups[%s]', gi);
    if jsonb_typeof(g->'id') is distinct from 'string' then errs := errs || app.issue('id_invalid', p || '.id'); continue; end if;
    if grp ? (g->>'id') then errs := errs || app.issue('id_duplicate', p || '.id'); continue; end if;
    grp := grp || jsonb_build_object(g->>'id', g);
    if not app.named(g->'name') then errs := errs || app.issue('name_missing', p || '.name'); end if;
    if coalesce(g->>'selection', '') not in ('single', 'multiple') then errs := errs || app.issue('enum_invalid', p || '.selection'); end if;
    if not app.int_in(g->'min', 0, 1000) or not app.int_in(g->'max', 1, 1000) or (g->>'min')::integer > (g->>'max')::integer then
      errs := errs || app.issue('limits_invalid', p);
    end if;
    if g->>'selection' = 'single' and g->'max' is distinct from '1'::jsonb then errs := errs || app.issue('single_max', p); end if;
    if jsonb_array_length(app.arr(g->'options')) = 0 then errs := errs || app.issue('options_empty', p || '.options'); continue; end if;
    units := 0; defaults := 0;
    for oi in 0 .. jsonb_array_length(g->'options') - 1 loop
      o := g->'options'->oi; q := format('%s.options[%s]', p, oi);
      if jsonb_typeof(o->'id') is distinct from 'string' then errs := errs || app.issue('id_invalid', q || '.id');
      elsif optg ? (o->>'id') then errs := errs || app.issue('id_duplicate', q || '.id');
      else optg := optg || jsonb_build_object(o->>'id', g->>'id'); end if;
      if not app.named(o->'name') then errs := errs || app.issue('name_missing', q || '.name'); end if;
      if not app.int_in(o->'price', 0, 10000000) then errs := errs || app.issue('price_invalid', q || '.price'); end if;
      if not app.int_in(o->'maxQty', 1, 10) then errs := errs || app.issue('option_qty_invalid', q || '.maxQty'); else units := units + (o->>'maxQty')::integer; end if;
      if o->'default' = 'true'::jsonb then defaults := defaults + 1; end if;
      if o->'opensGroupId' is not null and o->'opensGroupId' <> 'null'::jsonb then
        if o->>'opensGroupId' = g->>'id' then errs := errs || app.issue('opens_self', q || '.opensGroupId'); end if;
        if o->'maxQty' is distinct from '1'::jsonb then errs := errs || app.issue('opener_qty', q || '.maxQty'); end if;
      end if;
    end loop;
    cap := cap || jsonb_build_object(g->>'id', units);
    if app.int_in(g->'max', 1, 1000) and defaults > (g->>'max')::integer then errs := errs || app.issue('defaults_exceed', p); end if;
    -- a group whose minimum its own options cannot reach (matters most for a nested group, which no dish limits)
    if app.is_int(g->'min') and (g->>'min')::bigint > units then errs := errs || app.issue('min_unreachable', p); end if;
  end loop;
  -- one nesting level
  for gi in 0 .. jsonb_array_length(app.arr(s->'addonGroups')) - 1 loop
    g := s->'addonGroups'->gi;
    for oi in 0 .. jsonb_array_length(app.arr(g->'options')) - 1 loop
      o := g->'options'->oi;
      continue when o->'opensGroupId' is null or o->'opensGroupId' = 'null'::jsonb or o->>'opensGroupId' = g->>'id';
      q := format('addonGroups[%s].options[%s].opensGroupId', gi, oi);
      nested := grp->(o->>'opensGroupId');
      if nested is null then errs := errs || app.issue('ref_unknown', q); continue; end if;
      if exists (select 1 from jsonb_array_elements(app.arr(nested->'options')) n where n->'opensGroupId' is not null and n->'opensGroupId' <> 'null'::jsonb) then
        errs := errs || app.issue('nesting_too_deep', q);
      end if;
    end loop;
  end loop;

  -- sections and dishes
  if jsonb_typeof(s->'sections') is distinct from 'array' then errs := errs || app.issue('type', 'sections'); end if;
  for si in 0 .. jsonb_array_length(app.arr(s->'sections')) - 1 loop
    sec := s->'sections'->si; p := format('sections[%s]', si);
    if (sec->>'id') = any (sec_ids) then errs := errs || app.issue('id_duplicate', p || '.id'); else sec_ids := sec_ids || (sec->>'id'); end if;
    if not app.named(sec->'name') then errs := errs || app.issue('name_missing', p || '.name'); end if;
    if coalesce(sec->>'kind', '') not in ('food', 'dessert', 'drinks', 'wine', 'beer') then errs := errs || app.issue('enum_invalid', p || '.kind'); end if;
    if coalesce(sec->>'scene', '') not in ('auto', 'table', 'bar', 'holo') then errs := errs || app.issue('enum_invalid', p || '.scene'); end if;
    if sec->'room' <> 'null'::jsonb and coalesce(sec->>'room', '') not in ('table', 'vitrine', 'cellar', 'taps', 'cocktail') then errs := errs || app.issue('enum_invalid', p || '.room'); end if;
    if sec->'scheduleId' <> 'null'::jsonb and not app.uuid_in(sec->'scheduleId', sch_ids) then errs := errs || app.issue('ref_unknown', p || '.scheduleId'); end if;
    for di in 0 .. jsonb_array_length(app.arr(sec->'dishes')) - 1 loop
      d := sec->'dishes'->di; q := format('%s.dishes[%s]', p, di);
      if (d->>'id') = any (dish_ids) then errs := errs || app.issue('id_duplicate', q || '.id'); else dish_ids := dish_ids || (d->>'id'); end if;
      if not app.named(d->'name') then errs := errs || app.issue('name_missing', q || '.name'); end if;
      if d->'price' <> 'null'::jsonb and not app.int_in(d#>'{price,amount}', 0, 10000000) then errs := errs || app.issue('price_invalid', q || '.price'); end if;
      if jsonb_typeof(d->'tags') is distinct from 'array'
         or exists (select 1 from jsonb_array_elements(d->'tags') t where t not in ('"vegan"'::jsonb, '"vegetarian"'::jsonb, '"spicy"'::jsonb, '"gf"'::jsonb))
         or (select count(distinct t) from jsonb_array_elements(d->'tags') t) <> jsonb_array_length(d->'tags') then
        errs := errs || app.issue('enum_invalid', q || '.tags');
      end if;
      a := d->'asset';
      if a is not null and a <> 'null'::jsonb and not coalesce(
           (a->>'state' = 'relief' and app.rel_path(a->'color') and app.rel_path(a->'aux') and app.rel_path(a->'thumb')
              and a->>'kind' in ('flat', 'low', 'medium', 'tall', 'stand')
              and case when jsonb_typeof(a->'e') = 'number' then (a->>'e')::numeric > 5 and (a->>'e')::numeric <= 90 else false end
              and case when jsonb_typeof(a->'h') = 'number' then (a->>'h')::numeric >= 0 else false end)
        or (a->>'state' = 'photo' and app.rel_path(a->'color') and app.rel_path(a->'thumb'))
        or (a->>'state' = 'stock' and coalesce(a->>'id', '') ~ '^[a-z0-9][a-z0-9-]{0,39}$'), false) then
        errs := errs || app.issue('asset_invalid', q || '.asset');
      end if;
      if d->'scheduleId' <> 'null'::jsonb and not app.uuid_in(d->'scheduleId', sch_ids) then errs := errs || app.issue('ref_unknown', q || '.scheduleId'); end if;
      seen := '{}';
      for ai in 0 .. jsonb_array_length(app.arr(d->'addons')) - 1 loop
        x := d->'addons'->ai;
        if not (grp ? coalesce(x->>'groupId', '')) then errs := errs || app.issue('ref_unknown', format('%s.addons[%s].groupId', q, ai)); continue; end if;
        if (x->>'groupId') = any (seen) then errs := errs || app.issue('addon_duplicate', format('%s.addons[%s]', q, ai)); continue; end if;
        seen := seen || (x->>'groupId');
        if not app.int_in(x->'min', 0, 1000) or not app.int_in(x->'max', 1, 1000) or (x->>'min')::integer > (x->>'max')::integer then
          errs := errs || app.issue('limits_invalid', format('%s.addons[%s]', q, ai)); continue;
        end if;
        gg := grp->(x->>'groupId');
        if gg->>'selection' = 'single' and x->'max' <> '1'::jsonb then
          errs := errs || app.issue('single_max', format('%s.addons[%s]', q, ai));
        -- a dish may only tighten its group's limits
        elsif app.is_int(gg->'min') and app.is_int(gg->'max') and (gg->>'min')::bigint <= (gg->>'max')::bigint
              and ((x->>'min')::bigint < (gg->>'min')::bigint or (x->>'max')::bigint > (gg->>'max')::bigint) then
          errs := errs || app.issue('limits_loosened', format('%s.addons[%s]', q, ai));
        end if;
        if (x->>'min')::integer > coalesce((cap->>(x->>'groupId'))::integer, 0) then errs := errs || app.issue('min_unreachable', format('%s.addons[%s]', q, ai)); end if;
      end loop;
    end loop;
  end loop;
  -- related dishes (after every dish id is known)
  for si in 0 .. jsonb_array_length(app.arr(s->'sections')) - 1 loop
    for di in 0 .. jsonb_array_length(app.arr(s->'sections'->si->'dishes')) - 1 loop
      d := s->'sections'->si->'dishes'->di; q := format('sections[%s].dishes[%s].related', si, di);
      errs := errs || app.check_ids(d->'related', q, dish_ids);
      if jsonb_typeof(d->'related') = 'array' and d->'related' @> jsonb_build_array(d->'id') then errs := errs || app.issue('related_self', q); end if;
    end loop;
  end loop;

  -- upsell rules
  if jsonb_typeof(s->'upsellRules') is distinct from 'array' then errs := errs || app.issue('type', 'upsellRules'); end if;
  for ri in 0 .. jsonb_array_length(app.arr(s->'upsellRules')) - 1 loop
    r := s->'upsellRules'->ri; p := format('upsellRules[%s]', ri);
    if (r->>'id') = any (rule_ids) then errs := errs || app.issue('id_duplicate', p || '.id'); else rule_ids := rule_ids || (r->>'id'); end if;
    if coalesce(r->>'trigger', '') not in ('sheet', 'add', 'checkout') then errs := errs || app.issue('enum_invalid', p || '.trigger'); end if;
    if r#>>'{scope,kind}' = 'all' then
      null;
    elsif r#>>'{scope,kind}' in ('dish', 'section') then
      errs := errs || app.check_ids(r#>'{scope,ids}', p || '.scope.ids', case when r#>>'{scope,kind}' = 'dish' then dish_ids else sec_ids end);
      if jsonb_array_length(app.arr(r#>'{scope,ids}')) = 0 then errs := errs || app.issue('rule_scope_empty', p || '.scope'); end if;
    else
      errs := errs || app.issue('enum_invalid', p || '.scope.kind');
    end if;
    x := r->'when';
    if x is not null and x <> 'null'::jsonb and not coalesce(
         jsonb_typeof(x->'days') = 'array'
         and not exists (select 1 from jsonb_array_elements(x->'days') dd where dd::text !~ '^[0-6]$')
         and (select count(distinct dd) from jsonb_array_elements(x->'days') dd) = jsonb_array_length(x->'days')
         and ((x->'from' = 'null'::jsonb and x->'to' = 'null'::jsonb)
           or (coalesce(x->>'from', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and coalesce(x->>'to', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')), false) then
      errs := errs || app.issue('window_invalid', p || '.when');
    end if;
    -- basket conditions: null = no condition; otherwise lists naming at least one dish or section
    foreach k in array array['basketHas', 'basketLacks'] loop
      m := r->k;
      continue when m = 'null'::jsonb;
      if jsonb_typeof(m) is distinct from 'object' then errs := errs || app.issue('type', p || '.' || k); continue; end if;
      errs := errs || app.check_ids(m->'dishes', p || '.' || k || '.dishes', dish_ids)
                   || app.check_ids(m->'sections', p || '.' || k || '.sections', sec_ids);
      if jsonb_typeof(m->'dishes') = 'array' and jsonb_typeof(m->'sections') = 'array'
         and jsonb_array_length(m->'dishes') + jsonb_array_length(m->'sections') = 0 then
        errs := errs || app.issue('rule_condition_empty', p || '.' || k);
      end if;
    end loop;
    if r#>>'{suggest,kind}' = 'dish' then
      if not app.uuid_in(r#>'{suggest,dishId}', dish_ids) then errs := errs || app.issue('ref_unknown', p || '.suggest.dishId'); end if;
    elsif r#>>'{suggest,kind}' = 'option' then
      if not (optg ? coalesce(r#>>'{suggest,optionId}', '')) then errs := errs || app.issue('ref_unknown', p || '.suggest.optionId');
      elsif optg->>(r#>>'{suggest,optionId}') is distinct from r#>>'{suggest,groupId}' then errs := errs || app.issue('rule_option_group', p || '.suggest.groupId');
      end if;
      if r->>'trigger' = 'checkout' then errs := errs || app.issue('rule_option_needs_dish', p || '.suggest'); end if;
    else
      errs := errs || app.issue('enum_invalid', p || '.suggest.kind');
    end if;
    if not app.int_in(r->'priority', 0, 100) then errs := errs || app.issue('priority_invalid', p || '.priority'); end if;
    if not app.int_in(r->'cap', 1, 5) then errs := errs || app.issue('cap_invalid', p || '.cap'); end if;
  end loop;

  return errs;
end $$;

-- Warnings for a valid snapshot (lintSnapshotV2 in the contracts): rules that can never fire as written.
create function app.lint_snapshot(s jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare out jsonb := '[]'; r jsonb; ri integer;
begin
  for ri in 0 .. jsonb_array_length(app.arr(s->'upsellRules')) - 1 loop
    r := s->'upsellRules'->ri;
    if r#>>'{suggest,kind}' = 'dish' and r#>>'{scope,kind}' = 'dish' and coalesce(r#>'{scope,ids}' @> jsonb_build_array(r#>'{suggest,dishId}'), false) then
      out := out || app.issue('rule_suggests_its_trigger', format('upsellRules[%s]', ri));
    end if;
    if r#>>'{suggest,kind}' = 'option' and not exists (
         select 1 from jsonb_array_elements(app.arr(s->'sections')) sec, jsonb_array_elements(app.arr(sec->'dishes')) d
         where (r#>>'{scope,kind}' = 'all'
                or (r#>>'{scope,kind}' = 'dish' and coalesce(r#>'{scope,ids}' @> jsonb_build_array(d->'id'), false))
                or (r#>>'{scope,kind}' = 'section' and coalesce(r#>'{scope,ids}' @> jsonb_build_array(sec->'id'), false)))
           and exists (select 1 from jsonb_array_elements(app.arr(d->'addons')) a where a->'groupId' = r#>'{suggest,groupId}')) then
      out := out || app.issue('rule_option_unreachable', format('upsellRules[%s]', ri));
    end if;
  end loop;
  return out;
end $$;

-- ================================================================ publishing
-- The one place a revision is made. Callers check who may publish (publish_menu: owner or manager; act_for_owner: staff).
-- The first publish waits for Halom when app_config.publish_requires_approval is on: the revision is stored, the
-- venue's review is "pending", guests see "unavailable" until ops_approve_venue starts the trial.
create function app.start_trial(p_venue uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare ends timestamptz;
begin
  update public.entitlements set status = 'trialing', trial_started_at = now(),
    trial_ends_at = now() + make_interval(days => coalesce((app.cfg('trial_days') #>> '{}')::integer, 30))
  where venue_id = p_venue and status = 'pending'
  returning trial_ends_at into ends;
  return ends;
end $$;

create function app.publish(p_venue uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; v_state text; n integer; built jsonb; snap jsonb; issues jsonb; warnings jsonb; rev uuid; review text;
  note text := nullif(left(app.strip_blank(coalesce(p_note, '')), 200), '');
begin
  select * into v from public.venues where id = p_venue and archived_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'venue_unknown'); end if;
  v_state := app.entitlement_state(p_venue);
  if v_state in ('expired', 'suspended') then return jsonb_build_object('ok', false, 'code', 'plan_' || v_state); end if;
  if not exists (select 1 from public.dishes d join public.sections s on s.id = d.section_id
                 where d.venue_id = p_venue and not d.hidden and not s.hidden) then
    return jsonb_build_object('ok', false, 'code', 'empty_menu');
  end if;
  select coalesce(max(number), 0) + 1 into n from public.menu_revisions where venue_id = p_venue;
  built := app.build_snapshot_full(p_venue, n);
  snap := built -> 'snapshot';
  issues := app.validate_snapshot(snap);
  if jsonb_array_length(issues) > 0 then return jsonb_build_object('ok', false, 'code', 'invalid_menu', 'errors', issues); end if;
  warnings := (built -> 'warnings') || app.lint_snapshot(snap);

  if v.approved_at is not null then
    review := 'approved';
  elsif coalesce(app.cfg('publish_requires_approval'), 'true'::jsonb) = 'true'::jsonb and v_state = 'pending' then
    review := 'pending';
  else
    review := 'approved';                                           -- approval off, or a plan Halom already set
    update public.venues set approved_at = now() where id = p_venue;
  end if;
  if review = 'approved' then perform app.start_trial(p_venue); end if;   -- the trial starts with the first live publish

  insert into public.menu_revisions (venue_id, number, snapshot_version, snapshot, note, created_by)
  values (p_venue, n, 2, snap, note, (select auth.uid()))
  returning id into rev;
  update public.venues set published_revision_id = rev, last_published_at = now(), first_published_at = coalesce(first_published_at, now())
  where id = p_venue;
  insert into public.onboarding_progress (venue_id, step, state) values (p_venue, 'publish', 'done')
  on conflict (venue_id, step) do update set state = 'done' where public.onboarding_progress.state <> 'done';
  -- the note is the owner's own words: kept on the revision, never copied into the log
  perform app.log(p_venue, 'menu.publish', 'menu_revisions', array[rev::text],
                  jsonb_build_object('revision', n, 'review', review, 'hasNote', note is not null, 'warnings', jsonb_array_length(warnings)));
  perform app.emit(p_venue, 'menu_published', jsonb_build_object('revision', n));
  return jsonb_build_object('ok', true, 'revision', n, 'slug', v.slug, 'path', '/m/' || v.slug, 'review', review, 'warnings', warnings);
end $$;

-- ================================================================ RPCs for owners and managers
create function public.slug_available(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and app.slug_ok(lower(btrim(coalesce(p_slug, ''))))
     and not exists (select 1 from public.venues where slug = lower(btrim(coalesce(p_slug, ''))))
$$;

create function public.create_venue(p_slug text, p_name_he text default '', p_name_en text default '', p_kind text default 'restaurant',
                                    p_default_lang text default 'he') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_id uuid; v_slug text := lower(btrim(coalesce(p_slug, '')));
  he text := left(app.strip_blank(coalesce(p_name_he, '')), 80); en text := left(app.strip_blank(coalesce(p_name_en, '')), 80);
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'signed_out'); end if;
  if coalesce(app.cfg('require_confirmed_email'), 'true'::jsonb) = 'true'::jsonb
     and not exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    return jsonb_build_object('ok', false, 'code', 'email_unconfirmed');
  end if;
  -- one creation at a time per person, so the count below cannot be raced past
  perform pg_advisory_xact_lock(hashtext('mana:create_venue:' || uid::text));
  if (select count(*) from public.venue_members where user_id = uid and role = 'owner')
     >= coalesce((app.cfg('limits')->>'venues_per_user')::integer, 5) then
    return jsonb_build_object('ok', false, 'code', 'limit_venues');
  end if;
  if not app.slug_ok(v_slug) then return jsonb_build_object('ok', false, 'code', 'slug_invalid'); end if;
  if exists (select 1 from public.venues where slug = v_slug) then return jsonb_build_object('ok', false, 'code', 'slug_taken'); end if;
  if he = '' and en = '' then return jsonb_build_object('ok', false, 'code', 'name_missing'); end if;
  if coalesce(p_kind, '') not in ('restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other') then
    return jsonb_build_object('ok', false, 'code', 'kind_invalid');
  end if;
  if coalesce(p_default_lang, '') not in ('he', 'en') then return jsonb_build_object('ok', false, 'code', 'lang_invalid'); end if;

  perform set_config('mana.via', 'rpc', true);
  insert into public.venues (slug, name_he, name_en, kind, default_lang, created_by)
  values (v_slug, he, en, p_kind, p_default_lang, uid) returning id into v_id;
  insert into public.venue_members (venue_id, user_id, role) values (v_id, uid, 'owner');
  insert into public.entitlements (venue_id) values (v_id);
  insert into public.onboarding_progress (venue_id, step, state)
  select v_id, s, case when s = 'venue' then 'done' else 'todo' end
  from unnest(array['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish']) s;
  perform app.log(v_id, 'venue.create', 'venues', array[v_id::text], jsonb_build_object('slug', v_slug, 'kind', p_kind));
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'slug_taken');
end $$;

-- the snapshot as it would be published now, with what would stop a publish and what would only warn
create function public.preview_menu(p_venue uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare built jsonb; snap jsonb;
begin
  if not (app.can_edit(p_venue) or app.is_staff()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  built := app.build_snapshot_full(p_venue, 0);
  snap := built -> 'snapshot';
  return jsonb_build_object('snapshot', snap, 'issues', app.validate_snapshot(snap),
                            'warnings', (built -> 'warnings') || app.lint_snapshot(snap));
end $$;

create function public.publish_menu(p_venue uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then return jsonb_build_object('ok', false, 'code', 'not_allowed'); end if;
  perform set_config('mana.via', 'rpc', true);
  res := app.publish(p_venue, p_note);
  perform set_config('mana.via', '', true);
  return res;
end $$;

-- put an earlier revision back (the link and the QR stay the same); live today on halom-studio, kept through the cutover
create function public.restore_revision(p_venue uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; rev uuid; v_state text;
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then return jsonb_build_object('ok', false, 'code', 'not_allowed'); end if;
  select * into v from public.venues where id = p_venue and archived_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'venue_unknown'); end if;
  v_state := app.entitlement_state(p_venue);
  if v_state in ('expired', 'suspended') then return jsonb_build_object('ok', false, 'code', 'plan_' || v_state); end if;
  select id into rev from public.menu_revisions where venue_id = p_venue and number = p_revision;
  if rev is null then return jsonb_build_object('ok', false, 'code', 'no_revision'); end if;
  perform set_config('mana.via', 'rpc', true);
  update public.venues set published_revision_id = rev, last_published_at = now() where id = p_venue;
  perform app.log(p_venue, 'menu.restore', 'menu_revisions', array[rev::text], jsonb_build_object('revision', p_revision));
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'revision', p_revision, 'slug', v.slug, 'path', '/m/' || v.slug,
                            'review', app.review_of(v.approved_at, v.first_published_at));
end $$;

-- take the menu off the air: the short link answers "unavailable" (with the venue's name) until the next publish
create function public.unpublish_menu(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not app.can_edit(p_venue) then return jsonb_build_object('ok', false, 'code', 'not_allowed'); end if;
  perform set_config('mana.via', 'rpc', true);
  update public.venues set published_revision_id = null where id = p_venue and archived_at is null and published_revision_id is not null;
  if found then perform app.log(p_venue, 'menu.unpublish', 'venues', array[p_venue::text], '{}'); end if;
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true);
end $$;

-- ================================================================ what a guest's phone asks for
-- The published snapshot (immutable) plus the live overlay: what is off (only things the snapshot shows), the hours as
-- they are now, open or closed. Unavailable: unpublished after a publish, waiting for Halom's review, plan not live.
create function public.public_menu(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v record; snap jsonb; base text := app.cfg('public_base') #>> '{}'; v_state text; v_open boolean; today date; ids text[];
begin
  select * into v from public.venues where slug = lower(btrim(coalesce(p_slug, ''))) and archived_at is null;
  if not found or (v.published_revision_id is null and v.first_published_at is null) then return jsonb_build_object('state', 'not_found'); end if;
  v_state := app.entitlement_state(v.id);
  if v.published_revision_id is null or v.approved_at is null or v_state not in ('trialing', 'active') then
    return jsonb_build_object('state', 'unavailable', 'venue', jsonb_build_object('name', jsonb_build_object('he', v.name_he, 'en', v.name_en)));
  end if;
  select snapshot into snap from public.menu_revisions where id = v.published_revision_id;
  if base is not null then snap := jsonb_set(snap, '{assetBase}', to_jsonb(base)); end if;
  ids := array(select jsonb_path_query(snap, '$.sections[*].id') #>> '{}'
               union all select jsonb_path_query(snap, '$.sections[*].dishes[*].id') #>> '{}'
               union all select jsonb_path_query(snap, '$.addonGroups[*].options[*].id') #>> '{}');
  v_open := app.is_open_at(v.id, now());
  today := app.local_date(now(), v.time_zone);
  return jsonb_build_object('state', 'ok', 'snapshot', snap, 'live', jsonb_build_object(
    'at', app.iso(now()),
    'open', v_open,
    'nextOpening', case when v_open is false then app.iso(app.next_opening(v.id, now())) end,
    'hours', jsonb_build_object(
      'weekly', coalesce((select jsonb_agg(jsonb_build_object('days', jsonb_build_array(h.weekday), 'from', to_char(h.opens, 'HH24:MI'), 'to', to_char(h.closes, 'HH24:MI'))
                                  order by h.weekday, h.opens) from public.venue_hours h where h.venue_id = v.id), '[]'::jsonb),
      'closures', coalesce((select jsonb_agg(jsonb_build_object('from', c.from_date, 'to', c.to_date) order by c.from_date)
                            from (select * from public.venue_closures c where c.venue_id = v.id and c.to_date >= today - 1 order by c.from_date limit 60) c), '[]'::jsonb)),
    'off', coalesce((select jsonb_agg(jsonb_build_object('kind', o.target_kind, 'id', o.target_id, 'from', app.iso(o.starts_at), 'until', app.iso(o.until_at))
                                      order by o.starts_at, o.id)
                     from public.availability_overrides o
                     where o.venue_id = v.id and o.restored_at is null and o.starts_at <= now() + interval '12 hours'
                       and (o.until_at is null or o.until_at > now()) and o.target_id::text = any (ids)), '[]'::jsonb)));
end $$;

-- ================================================================ events from guests (packages/contracts/src/events.ts)
-- The first problem with one event, as a code (null = valid); the same codes and order as validateEvent.
create function app.check_event(e jsonb, p_allowed text[]) returns text
language plpgsql stable set search_path = '' as $$
declare k text; kind text; spec jsonb; t timestamptz;
begin
  if jsonb_typeof(e) is distinct from 'object' then return 'type'; end if;
  for k in select jsonb_object_keys(e) loop
    if k not in ('id', 'name', 'venueId', 'at', 'props') then
      return case when lower(k) = any (app.personal_keys()) then 'personal_field' else 'field_not_allowed' end;
    end if;
  end loop;
  if not app.uuid_ok(e->'id') or not app.uuid_ok(e->'venueId') then return 'id_invalid'; end if;
  spec := case when jsonb_typeof(e->'name') = 'string' then app.event_spec() -> (e->>'name') end;
  if spec is null then return 'name_unknown'; end if;
  if not ((e->>'name') = any (p_allowed)) then return 'name_not_allowed'; end if;
  -- an instant with an explicit offset (EVENT_TIME_RE)
  if jsonb_typeof(e->'at') is distinct from 'string'
     or (e->>'at') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,6})?)?(Z|[+-]\d\d:\d\d)$' then return 'time_invalid'; end if;
  begin
    t := (e->>'at')::timestamptz;
  exception when others then
    return 'time_invalid';
  end;
  if t < now() - interval '48 hours' or t > now() + interval '5 minutes' then return 'time_out_of_range'; end if;
  if jsonb_typeof(e->'props') is distinct from 'object' then return 'type'; end if;
  for k in select jsonb_object_keys(e->'props') loop
    if not (spec ? k) then
      return case when lower(k) = any (app.personal_keys()) then 'personal_field' else 'field_not_allowed' end;
    end if;
  end loop;
  for k, kind in select key, value #>> '{}' from jsonb_each(spec) loop
    if not ((e->'props') ? k) then return 'prop_missing'; end if;
    if not app.prop_ok(kind, e->'props'->k) then return 'prop_invalid'; end if;
  end loop;
  return null;
end $$;

-- the ids an event names belong to its venue (no rollup keys for ids that do not exist)
create function app.event_refs_ok(p_venue uuid, p jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select (p->>'dishId' is null or exists (select 1 from public.dishes x where x.id = (p->>'dishId')::uuid and x.venue_id = p_venue))
     and (p->>'ruleId' is null or exists (select 1 from public.upsell_rules x where x.id = (p->>'ruleId')::uuid and x.venue_id = p_venue))
     and (p->>'groupId' is null or exists (select 1 from public.addon_groups x where x.id = (p->>'groupId')::uuid and x.venue_id = p_venue))
     and (p->>'optionId' is null or exists (select 1 from public.addon_options x where x.id = (p->>'optionId')::uuid and x.venue_id = p_venue))
     and (p->>'parentOptionId' is null or exists (select 1 from public.addon_options x where x.id = (p->>'parentOptionId')::uuid and x.venue_id = p_venue))
$$;

-- one more on a cap counter; the new count
create function app.bump(p_key text, p_window timestamptz) returns integer
language sql security definer set search_path = '' as $$
  insert into app.event_counters as c (key, window_start, n) values (p_key, p_window, 1)
  on conflict (key, window_start) do update set n = c.n + 1
  returning n
$$;

-- Three caps, all in app_config.event_caps: per source per hour, per (venue, source) per day, per venue per (local) day.
-- Events past a cap are counted as `capped` and dropped; the day a venue passes its own cap is recorded
-- (app.event_capped_days), so the dashboards can say the day's numbers are capped instead of silently low.
create function public.track_events(p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caps jsonb := app.cfg('event_caps');
  per_source integer := coalesce((caps->>'per_source_hour')::integer, 300);
  per_venue_source integer := coalesce((caps->>'per_venue_source_day')::integer, 1500);
  per_venue integer := coalesce((caps->>'per_venue_day')::integer, 50000);
  src text; local_day date;
  e jsonb; i integer; code text; v record;
  accepted integer := 0; duplicates integer := 0; capped integer := 0; rejected jsonb := '[]';
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
      continue;
    end if;
    local_day := app.local_date(now(), v.time_zone);
    if app.bump('source:' || src, date_trunc('hour', now())) > per_source
       or app.bump('venue-source:' || v.id || ':' || src, local_day::timestamp at time zone 'UTC') > per_venue_source then
      capped := capped + 1;
      continue;
    end if;
    if app.bump('venue:' || v.id, local_day::timestamp at time zone 'UTC') > per_venue then
      capped := capped + 1;
      insert into app.event_capped_days as d (venue_id, day, dropped) values (v.id, local_day, 1)
      on conflict (venue_id, day) do update set dropped = d.dropped + 1;
      continue;
    end if;
    if app.store_event((e->>'id')::uuid, v.id, e->>'name', (e->>'at')::timestamptz, 'guest', v.is_demo, e->'props') then
      accepted := accepted + 1;
    else
      duplicates := duplicates + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'accepted', accepted, 'duplicates', duplicates, 'capped', capped, 'rejected', rejected);
end $$;

-- ================================================================ the client dashboard (F08), from the rollups
create function public.my_dashboard(p_venue uuid, p_range text default 'today') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v record; d1 date; d0 date; ndays integer;
begin
  if not app.can_see_records(p_venue) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v from public.venues where id = p_venue;
  ndays := case p_range when 'today' then 1 when '7d' then 7 when '30d' then 30 end;
  if ndays is null then raise exception 'range_invalid' using errcode = '22023'; end if;
  d1 := app.local_date(now(), v.time_zone);
  d0 := d1 - (ndays - 1);
  return (
    with r as (
      select name, key, sum(n)::bigint as n from public.rollups_day
      where venue_id = p_venue and demo = v.is_demo and day between d0 and d1 group by name, key),
    t as (select name, n from r where key = '')
    select jsonb_build_object(
      'venueId', p_venue, 'range', p_range, 'from', d0, 'to', d1, 'timeZone', v.time_zone, 'demo', v.is_demo,
      'generatedAt', app.iso(now()),
      'rolledUpAt', (select app.iso(last_run_at) from app.rollup_state),
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
        select jsonb_agg(jsonb_build_object('minute', app.iso(m.bucket), 'opens', m.n) order by m.bucket)
        from public.rollups_minute m
        where m.venue_id = p_venue and m.demo = v.is_demo and m.name = 'menu_opened' and m.key = ''
          and m.bucket >= date_trunc('minute', now()) - interval '59 minutes'), '[]'::jsonb),
      'topDishes', coalesce((
        select jsonb_agg(jsonb_build_object('dishId', d.id, 'name', jsonb_build_object('he', d.name_he, 'en', d.name_en),
                                            'views', z.views, 'adds', z.adds) order by z.views desc, z.adds desc, d.id)
        from (select substr(key, 6)::uuid as dish_id,
                     coalesce(sum(n) filter (where name = 'dish_viewed'), 0) as views,
                     coalesce(sum(n) filter (where name = 'basket_added'), 0) as adds
              from r where key like 'dish:%' and name in ('dish_viewed', 'basket_added') group by 1
              order by 2 desc, 3 desc limit 10) z
        join public.dishes d on d.id = z.dish_id), '[]'::jsonb),
      'rules', coalesce((
        select jsonb_agg(jsonb_build_object('ruleId', u.id, 'label', u.label, 'line', jsonb_build_object('he', u.line_he, 'en', u.line_en),
                 'active', u.active,
                 'shown', coalesce((select n from r where name = 'suggestion_shown' and key = 'rule:' || u.id), 0),
                 'accepted', coalesce((select n from r where name = 'suggestion_accepted' and key = 'rule:' || u.id), 0),
                 'dismissed', coalesce((select n from r where name = 'suggestion_dismissed' and key = 'rule:' || u.id), 0))
               order by u.priority desc, u.id)
        from public.upsell_rules u where u.venue_id = p_venue), '[]'::jsonb),
      'offNow', coalesce((
        select jsonb_agg(jsonb_build_object('kind', o.target_kind, 'id', o.target_id, 'until', app.iso(o.until_at), 'by', o.created_by_kind)
                         order by o.created_at)
        from public.availability_overrides o
        where o.venue_id = p_venue and o.restored_at is null and o.starts_at <= now() and (o.until_at is null or o.until_at > now())), '[]'::jsonb),
      'menu', jsonb_build_object('live', v.published_revision_id is not null,
        'revision', (select number from public.menu_revisions where id = v.published_revision_id),
        'lastPublishedAt', app.iso(v.last_published_at),
        'review', app.review_of(v.approved_at, v.first_published_at)),
      'onboarding', coalesce((
        select jsonb_agg(jsonb_build_object('step', o.step, 'state', o.state, 'blockers', to_jsonb(o.blockers))
                         order by array_position(array['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish'], o.step))
        from public.onboarding_progress o where o.venue_id = p_venue), '[]'::jsonb),
      'activity', coalesce((
        select jsonb_agg(jsonb_build_object('at', app.iso(a.at), 'action', a.action, 'actorKind', a.actor_kind, 'via', a.via,
                                            'reason', a.reason, 'n', a.n) order by a.id desc)
        from (select * from public.activity_log where venue_id = p_venue order by id desc limit 20) a), '[]'::jsonb)
    ));
end $$;

-- ================================================================ Halom staff: invites
create function app.invite_failed(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  insert into app.staff_invite_failures as f (user_id, day, n) values (p_user, (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, day) do update set n = f.n + 1
$$;

-- An invite redeems once, before it expires, for a signed-in person whose confirmed auth e-mail is the invite's
-- address. Codes shorter than 32 characters are refused before any lookup; five failures in a day lock the person out
-- until tomorrow. No sleeps: the failure counter is the brake.
create function public.redeem_staff_invite(p_code text) returns jsonb
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
  insert into public.staff (user_id, role, note) values (uid, r, 'invite');
  perform app.log(null, 'staff.join', 'staff', array[uid::text], jsonb_build_object('role', r));
  return jsonb_build_object('ok', true, 'role', r);
end $$;

-- An admin invites someone by e-mail. The code is made here, returned once, and only its hash is stored.
create function public.create_staff_invite(p_email text, p_role text default 'support') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare email text := lower(btrim(coalesce(p_email, ''))); code text; ends timestamptz;
begin
  if app.staff_role() is distinct from 'admin' then raise exception 'not_admin' using errcode = '42501'; end if;
  if char_length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return jsonb_build_object('ok', false, 'code', 'email_invalid'); end if;
  if coalesce(p_role, '') not in ('support', 'admin') then return jsonb_build_object('ok', false, 'code', 'role_invalid'); end if;
  code := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.staff_invites (code_hash, role, email, note)
  values (encode(extensions.digest(code, 'sha256'), 'hex'), p_role, email, 'by ' || (select auth.uid())::text)
  returning expires_at into ends;
  perform app.log(null, 'staff_invite.create', 'staff_invites', '{}', jsonb_build_object('role', p_role, 'expiresAt', app.iso(ends)));
  return jsonb_build_object('ok', true, 'code', code, 'expiresAt', app.iso(ends));
end $$;

-- ================================================================ Halom staff: the clients
-- every venue for the back office (F09 clients): review, onboarding stage, last publish, live opens, open cases, warnings
create function public.ops_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare steps text[] := array['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish'];
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  return jsonb_build_object(
    'generatedAt', app.iso(now()),
    'rolledUpAt', (select app.iso(last_run_at) from app.rollup_state),
    'totals', jsonb_build_object(
      'venues', (select count(*) from public.venues where archived_at is null and not is_demo),
      'live', (select count(*) from public.venues where archived_at is null and not is_demo and published_revision_id is not null and approved_at is not null),
      'awaitingReview', (select count(*) from public.venues where archived_at is null and approved_at is null and first_published_at is not null),
      'demoVenues', (select count(*) from public.venues where archived_at is null and is_demo),
      'opensToday', (select coalesce(sum(r.n), 0) from public.rollups_day r join public.venues v on v.id = r.venue_id
                     where r.day = app.local_date(now(), v.time_zone) and r.name = 'menu_opened' and r.key = '' and not r.demo),
      'openCases', (select count(*) from public.support_cases where status <> 'resolved'),
      'actsForOwner7d', (select count(*) from public.activity_log where via = 'act_for_owner' and action = 'support.act_for_owner' and at > now() - interval '7 days')),
    'venues', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
      select v.created_at, jsonb_build_object(
        'id', v.id, 'slug', v.slug, 'name', jsonb_build_object('he', v.name_he, 'en', v.name_en), 'kind', v.kind, 'mode', v.mode,
        'isDemo', v.is_demo, 'createdAt', app.iso(v.created_at), 'supportCanAct', v.support_can_act,
        'review', app.review_of(v.approved_at, v.first_published_at), 'approvedAt', app.iso(v.approved_at),
        'onboarding', jsonb_build_object(
          'stage', coalesce((select u.s from unnest(steps) with ordinality u(s, i)
                             where not exists (select 1 from public.onboarding_progress p where p.venue_id = v.id and p.step = u.s and p.state in ('done', 'skipped'))
                             order by u.i limit 1), 'complete'),
          'done', (select count(*) from public.onboarding_progress p where p.venue_id = v.id and p.state in ('done', 'skipped')),
          'total', cardinality(steps),
          'blocked', (select coalesce(jsonb_agg(jsonb_build_object('step', p.step, 'blockers', to_jsonb(p.blockers))), '[]'::jsonb)
                      from public.onboarding_progress p where p.venue_id = v.id and (p.state = 'blocked' or cardinality(p.blockers) > 0))),
        'menu', jsonb_build_object('live', v.published_revision_id is not null,
          'revision', (select number from public.menu_revisions where id = v.published_revision_id),
          'firstPublishedAt', app.iso(v.first_published_at), 'lastPublishedAt', app.iso(v.last_published_at)),
        'opens', jsonb_build_object(
          'today', (select coalesce(sum(r.n), 0) from public.rollups_day r where r.venue_id = v.id and r.demo = v.is_demo and r.name = 'menu_opened'
                      and r.key = '' and r.day = app.local_date(now(), v.time_zone)),
          'last7d', (select coalesce(sum(r.n), 0) from public.rollups_day r where r.venue_id = v.id and r.demo = v.is_demo and r.name = 'menu_opened'
                      and r.key = '' and r.day > app.local_date(now(), v.time_zone) - 7),
          'lastHour', (select coalesce(sum(m.n), 0) from public.rollups_minute m where m.venue_id = v.id and m.demo = v.is_demo and m.name = 'menu_opened'
                      and m.key = '' and m.bucket >= now() - interval '1 hour')),
        'cappedToday', exists (select 1 from app.event_capped_days c where c.venue_id = v.id and c.day = app.local_date(now(), v.time_zone)),
        'suggestions7d', jsonb_build_object(
          'shown', (select coalesce(sum(r.n), 0) from public.rollups_day r where r.venue_id = v.id and r.name = 'suggestion_shown' and r.key = ''
                      and r.day > app.local_date(now(), v.time_zone) - 7),
          'accepted', (select coalesce(sum(r.n), 0) from public.rollups_day r where r.venue_id = v.id and r.name = 'suggestion_accepted' and r.key = ''
                      and r.day > app.local_date(now(), v.time_zone) - 7)),
        'openCases', (select count(*) from public.support_cases c where c.venue_id = v.id and c.status <> 'resolved'),
        'lastOwnerSignInAt', (select app.iso(max(u.last_sign_in_at)) from auth.users u join public.venue_members m on m.user_id = u.id
                              where m.venue_id = v.id and m.role = 'owner'),
        'lastActivityAt', (select app.iso(max(a.at)) from public.activity_log a where a.venue_id = v.id),
        'plan', jsonb_build_object('plan', e.plan, 'state', app.entitlement_state(v.id), 'trialEndsAt', app.iso(e.trial_ends_at)),
        'warnings', to_jsonb(array_remove(array[
          case when v.approved_at is null and v.first_published_at is not null then 'awaiting_review' end,
          case when v.published_revision_id is null and v.first_published_at is null and v.created_at < now() - interval '2 days' then 'not_published_2d' end,
          case when v.last_published_at < now() - interval '7 days' then 'no_publish_7d' end,
          case when exists (select 1 from app.event_capped_days c where c.venue_id = v.id and c.day > app.local_date(now(), v.time_zone) - 7) then 'events_capped' end,
          case when exists (select 1 from public.menu_imports i where i.venue_id = v.id and i.status = 'failed' and i.created_at > now() - interval '2 days') then 'import_failed' end,
          case when exists (select 1 from public.support_cases c where c.venue_id = v.id and c.status in ('open', 'waiting_halom') and c.created_at < now() - interval '1 day') then 'case_waiting' end
        ], null))
      ) as j
      from public.venues v left join public.entitlements e on e.venue_id = v.id
      where v.archived_at is null) x), '[]'::jsonb)
  );
end $$;

-- Halom approves a venue's first publish (app_config.publish_requires_approval): guests see it, the trial starts. Logged
-- with the reason, which the owner sees.
create function public.ops_approve_venue(p_venue uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; reason text := btrim(coalesce(p_reason, '')); ends timestamptz;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if char_length(reason) < 3 or char_length(reason) > 500 then return jsonb_build_object('ok', false, 'code', 'reason_required'); end if;
  select * into v from public.venues where id = p_venue and archived_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'venue_unknown'); end if;
  if v.approved_at is not null then return jsonb_build_object('ok', false, 'code', 'already_approved'); end if;
  if v.first_published_at is null then return jsonb_build_object('ok', false, 'code', 'not_published'); end if;
  perform set_config('mana.via', 'rpc', true);
  update public.venues set approved_at = now(), approved_by = (select auth.uid()) where id = p_venue;
  ends := app.start_trial(p_venue);
  perform app.log(p_venue, 'venue.approve', 'venues', array[p_venue::text], jsonb_build_object('trialEndsAt', app.iso(ends)), 1, reason);
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'trialEndsAt', app.iso(ends));
end $$;

-- Halom sets a venue's plan state by hand until billing exists (live today on halom-studio as ops_set_entitlement).
-- A live state (trialing, active) also approves the venue. Logged with the reason, which the owner sees.
create function public.ops_set_plan(p_venue uuid, p_state text, p_until timestamptz default null, p_reason text default null,
                                    p_plan text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare reason text := btrim(coalesce(p_reason, '')); n integer;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if char_length(reason) < 3 or char_length(reason) > 500 then return jsonb_build_object('ok', false, 'code', 'reason_required'); end if;
  if coalesce(p_state, '') not in ('pending', 'trialing', 'active', 'expired', 'suspended') then return jsonb_build_object('ok', false, 'code', 'state_invalid'); end if;
  if p_plan is not null and p_plan not in ('trial', 'pilot', 'paid') then return jsonb_build_object('ok', false, 'code', 'plan_invalid'); end if;
  if p_until is not null and p_until <= now() and p_state in ('trialing', 'active') then return jsonb_build_object('ok', false, 'code', 'until_in_past'); end if;
  perform set_config('mana.via', 'rpc', true);
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
    return jsonb_build_object('ok', false, 'code', 'venue_unknown');
  end if;
  if p_state in ('trialing', 'active') then
    update public.venues set approved_at = now(), approved_by = (select auth.uid()) where id = p_venue and approved_at is null;
  end if;
  perform app.log(p_venue, 'plan.set', 'entitlements', array[p_venue::text],
                  jsonb_build_object('state', p_state, 'plan', p_plan, 'until', app.iso(p_until)), 1, reason);
  perform set_config('mana.via', '', true);
  return jsonb_build_object('ok', true, 'state', app.entitlement_state(p_venue));
end $$;

-- ---------------------------------------------------------------- act for owner: the ONLY way Halom staff write into a venue's menu (D25)
-- Each action is a small internal function; act_for_owner checks the caller, the reason and the owner's switch, marks the
-- transaction (so every audit row it causes says via = act_for_owner with the reason), runs the action, and writes its
-- own activity row, all in one transaction. A failed action writes nothing. The row holds the payload's keys and ids
-- and the result's ids and numbers, never the words staff typed (a note, a dish text).
create function app.afo_availability_set(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
  if coalesce(p->>'targetKind', '') not in ('section', 'dish', 'option') or not app.uuid_ok(p->'targetId') or not app.until_spec_ok(p->'until') then
    raise exception 'payload_invalid';
  end if;
  insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec, note)
  values (p_venue, p->>'targetKind', (p->>'targetId')::uuid, p->'until'->>'kind', p->'until', nullif(left(btrim(coalesce(p->>'note', '')), 200), ''))
  returning id, until_at into o;
  return jsonb_build_object('overrideId', o.id, 'untilAt', app.iso(o.until_at));
end $$;

create function app.afo_availability_restore(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if coalesce(p->>'targetKind', '') not in ('section', 'dish', 'option') or not app.uuid_ok(p->'targetId') then raise exception 'payload_invalid'; end if;
  update public.availability_overrides set restored_at = now()
  where venue_id = p_venue and target_kind = p->>'targetKind' and target_id = (p->>'targetId')::uuid
    and restored_at is null and (until_at is null or until_at > now());
  get diagnostics n = row_count;
  return jsonb_build_object('restored', n);
end $$;

create function app.afo_dish_update(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  allowed text[] := array['name_he', 'name_en', 'desc_he', 'desc_en', 'price', 'price_note_he', 'price_note_en', 'tags', 'allergens_he',
                          'allergens_en', 'hidden', 'stock_id', 'position'];
  patch jsonb := p->'patch'; k text; n integer;
begin
  if not app.uuid_ok(p->'dishId') or jsonb_typeof(patch) is distinct from 'object' or patch = '{}'::jsonb then raise exception 'payload_invalid'; end if;
  for k in select jsonb_object_keys(patch) loop
    if not (k = any (allowed)) then raise exception 'payload_invalid'; end if;
  end loop;
  update public.dishes d set
    name_he = case when patch ? 'name_he' then patch->>'name_he' else d.name_he end,
    name_en = case when patch ? 'name_en' then patch->>'name_en' else d.name_en end,
    desc_he = case when patch ? 'desc_he' then patch->>'desc_he' else d.desc_he end,
    desc_en = case when patch ? 'desc_en' then patch->>'desc_en' else d.desc_en end,
    price = case when patch ? 'price' then (patch->>'price')::integer else d.price end,
    price_note_he = case when patch ? 'price_note_he' then patch->>'price_note_he' else d.price_note_he end,
    price_note_en = case when patch ? 'price_note_en' then patch->>'price_note_en' else d.price_note_en end,
    tags = case when patch ? 'tags' then array(select jsonb_array_elements_text(patch->'tags')) else d.tags end,
    allergens_he = case when patch ? 'allergens_he' then patch->>'allergens_he' else d.allergens_he end,
    allergens_en = case when patch ? 'allergens_en' then patch->>'allergens_en' else d.allergens_en end,
    hidden = case when patch ? 'hidden' then (patch->>'hidden')::boolean else d.hidden end,
    stock_id = case when patch ? 'stock_id' then patch->>'stock_id' else d.stock_id end,
    position = case when patch ? 'position' then (patch->>'position')::integer else d.position end
  where d.id = (p->>'dishId')::uuid and d.venue_id = p_venue;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'target_unknown'; end if;
  return jsonb_build_object('dishId', p->>'dishId', 'fields', (select jsonb_agg(k2 order by k2) from jsonb_object_keys(patch) k2));
end $$;

create function app.afo_onboarding_set(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.onboarding_progress (venue_id, step, state, blockers)
  values (p_venue, p->>'step', p->>'state', coalesce(array(select jsonb_array_elements_text(app.arr(p->'blockers'))), '{}'))
  on conflict (venue_id, step) do update set state = excluded.state, blockers = excluded.blockers;
  return jsonb_build_object('step', p->>'step', 'state', p->>'state');
end $$;

create function app.afo_support_case_update(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not app.uuid_ok(p->'caseId') then raise exception 'payload_invalid'; end if;
  update public.support_cases set status = p->>'status' where id = (p->>'caseId')::uuid and venue_id = p_venue;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'target_unknown'; end if;
  return jsonb_build_object('caseId', p->>'caseId', 'status', p->>'status');
end $$;

-- What of a result the log may keep: numbers, booleans, and strings without spaces (ids, codes, times, paths), plus
-- arrays of those; anything else (objects, free text) is dropped.
create function app.loggable(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) e(k, v)
  where case jsonb_typeof(v)
    when 'number' then true when 'boolean' then true when 'null' then true
    when 'string' then (v #>> '{}') ~ '^[A-Za-z0-9_./:+-]{1,80}$'
    when 'array' then jsonb_array_length(v) <= 50
                      and not exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[A-Za-z0-9_./:+-]{1,80}$')
    else false end
$$;

create function public.act_for_owner(p_venue uuid, p_reason text, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  reason text := btrim(coalesce(p_reason, ''));
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v record; res jsonb; log_id bigint; ids text[];
begin
  if (select auth.uid()) is null or app.staff_role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  if char_length(reason) < 3 or char_length(reason) > 500 then return jsonb_build_object('ok', false, 'code', 'reason_required'); end if;
  select id, support_can_act into v from public.venues where id = p_venue and archived_at is null;
  if not found then return jsonb_build_object('ok', false, 'code', 'venue_unknown'); end if;
  if not v.support_can_act then return jsonb_build_object('ok', false, 'code', 'owner_declined'); end if;
  if coalesce(p_action, '') not in ('availability.set', 'availability.restore', 'dish.update', 'menu.publish', 'onboarding.set', 'support_case.update') then
    return jsonb_build_object('ok', false, 'code', 'action_unknown');
  end if;
  if jsonb_typeof(payload) <> 'object' then return jsonb_build_object('ok', false, 'code', 'payload_invalid'); end if;

  perform set_config('mana.via', 'act_for_owner', true);
  perform set_config('mana.reason', reason, true);
  begin
    res := case p_action
      when 'availability.set' then app.afo_availability_set(p_venue, payload)
      when 'availability.restore' then app.afo_availability_restore(p_venue, payload)
      when 'dish.update' then app.afo_dish_update(p_venue, payload)
      when 'menu.publish' then app.publish(p_venue, payload->>'note')
      when 'onboarding.set' then app.afo_onboarding_set(p_venue, payload)
      when 'support_case.update' then app.afo_support_case_update(p_venue, payload)
    end;
    if p_action = 'menu.publish' and res->>'ok' = 'false' then
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
                        'result', app.loggable(res))));
  exception
    when raise_exception then
      perform set_config('mana.via', '', true);
      perform set_config('mana.reason', '', true);
      return jsonb_build_object('ok', false, 'code', sqlerrm);
    when data_exception or integrity_constraint_violation then
      perform set_config('mana.via', '', true);
      perform set_config('mana.reason', '', true);
      return jsonb_build_object('ok', false, 'code', 'payload_invalid');
  end;
  perform set_config('mana.via', '', true);
  perform set_config('mana.reason', '', true);
  return jsonb_build_object('ok', true, 'action', p_action, 'result', res, 'logId', log_id);
end $$;

-- ================================================================ Mana's own leads (the product page's "talk to us")
-- Real visitors are never refused: a lead that looks automated (the honeypot filled, sent too fast, more than
-- lead_caps.per_source_hour from one source) is kept with status 'spam', out of the back office's default view. Only past
-- lead_caps.hard_day leads in a day is nothing more stored (an attack, not visitors).
create function public.submit_lead(p_token uuid, p_message text, p_contact text, p_name text default null, p_venue_name text default null,
                                   p_locale text default null, p_source text default 'mana-landing', p_hp text default '',
                                   p_elapsed_ms integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ref text; src text; msg text := app.strip_blank(coalesce(p_message, '')); contact text := app.strip_blank(coalesce(p_contact, ''));
  v_source text := lower(btrim(coalesce(p_source, 'mana-landing'))); v_status text := 'new';
  caps jsonb := app.cfg('lead_caps');
  per_hour integer := coalesce((caps->>'per_source_hour')::integer, 5);
  hard integer := coalesce((caps->>'hard_day')::integer, 2000);
begin
  if p_token is null then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  select ref into v_ref from public.leads where client_token = p_token;
  if v_ref is not null then return jsonb_build_object('ok', true, 'ref', v_ref); end if;       -- the same form sent twice
  if char_length(msg) not between 3 and 4000 or char_length(contact) not between 5 and 200
     or not (contact ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or regexp_replace(contact, '\D', '', 'g') ~ '^\d{7,15}$')
     or v_source !~ '^[a-z0-9][a-z0-9-]{1,40}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 day') >= hard then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  src := app.request_source();
  if coalesce(p_hp, '') <> '' or (p_elapsed_ms is not null and p_elapsed_ms < 1500)
     or (select count(*) from public.leads where source_hash = src and created_at > now() - interval '1 hour') >= per_hour then
    v_status := 'spam';
  end if;
  insert into public.leads (ref, client_token, source, message, contact, name, venue_name, locale, source_hash, status)
  values ('MN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.lead_ref_seq')::text, 4, '0'), p_token, v_source, msg, contact,
          nullif(left(app.strip_blank(coalesce(p_name, '')), 120), ''), nullif(left(app.strip_blank(coalesce(p_venue_name, '')), 120), ''),
          case when p_locale in ('he', 'en') then p_locale end, src, v_status)
  on conflict (client_token) do nothing
  returning ref into v_ref;
  if v_ref is null then select ref into v_ref from public.leads where client_token = p_token; end if;
  return jsonb_build_object('ok', true, 'ref', v_ref);
end $$;

-- Staff read leads only through this function, and each read is logged (the pattern for every future read of personal
-- data). p_status: null = every status except spam; 'all' = everything; else that status.
create function public.ops_leads(p_status text default null, p_source text default null, p_since timestamptz default null,
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
  perform app.log(null, 'leads.read', 'leads', '{}',
                  jsonb_strip_nulls(jsonb_build_object('n', n, 'status', coalesce(p_status, 'default'), 'source', p_source, 'since', app.iso(p_since))), n);
  return jsonb_build_object('leads', rows, 'count', n);
end $$;

create function public.ops_update_lead(p_id uuid, p_status text default null, p_owner text default null, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not app.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('new', 'contacted', 'qualified', 'onboarding', 'won', 'lost', 'spam') then
    return jsonb_build_object('ok', false, 'code', 'status_invalid');
  end if;
  update public.leads set status = coalesce(p_status, status), owner = coalesce(left(p_owner, 80), owner), notes = coalesce(left(p_notes, 4000), notes)
  where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;
