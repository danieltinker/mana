-- Halom Studio backend, v1 (6 Oct 2026): studio leads + the restaurant menu product.
-- Rules: every table has RLS on. Anonymous visitors can only call submit_lead() and public_menu().
-- Owners reach their own business rows through membership. Halom staff read everything through ops_* functions.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- settings (never readable through the API)
create table public.app_config (key text primary key, value jsonb not null);
alter table public.app_config enable row level security;
insert into public.app_config (key, value) values
  ('trial_days', '30'),
  ('public_base', '"https://zemdhczqlhkabfwxccqq.supabase.co/storage/v1/object/public/menu-public/"'),
  ('short_base', '"https://halom.io/m/"'),
  ('limits', '{"categories": 24, "items": 240, "assets_per_day": 120, "assets_total": 900, "attempts": 5}'),
  ('ip_salt', to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')));

create or replace function public.cfg(p_key text) returns jsonb
language sql stable security definer set search_path = '' as
$$ select value from public.app_config where key = p_key $$;
revoke all on function public.cfg(text) from public, anon, authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as
$$ begin new.updated_at := now(); return new; end $$;

create or replace function public.request_ip_hash() returns text
language plpgsql stable security definer set search_path = '' as $$
declare h json; ip text;
begin
  begin h := current_setting('request.headers', true)::json; exception when others then h := null; end;
  ip := coalesce(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), '');
  if ip = '' then ip := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', 'unknown'); end if;
  return encode(extensions.digest(trim(ip) || coalesce(public.cfg('ip_salt')#>>'{}', ''), 'sha256'), 'hex');
end $$;
revoke all on function public.request_ip_hash() from public, anon, authenticated;

-- ---------------------------------------------------------------- staff
create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now(),
  note text
);
alter table public.staff enable row level security;

create table public.staff_invites (
  code_hash text primary key,
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users on delete set null
);
alter table public.staff_invites enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.staff where user_id = (select auth.uid())) $$;

create or replace function public.redeem_staff_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); h text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'signed_out'); end if;
  if exists (select 1 from public.staff where user_id = uid) then return jsonb_build_object('ok', true); end if;
  h := encode(extensions.digest(coalesce(trim(p_code), ''), 'sha256'), 'hex');
  update public.staff_invites set used_at = now(), used_by = uid where code_hash = h and used_at is null;
  if not found then
    perform pg_sleep(0.6);
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  insert into public.staff (user_id, note) values (uid, 'invite');
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- leads (the dream portal, product enquiries)
create sequence public.lead_ref_seq;
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('HL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.lead_ref_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  client_token uuid not null unique,
  source text not null default 'dream-portal' check (char_length(source) <= 60),
  package text check (package is null or package in ('spark', 'dream', 'lucid', 'founders', 'menus', 'showroom')),
  dream text not null check (char_length(dream) between 3 and 4000),
  contact text not null check (char_length(contact) between 5 and 200),
  name text check (name is null or char_length(name) <= 120),
  locale text check (locale is null or locale in ('en', 'he')),
  page text check (page is null or char_length(page) <= 500),
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'qualified', 'scoped', 'agreed', 'production', 'review', 'deployed', 'support', 'lost', 'spam')),
  owner text check (owner is null or char_length(owner) <= 80),
  next_action text check (next_action is null or char_length(next_action) <= 300),
  next_action_on date,
  notes text check (notes is null or char_length(notes) <= 4000),
  updated_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create index leads_created_idx on public.leads (created_at desc);
create index leads_ip_idx on public.leads (ip_hash, created_at desc);
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

create or replace function public.submit_lead(
  p_token uuid, p_dream text, p_contact text, p_name text default null, p_package text default null,
  p_source text default 'dream-portal', p_locale text default null, p_page text default null,
  p_hp text default '', p_elapsed_ms integer default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ref text; v_ip text; v_dream text := trim(coalesce(p_dream, '')); v_contact text := trim(coalesce(p_contact, ''));
  v_pkg text := nullif(lower(trim(coalesce(p_package, ''))), '');
begin
  if p_token is null then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  select ref into v_ref from public.leads where client_token = p_token;
  if v_ref is not null then return jsonb_build_object('ok', true, 'ref', v_ref); end if;        -- same form sent twice
  if coalesce(p_hp, '') <> '' or (p_elapsed_ms is not null and p_elapsed_ms < 1500) then
    return jsonb_build_object('ok', false, 'code', 'spam');
  end if;
  if char_length(v_dream) < 3 or char_length(v_dream) > 4000 or char_length(v_contact) < 5 or char_length(v_contact) > 200
     or not (v_contact ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or regexp_replace(v_contact, '\D', '', 'g') ~ '^\d{7,15}$')
     or (v_pkg is not null and v_pkg not in ('spark', 'dream', 'lucid', 'founders', 'menus', 'showroom')) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  v_ip := public.request_ip_hash();
  if (select count(*) from public.leads where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.leads where ip_hash = v_ip and created_at > now() - interval '1 day') >= 15
     or (select count(*) from public.leads where created_at > now() - interval '1 day') >= 400 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  insert into public.leads (client_token, source, package, dream, contact, name, locale, page, ip_hash)
  values (p_token, left(coalesce(nullif(trim(p_source), ''), 'dream-portal'), 60), v_pkg, v_dream, v_contact,
          nullif(left(trim(coalesce(p_name, '')), 120), ''), case when p_locale in ('en', 'he') then p_locale end,
          nullif(left(coalesce(p_page, ''), 500), ''), v_ip)
  on conflict (client_token) do nothing
  returning ref into v_ref;
  if v_ref is null then select ref into v_ref from public.leads where client_token = p_token; end if;
  return jsonb_build_object('ok', true, 'ref', v_ref);
end $$;

-- ---------------------------------------------------------------- businesses and who may edit them
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name_he text not null default '' check (char_length(name_he) <= 80),
  name_en text not null default '' check (char_length(name_en) <= 80),
  area_he text not null default '' check (char_length(area_he) <= 80),
  area_en text not null default '' check (char_length(area_en) <= 80),
  cuisine_he text not null default '' check (char_length(cuisine_he) <= 80),
  cuisine_en text not null default '' check (char_length(cuisine_en) <= 80),
  kind text not null default 'restaurant' check (kind in ('restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other')),
  logo_path text check (logo_path is null or char_length(logo_path) <= 200),
  accent text not null default '#ff8a5c' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  default_lang text not null default 'he' check (default_lang in ('he', 'en')),
  langs text[] not null default '{he,en}' check (langs <@ array['he', 'en'] and cardinality(langs) between 1 and 2),
  currency text not null default 'ILS' check (currency in ('ILS', 'USD', 'EUR', 'GBP')),
  order_url text check (order_url is null or (order_url ~ '^https://[^\s]+$' and char_length(order_url) <= 300)),
  phone text check (phone is null or char_length(phone) <= 40),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  created_by uuid not null references auth.users on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (name_he <> '' or name_en <> '')
);
alter table public.businesses enable row level security;
create trigger businesses_touch before update on public.businesses for each row execute function public.touch_updated_at();

create table public.memberships (
  business_id uuid not null references public.businesses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
alter table public.memberships enable row level security;
create index memberships_user_idx on public.memberships (user_id);

create or replace function public.is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.memberships where business_id = p_business and user_id = (select auth.uid())) $$;

-- a storage path starts with the business id: "<business uuid>/..."
create or replace function public.path_business(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then return null;
end $$;

create table public.entitlements (
  business_id uuid primary key references public.businesses on delete cascade,
  plan text not null default 'trial' check (plan in ('trial', 'pilot', 'paid')),
  status text not null default 'pending' check (status in ('pending', 'trialing', 'active', 'expired', 'suspended')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create trigger entitlements_touch before update on public.entitlements for each row execute function public.touch_updated_at();

-- what the stored row means right now: pending | trialing | active | expired | suspended
create or replace function public.entitlement_state(p_business uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when e.status = 'trialing' and e.trial_ends_at is not null and e.trial_ends_at < now() then 'expired'
    when e.status = 'active' and e.current_period_end is not null and e.current_period_end < now() then 'expired'
    else e.status end
  from public.entitlements e where e.business_id = p_business
$$;

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses on delete cascade,
  surface text not null default 'oak' check (surface ~ '^[a-z][a-z-]{1,24}$'),
  table_img_path text check (table_img_path is null or char_length(table_img_path) <= 200),
  published_revision_id uuid,
  first_published_at timestamptz,
  last_published_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.menus enable row level security;
create trigger menus_touch before update on public.menus for each row execute function public.touch_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  position integer not null default 0,
  name_he text not null default '' check (char_length(name_he) <= 60),
  name_en text not null default '' check (char_length(name_en) <= 60),
  kind text not null default 'food' check (kind in ('food', 'dessert', 'drinks', 'wine', 'beer')),
  scene text not null default 'auto' check (scene in ('auto', 'table', 'bar', 'holo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (name_he <> '' or name_en <> '')
);
alter table public.categories enable row level security;
create index categories_business_idx on public.categories (business_id, position);
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();

create table public.items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  position integer not null default 0,
  name_he text not null default '' check (char_length(name_he) <= 90),
  name_en text not null default '' check (char_length(name_en) <= 90),
  desc_he text not null default '' check (char_length(desc_he) <= 600),
  desc_en text not null default '' check (char_length(desc_en) <= 600),
  price_minor integer check (price_minor is null or price_minor between 0 and 100000000),
  price_note_he text not null default '' check (char_length(price_note_he) <= 80),
  price_note_en text not null default '' check (char_length(price_note_en) <= 80),
  available boolean not null default true,
  tags text[] not null default '{}' check (tags <@ array['vegan', 'vegetarian', 'spicy', 'gf']),
  allergens_he text not null default '' check (char_length(allergens_he) <= 300),
  allergens_en text not null default '' check (char_length(allergens_en) <= 300),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 6000),
  asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (name_he <> '' or name_en <> '')
);
alter table public.items enable row level security;
create index items_category_idx on public.items (category_id, position);
create index items_business_idx on public.items (business_id);
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- one row = one picture of one item on its way from upload to approval (this is also the generation job)
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  item_id uuid references public.items on delete cascade,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready_for_review', 'approved', 'rejected', 'failed')),
  kind text not null default 'relief' check (kind in ('relief', 'photo')),
  relief_class text check (relief_class is null or relief_class in ('flat', 'low', 'medium', 'tall', 'stand')),
  original_path text check (original_path is null or char_length(original_path) <= 200),
  color_path text check (color_path is null or char_length(color_path) <= 200),
  aux_path text check (aux_path is null or char_length(aux_path) <= 200),
  thumb_path text check (thumb_path is null or char_length(thumb_path) <= 200),
  meta jsonb not null default '{}' check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) < 2000),
  provenance jsonb not null default '{}' check (jsonb_typeof(provenance) = 'object' and pg_column_size(provenance) < 4000),
  error_code text check (error_code is null or char_length(error_code) <= 60),
  attempts integer not null default 0,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.assets enable row level security;
create index assets_business_idx on public.assets (business_id, created_at desc);
create index assets_item_idx on public.assets (item_id);
create trigger assets_touch before update on public.assets for each row execute function public.touch_updated_at();
alter table public.items add constraint items_asset_fk foreign key (asset_id) references public.assets (id) on delete set null;

create table public.menu_revisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  number integer not null,
  snapshot jsonb not null,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, number)
);
alter table public.menu_revisions enable row level security;
alter table public.menus add constraint menus_revision_fk foreign key (published_revision_id) references public.menu_revisions (id) on delete set null;

create table public.menu_views_daily (
  business_id uuid not null references public.businesses on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (business_id, day)
);
alter table public.menu_views_daily enable row level security;

create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  at timestamptz not null default now(),
  ok boolean not null default false
);
alter table public.signup_attempts enable row level security;
create index signup_attempts_idx on public.signup_attempts (ip_hash, at desc);

-- ---------------------------------------------------------------- guards (same-business references, limits, state rules)
create or replace function public.guard_category() returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int := coalesce((public.cfg('limits')->>'categories')::int, 24);
begin
  if tg_op = 'UPDATE' and new.business_id <> old.business_id then raise exception 'business_fixed'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.categories where business_id = new.business_id) >= lim then
    raise exception 'limit_categories';
  end if;
  return new;
end $$;
create trigger categories_guard before insert or update on public.categories for each row execute function public.guard_category();

create or replace function public.guard_item() returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int := coalesce((public.cfg('limits')->>'items')::int, 240);
begin
  if tg_op = 'UPDATE' and new.business_id <> old.business_id then raise exception 'business_fixed'; end if;
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.business_id = new.business_id) then
    raise exception 'category_of_other_business';
  end if;
  if new.asset_id is not null and (tg_op = 'INSERT' or new.asset_id is distinct from old.asset_id) then
    if not exists (select 1 from public.assets a where a.id = new.asset_id and a.business_id = new.business_id and a.status = 'approved') then
      raise exception 'asset_not_approved';
    end if;
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.items where business_id = new.business_id) >= lim then
    raise exception 'limit_items';
  end if;
  return new;
end $$;
create trigger items_guard before insert or update on public.items for each row execute function public.guard_item();

create or replace function public.guard_asset() returns trigger language plpgsql security definer set search_path = '' as $$
declare lim jsonb := public.cfg('limits'); p text;
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.attempts := 0;
    if new.status not in ('uploaded', 'processing') then raise exception 'asset_bad_start'; end if;
    if (select count(*) from public.assets where business_id = new.business_id and created_at > now() - interval '1 day') >= coalesce((lim->>'assets_per_day')::int, 120) then
      raise exception 'limit_assets_per_day';
    end if;
    if (select count(*) from public.assets where business_id = new.business_id) >= coalesce((lim->>'assets_total')::int, 900) then
      raise exception 'limit_assets_total';
    end if;
  else
    if new.business_id <> old.business_id then raise exception 'business_fixed'; end if;
    new.created_by := old.created_by;
    if new.status = 'processing' and old.status <> 'processing' then
      new.attempts := old.attempts + 1;
      if new.attempts > coalesce((lim->>'attempts')::int, 5) then raise exception 'limit_attempts'; end if;
    else
      new.attempts := old.attempts;
    end if;
    if old.status = 'approved' and new.status <> 'approved'
       and exists (select 1 from public.items i where i.asset_id = old.id) then
      raise exception 'asset_in_use';
    end if;
  end if;
  if new.item_id is not null and not exists (select 1 from public.items i where i.id = new.item_id and i.business_id = new.business_id) then
    raise exception 'item_of_other_business';
  end if;
  foreach p in array array[new.original_path, new.color_path, new.aux_path, new.thumb_path] loop
    if p is not null and public.path_business(p) is distinct from new.business_id then raise exception 'path_of_other_business'; end if;
  end loop;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if new.color_path is null or new.thumb_path is null or (new.kind = 'relief' and (new.aux_path is null or new.relief_class is null
         or not (new.meta ? 'e') or not (new.meta ? 'h'))) then
      raise exception 'asset_incomplete';
    end if;
    -- approved pictures must already sit in the public bucket (the studio copies them there when the owner approves)
    if (select count(*) from storage.objects o where o.bucket_id = 'menu-public'
          and o.name in (new.color_path, new.thumb_path, coalesce(new.aux_path, new.color_path)))
       < (case when new.kind = 'relief' then 3 else 2 end) then
      raise exception 'asset_files_missing';
    end if;
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger assets_guard before insert or update on public.assets for each row execute function public.guard_asset();

-- ---------------------------------------------------------------- row level security
create policy businesses_select on public.businesses for select to authenticated using ((select public.is_member(id)));
create policy businesses_update on public.businesses for update to authenticated using ((select public.is_member(id))) with check ((select public.is_member(id)));
create policy memberships_select on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy entitlements_select on public.entitlements for select to authenticated using ((select public.is_member(business_id)));
create policy menus_select on public.menus for select to authenticated using ((select public.is_member(business_id)));
create policy menus_update on public.menus for update to authenticated using ((select public.is_member(business_id))) with check ((select public.is_member(business_id)));
create policy categories_all on public.categories for all to authenticated using ((select public.is_member(business_id))) with check ((select public.is_member(business_id)));
create policy items_all on public.items for all to authenticated using ((select public.is_member(business_id))) with check ((select public.is_member(business_id)));
create policy assets_all on public.assets for all to authenticated using ((select public.is_member(business_id))) with check ((select public.is_member(business_id)));
create policy revisions_select on public.menu_revisions for select to authenticated using ((select public.is_member(business_id)));
create policy views_select on public.menu_views_daily for select to authenticated using ((select public.is_member(business_id)));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, update (name_he, name_en, area_he, area_en, cuisine_he, cuisine_en, kind, logo_path, accent, default_lang, langs, currency, order_url, phone, contact_name, contact_phone)
  on public.businesses to authenticated;
grant select on public.businesses, public.memberships, public.entitlements, public.menus, public.menu_revisions, public.menu_views_daily to authenticated;
grant update (surface, table_img_path) on public.menus to authenticated;
grant select, insert, update, delete on public.categories, public.items, public.assets to authenticated;

-- ---------------------------------------------------------------- owner actions
create or replace function public.slug_available(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
     and p_slug not in ('admin', 'api', 'app', 'studio', 'view', 'gen', 'ops', 'demo', 'olea', 'halom', 'menu', 'menus', 'mana', 'www', 'test', 'help', 'support', 'login', 'signup', 'new', 'null', 'undefined')
     and not exists (select 1 from public.businesses where slug = p_slug)
$$;

create or replace function public.create_business(
  p_slug text, p_name_he text default '', p_name_en text default '', p_kind text default 'restaurant',
  p_contact_name text default null, p_contact_phone text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_id uuid; v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'signed_out'); end if;
  if (select count(*) from public.memberships where user_id = uid) >= 5 then return jsonb_build_object('ok', false, 'code', 'limit_businesses'); end if;
  if not public.slug_available(v_slug) then return jsonb_build_object('ok', false, 'code', 'slug_taken'); end if;
  if trim(coalesce(p_name_he, '')) = '' and trim(coalesce(p_name_en, '')) = '' then return jsonb_build_object('ok', false, 'code', 'name_missing'); end if;
  insert into public.businesses (slug, name_he, name_en, kind, contact_name, contact_phone, created_by)
  values (v_slug, left(trim(coalesce(p_name_he, '')), 80), left(trim(coalesce(p_name_en, '')), 80),
          case when p_kind in ('restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other') then p_kind else 'restaurant' end,
          nullif(left(trim(coalesce(p_contact_name, '')), 120), ''), nullif(left(trim(coalesce(p_contact_phone, '')), 40), ''), uid)
  returning id into v_id;
  insert into public.memberships (business_id, user_id, role) values (v_id, uid, 'owner');
  insert into public.menus (business_id) values (v_id);
  insert into public.entitlements (business_id) values (v_id);
  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'slug_taken');
end $$;

-- the snapshot a diner sees, built from the owner's current rows
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
            'asset', case when a.id is null then null
              when a.kind = 'photo' then jsonb_build_object('state', 'photo', 'color', base.u || a.color_path, 'thumb', base.u || a.thumb_path)
              else jsonb_build_object('state', 'relief', 'color', base.u || a.color_path, 'aux', base.u || a.aux_path, 'thumb', base.u || a.thumb_path,
                     'kind', a.relief_class, 'e', a.meta->'e', 'h', a.meta->'h', 'o', a.meta->'o', 's', a.meta->'s') end
          ) order by i.position, i.created_at)
          from public.items i left join public.assets a on a.id = i.asset_id and a.status = 'approved'
          where i.category_id = c.id), '[]'::jsonb)
      ) order by c.position, c.created_at)
      from public.categories c
      where c.business_id = p_business and exists (select 1 from public.items i where i.category_id = c.id)), '[]'::jsonb))
  from b, m, base
$$;
revoke all on function public.build_snapshot(uuid, integer) from public, anon, authenticated;

create or replace function public.preview_snapshot(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(p_business) then raise exception 'not_member'; end if;
  return public.build_snapshot(p_business, 0);
end $$;

create or replace function public.publish_menu(p_business uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_state text; v_n integer; v_snap jsonb; v_rev uuid; v_slug text; v_days int;
begin
  if uid is null or not public.is_member(p_business) then return jsonb_build_object('ok', false, 'code', 'not_member'); end if;
  perform 1 from public.menus where business_id = p_business for update;
  v_state := public.entitlement_state(p_business);
  if v_state in ('expired', 'suspended') then return jsonb_build_object('ok', false, 'code', 'plan_' || v_state); end if;
  if not exists (select 1 from public.items where business_id = p_business) then return jsonb_build_object('ok', false, 'code', 'empty_menu'); end if;
  if v_state = 'pending' then                                   -- the trial starts with the first publication
    v_days := coalesce((public.cfg('trial_days')#>>'{}')::int, 30);
    update public.entitlements set status = 'trialing', trial_started_at = now(), trial_ends_at = now() + make_interval(days => v_days)
    where business_id = p_business;
  end if;
  select coalesce(max(number), 0) + 1 into v_n from public.menu_revisions where business_id = p_business;
  v_snap := public.build_snapshot(p_business, v_n);
  insert into public.menu_revisions (business_id, number, snapshot, note, created_by)
  values (p_business, v_n, v_snap, nullif(left(coalesce(p_note, ''), 200), ''), uid) returning id into v_rev;
  update public.menus set published_revision_id = v_rev, last_published_at = now(), first_published_at = coalesce(first_published_at, now())
  where business_id = p_business;
  select slug into v_slug from public.businesses where id = p_business;
  return jsonb_build_object('ok', true, 'revision', v_n, 'slug', v_slug, 'url', (public.cfg('short_base')#>>'{}') || v_slug);
end $$;

-- put an earlier revision back (the link and QR stay the same)
create or replace function public.restore_revision(p_business uuid, p_number integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rev uuid;
begin
  if not public.is_member(p_business) then return jsonb_build_object('ok', false, 'code', 'not_member'); end if;
  if public.entitlement_state(p_business) in ('expired', 'suspended') then return jsonb_build_object('ok', false, 'code', 'plan_inactive'); end if;
  select id into v_rev from public.menu_revisions where business_id = p_business and number = p_number;
  if v_rev is null then return jsonb_build_object('ok', false, 'code', 'no_revision'); end if;
  update public.menus set published_revision_id = v_rev, last_published_at = now() where business_id = p_business;
  return jsonb_build_object('ok', true, 'revision', p_number);
end $$;

create or replace function public.unpublish_menu(p_business uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member(p_business) then return jsonb_build_object('ok', false, 'code', 'not_member'); end if;
  update public.menus set published_revision_id = null where business_id = p_business;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- what a diner's phone asks for
create or replace function public.public_menu(p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b record; v_snap jsonb; v_state text;
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
    insert into public.menu_views_daily (business_id, day, views) values (b.id, (now() at time zone 'Asia/Jerusalem')::date, 1)
    on conflict (business_id, day) do update set views = public.menu_views_daily.views + 1;
  exception when others then null;      -- counting must never break a menu
  end;
  return jsonb_build_object('state', 'ok', 'snapshot', v_snap);
end $$;

-- ---------------------------------------------------------------- Halom staff
create or replace function public.ops_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  return jsonb_build_object(
    'generatedAt', now(),
    'businesses', coalesce((
      select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
        select b.id, b.slug, b.name_he, b.name_en, b.kind, b.area_he, b.area_en, b.created_at, b.contact_name, b.contact_phone, b.phone,
               (select u.email from auth.users u where u.id = b.created_by) as owner_email,
               (select max(u.last_sign_in_at) from auth.users u join public.memberships ms on ms.user_id = u.id where ms.business_id = b.id) as last_sign_in_at,
               (select count(*) from public.categories c where c.business_id = b.id) as categories,
               (select count(*) from public.items i where i.business_id = b.id) as items,
               (select count(*) from public.items i where i.business_id = b.id and i.asset_id is not null) as items_with_picture,
               (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) from (select a.status, count(*) n from public.assets a where a.business_id = b.id group by a.status) s) as assets,
               (select max(a.updated_at) from public.assets a where a.business_id = b.id) as last_asset_at,
               m.first_published_at, m.last_published_at, (m.published_revision_id is not null) as live,
               (select max(r.number) from public.menu_revisions r where r.business_id = b.id) as revisions,
               e.plan, e.status as plan_status, public.entitlement_state(b.id) as plan_state, e.trial_started_at, e.trial_ends_at, e.current_period_end, e.note as plan_note,
               (select coalesce(sum(v.views), 0) from public.menu_views_daily v where v.business_id = b.id) as views_total,
               (select coalesce(sum(v.views), 0) from public.menu_views_daily v where v.business_id = b.id and v.day > (now() at time zone 'Asia/Jerusalem')::date - 7) as views_7d,
               greatest(b.updated_at, m.updated_at,
                 coalesce((select max(i.updated_at) from public.items i where i.business_id = b.id), b.created_at)) as last_activity_at
        from public.businesses b join public.menus m on m.business_id = b.id join public.entitlements e on e.business_id = b.id
      ) x), '[]'::jsonb),
    'viewsByDay', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views) order by d.day)
       from (select day, sum(views) views from public.menu_views_daily where day > (now() at time zone 'Asia/Jerusalem')::date - 30 group by day) d), '[]'::jsonb),
    'signupsByDay', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'businesses', d.n) order by d.day)
       from (select (created_at at time zone 'Asia/Jerusalem')::date as day, count(*) n from public.businesses where created_at > now() - interval '30 days' group by 1) d), '[]'::jsonb),
    'accountsWithoutBusiness', (select count(*) from auth.users u where not exists (select 1 from public.memberships ms where ms.user_id = u.id)
                                 and not exists (select 1 from public.staff s where s.user_id = u.id)),
    'leads', coalesce((select jsonb_agg(row_to_json(l) order by l.created_at desc) from (
        select id, ref, created_at, source, package, dream, contact, name, locale, page, status, owner, next_action, next_action_on, notes
        from public.leads order by created_at desc limit 300) l), '[]'::jsonb)
  );
end $$;

create or replace function public.ops_set_entitlement(p_business uuid, p_plan text, p_status text, p_until timestamptz default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  update public.entitlements set plan = p_plan, status = p_status,
    trial_ends_at = case when p_status = 'trialing' then coalesce(p_until, trial_ends_at, now() + interval '30 days') else trial_ends_at end,
    trial_started_at = case when p_status = 'trialing' then coalesce(trial_started_at, now()) else trial_started_at end,
    current_period_end = case when p_status = 'active' then p_until else current_period_end end,
    note = coalesce(nullif(left(coalesce(p_note, ''), 500), ''), note)
  where business_id = p_business;
  if not found then return jsonb_build_object('ok', false, 'code', 'no_business'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ops_update_lead(p_id uuid, p_status text default null, p_owner text default null, p_next_action text default null,
                                                  p_next_action_on date default null, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  update public.leads set status = coalesce(p_status, status), owner = coalesce(p_owner, owner), next_action = coalesce(p_next_action, next_action),
    next_action_on = coalesce(p_next_action_on, next_action_on), notes = coalesce(p_notes, notes)
  where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'no_lead'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- who may call what
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.submit_lead(uuid, text, text, text, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.public_menu(text) to anon, authenticated;
grant execute on function public.is_member(uuid), public.is_staff(), public.path_business(text) to authenticated;
grant execute on function public.slug_available(text), public.create_business(text, text, text, text, text, text), public.preview_snapshot(uuid),
  public.publish_menu(uuid, text), public.restore_revision(uuid, integer), public.unpublish_menu(uuid), public.redeem_staff_invite(text),
  public.ops_overview(), public.ops_set_entitlement(uuid, text, text, timestamptz, text),
  public.ops_update_lead(uuid, text, text, text, date, text) to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------- files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('menu-private', 'menu-private', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']),
  ('menu-public', 'menu-public', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy menu_private_rw on storage.objects for all to authenticated
  using (bucket_id = 'menu-private' and (select public.is_member(public.path_business(name))))
  with check (bucket_id = 'menu-private' and (select public.is_member(public.path_business(name))));
create policy menu_public_write on storage.objects for all to authenticated
  using (bucket_id = 'menu-public' and (select public.is_member(public.path_business(name))))
  with check (bucket_id = 'menu-public' and (select public.is_member(public.path_business(name))));
