-- Mana, PROPOSED 0003 (13 Oct 2026): a booking link on the business and a look ("template") on the menu, both carried into
-- the snapshot a guest's phone receives. Never applied from a session: Daniel applies it to the hosted project BEFORE the
-- branch's owner app goes to main (the app sends book_url only when config.features.bookUrl is on).
-- Tested by loading it after db/00*.sql into the studio stack (STACK_EXTRA_SQL=1 node test/stack/start.mjs; npm run test:proposed).
-- This file touches ONLY the objects it names.

-- 1 ---------------------------------------------------------------- the owner's booking page (Ontopo, Tabit, ...): the guest menu's "Book" button opens it
alter table public.businesses add column book_url text;
alter table public.businesses add constraint businesses_book_url_ck
  check (book_url is null or (book_url ~ '^https://[^\s]+$' and char_length(book_url) <= 300));      -- the same rule as order_url
grant update (book_url) on public.businesses to authenticated;                                          -- members only, through the existing update policy

-- 2 ---------------------------------------------------------------- the look a menu is shown in (templates/templates.v1.json ids); unknown or null = today's theme
alter table public.menus add column template text;
alter table public.menus add constraint menus_template_ck check (template is null or template ~ '^[a-z0-9-]{1,40}$');
grant update (template) on public.menus to authenticated;

-- 3 ---------------------------------------------------------------- the snapshot (still v: 1): business.bookUrl and theme.template; older readers ignore both
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
      'orderUrl', b.order_url, 'bookUrl', b.book_url, 'phone', b.phone),
    'locale', jsonb_build_object('default', b.default_lang, 'langs', to_jsonb(b.langs), 'currency', b.currency),
    'theme', jsonb_build_object('accent', b.accent, 'surface', m.surface, 'template', m.template,
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
