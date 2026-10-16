-- Mana, clean schema 3/8: the menu. Schedules, sections, dishes, pictures, reusable add-on groups with ONE nesting
-- level, "goes well with", upsell rules, opening hours and closures, availability overrides, published revisions.
--
-- Same-venue integrity is structural: every content table has unique (venue_id, id) and references its parent with
-- (venue_id, parent_id), so a row can never point at another venue's section, group, dish or schedule.
-- Optional references use ON DELETE SET NULL (column), which needs PostgreSQL 15+ (Supabase runs 15 or 17).

-- ---------------------------------------------------------------- shared guards
create function app.guard_content() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.venue_id <> old.venue_id then raise exception 'venue_fixed'; end if;
  if new.id <> old.id then raise exception 'id_fixed'; end if;
  new.created_at := old.created_at;
  return new;
end $$;

-- size limits per venue (or per group / per dish): tg_argv[0] = the key in app_config.limits, tg_argv[1] = the column
create function app.guard_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  lim integer := coalesce((app.cfg('limits')->>tg_argv[0])::integer, 1000000);
  v text := to_jsonb(new)->>tg_argv[1];
  n integer;
begin
  perform pg_advisory_xact_lock(hashtext('limit:' || tg_table_name || ':' || coalesce(v, '')));
  execute format('select count(*) from public.%I where %I = $1::uuid', tg_table_name, tg_argv[1]) into n using v;
  if n >= lim then raise exception 'limit_%', tg_argv[0]; end if;
  return new;
end $$;

-- a list of time windows: [{ days: [0..6], from: 'HH:MM', to: 'HH:MM' }] (to <= from runs past midnight)
create function app.windows_ok(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p) is distinct from 'array' then false
    when jsonb_array_length(p) not between 1 and 14 then false
    else not exists (
      select 1 from jsonb_array_elements(p) w
      where case
        when jsonb_typeof(w) is distinct from 'object' or jsonb_typeof(w->'days') is distinct from 'array' then true
        when jsonb_array_length(w->'days') not between 1 and 7 then true
        when exists (select 1 from jsonb_array_elements(w->'days') d where d::text !~ '^[0-6]$') then true
        when (select count(distinct d) from jsonb_array_elements(w->'days') d) <> jsonb_array_length(w->'days') then true
        when coalesce(w->>'from', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(w->>'to', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then true
        else false end)
    end
$$;

-- ---------------------------------------------------------------- schedules: day parts (breakfast) and specials (Wednesdays)
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind text not null check (kind in ('day_part', 'special')),
  name_he text not null default '' check (char_length(name_he) <= 60),
  name_en text not null default '' check (char_length(name_en) <= 60),
  windows jsonb not null check (app.windows_ok(windows)),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  check (valid_from is null or valid_to is null or valid_from <= valid_to)
);
alter table public.schedules enable row level security;
create trigger schedules_touch before update on public.schedules for each row execute function app.touch();
create trigger schedules_clean before insert or update on public.schedules for each row execute function app.strip_text('name_he', 'name_en');
create trigger schedules_fixed before update on public.schedules for each row execute function app.guard_content();
create trigger schedules_limit before insert on public.schedules for each row execute function app.guard_limit('schedules', 'venue_id');

-- ---------------------------------------------------------------- sections
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  position integer not null default 0,
  name_he text not null default '' check (char_length(name_he) <= 60),
  name_en text not null default '' check (char_length(name_en) <= 60),
  kind text not null default 'food' check (kind in ('food', 'dessert', 'drinks', 'wine', 'beer')),
  scene text not null default 'auto' check (scene in ('auto', 'table', 'bar', 'holo')),
  room text check (room is null or room in ('table', 'vitrine', 'cellar', 'taps', 'cocktail')),
  schedule_id uuid,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  foreign key (venue_id, schedule_id) references public.schedules (venue_id, id) on delete set null (schedule_id),
  check (name_he <> '' or name_en <> '')
);
alter table public.sections enable row level security;
create index sections_venue_idx on public.sections (venue_id, position);
create trigger sections_touch before update on public.sections for each row execute function app.touch();
create trigger sections_clean before insert or update on public.sections for each row execute function app.strip_text('name_he', 'name_en');
create trigger sections_fixed before update on public.sections for each row execute function app.guard_content();
create trigger sections_limit before insert on public.sections for each row execute function app.guard_limit('sections', 'venue_id');

-- ---------------------------------------------------------------- dishes
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  section_id uuid not null,
  position integer not null default 0,
  name_he text not null default '' check (char_length(name_he) <= 90),
  name_en text not null default '' check (char_length(name_en) <= 90),
  desc_he text not null default '' check (char_length(desc_he) <= 600),
  desc_en text not null default '' check (char_length(desc_en) <= 600),
  price integer check (price is null or price between 0 and 10000000),
  price_note_he text not null default '' check (char_length(price_note_he) <= 80),
  price_note_en text not null default '' check (char_length(price_note_en) <= 80),
  tags text[] not null default '{}' check (tags <@ array['vegan', 'vegetarian', 'spicy', 'gf']::text[]),
  allergens_he text not null default '' check (char_length(allergens_he) <= 300),
  allergens_en text not null default '' check (char_length(allergens_en) <= 300),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 6000),
  asset_id uuid,
  stock_id text check (stock_id is null or stock_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  schedule_id uuid,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  foreign key (venue_id, section_id) references public.sections (venue_id, id) on delete cascade,
  foreign key (venue_id, schedule_id) references public.schedules (venue_id, id) on delete set null (schedule_id),
  check (name_he <> '' or name_en <> '')
);
alter table public.dishes enable row level security;
comment on column public.dishes.price is 'Agorot, VAT included. null = no price shown (and not orderable).';
comment on column public.dishes.allergens_he is 'The owner''s own words. Never generated.';
create index dishes_section_idx on public.dishes (section_id, position);
create index dishes_venue_idx on public.dishes (venue_id);
create trigger dishes_touch before update on public.dishes for each row execute function app.touch();
create trigger dishes_clean before insert or update on public.dishes for each row
  execute function app.strip_text('name_he', 'name_en', 'desc_he', 'desc_en', 'price_note_he', 'price_note_en', 'allergens_he', 'allergens_en');
create trigger dishes_fixed before update on public.dishes for each row execute function app.guard_content();
create trigger dishes_limit before insert on public.dishes for each row execute function app.guard_limit('dishes', 'venue_id');

-- ---------------------------------------------------------------- pictures: one row per attempt, from upload to approval
-- original_path lives in the private bucket; color/aux/thumb are copied to the public bucket when the owner approves.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  dish_id uuid,
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
  created_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  foreign key (venue_id, dish_id) references public.dishes (venue_id, id) on delete set null (dish_id)
);
alter table public.assets enable row level security;
create index assets_venue_idx on public.assets (venue_id, created_at desc);
create index assets_dish_idx on public.assets (dish_id);
create trigger assets_touch before update on public.assets for each row execute function app.touch();
create trigger assets_fixed before update on public.assets for each row execute function app.guard_content();
alter table public.dishes add foreign key (venue_id, asset_id) references public.assets (venue_id, id) on delete set null (asset_id);

create function app.guard_asset() returns trigger language plpgsql security definer set search_path = '' as $$
declare lim jsonb := app.cfg('limits'); p text;
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.attempts := 0;
    new.reviewed_at := null;
    if new.status not in ('uploaded', 'processing') then raise exception 'asset_bad_start'; end if;
  else
    new.created_by := old.created_by;
    if new.status = 'processing' and old.status <> 'processing' then
      new.attempts := old.attempts + 1;
      if new.attempts > coalesce((lim->>'attempts')::integer, 5) then raise exception 'limit_attempts'; end if;
    else
      new.attempts := old.attempts;
    end if;
    if old.status = 'approved' and new.status <> 'approved' and exists (select 1 from public.dishes d where d.asset_id = old.id) then
      raise exception 'asset_in_use';
    end if;
  end if;
  foreach p in array array[new.original_path, new.color_path, new.aux_path, new.thumb_path] loop
    if p is not null and app.path_venue(p) is distinct from new.venue_id then raise exception 'path_of_other_venue'; end if;
  end loop;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if new.color_path is null or new.thumb_path is null
       or (new.kind = 'relief' and (new.aux_path is null or new.relief_class is null or not (new.meta ? 'e') or not (new.meta ? 'h'))) then
      raise exception 'asset_incomplete';
    end if;
    -- an approved picture must already sit in the public bucket (the client app copies it there on approval)
    if (select count(*) from storage.objects o where o.bucket_id = 'menu-public'
          and o.name in (new.color_path, new.thumb_path, coalesce(new.aux_path, new.color_path)))
       < (case when new.kind = 'relief' then 3 else 2 end) then
      raise exception 'asset_files_missing';
    end if;
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger assets_guard before insert or update on public.assets for each row execute function app.guard_asset();

-- a dish shows only an approved picture of its own venue
create function app.guard_dish_asset() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.asset_id is not null and (tg_op = 'INSERT' or new.asset_id is distinct from old.asset_id)
     and not exists (select 1 from public.assets a where a.id = new.asset_id and a.venue_id = new.venue_id and a.status = 'approved') then
    raise exception 'asset_not_approved';
  end if;
  return new;
end $$;
create trigger dishes_asset before insert or update of asset_id on public.dishes for each row execute function app.guard_dish_asset();

-- ---------------------------------------------------------------- add-on groups: reusable across dishes
-- min_units/max_units count units (the sum of quantities) across the group's options; min >= 1 = required.
create table public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 60),
  name_he text not null default '' check (char_length(name_he) <= 60),
  name_en text not null default '' check (char_length(name_en) <= 60),
  selection text not null default 'single' check (selection in ('single', 'multiple')),
  min_units integer not null default 0 check (min_units between 0 and 30),
  max_units integer not null default 1 check (max_units between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  check (min_units <= max_units),
  check (selection = 'multiple' or max_units = 1),
  check (name_he <> '' or name_en <> '')
);
alter table public.addon_groups enable row level security;
comment on column public.addon_groups.label is 'The owner''s own label in the group library ("Side, burgers"). Never shown to guests.';
create index addon_groups_venue_idx on public.addon_groups (venue_id);
create trigger addon_groups_touch before update on public.addon_groups for each row execute function app.touch();
create trigger addon_groups_clean before insert or update on public.addon_groups for each row execute function app.strip_text('label', 'name_he', 'name_en');
create trigger addon_groups_fixed before update on public.addon_groups for each row execute function app.guard_content();
create trigger addon_groups_limit before insert on public.addon_groups for each row execute function app.guard_limit('addon_groups', 'venue_id');

create table public.addon_options (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  group_id uuid not null,
  position integer not null default 0,
  name_he text not null default '' check (char_length(name_he) <= 60),
  name_en text not null default '' check (char_length(name_en) <= 60),
  price integer not null default 0 check (price between 0 and 10000000),
  max_qty integer not null default 1 check (max_qty between 1 and 10),
  is_default boolean not null default false,
  opens_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  foreign key (venue_id, group_id) references public.addon_groups (venue_id, id) on delete cascade,
  foreign key (venue_id, opens_group_id) references public.addon_groups (venue_id, id) on delete set null (opens_group_id),
  check (opens_group_id is null or opens_group_id <> group_id),
  check (opens_group_id is null or max_qty = 1),
  check (name_he <> '' or name_en <> '')
);
alter table public.addon_options enable row level security;
comment on column public.addon_options.price is 'Agorot added per unit, VAT included; 0 for free choices and removals.';
comment on column public.addon_options.opens_group_id is 'The ONE nesting level: choosing this option opens that group. A group that is opened may not contain options that open another (trigger).';
create index addon_options_group_idx on public.addon_options (group_id, position);
create index addon_options_opens_idx on public.addon_options (opens_group_id) where opens_group_id is not null;
create trigger addon_options_touch before update on public.addon_options for each row execute function app.touch();
create trigger addon_options_clean before insert or update on public.addon_options for each row execute function app.strip_text('name_he', 'name_en');
create trigger addon_options_fixed before update on public.addon_options for each row execute function app.guard_content();
create trigger addon_options_limit before insert on public.addon_options for each row execute function app.guard_limit('options_per_group', 'group_id');

-- One nesting level, as an invariant: no group is both opened by an option and holds an option that opens a group.
-- Serialised per venue so two concurrent edits cannot build two levels between them.
create function app.guard_nesting() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.opens_group_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('addon-nesting:' || new.venue_id::text));
  if exists (select 1 from public.addon_options o where o.opens_group_id = new.group_id and o.id <> new.id) then
    raise exception 'nesting_too_deep' using detail = 'this option''s group is itself opened by another option';
  end if;
  if exists (select 1 from public.addon_options o where o.group_id = new.opens_group_id and o.opens_group_id is not null and o.id <> new.id) then
    raise exception 'nesting_too_deep' using detail = 'the group it opens already opens another group';
  end if;
  return new;
end $$;
create trigger addon_options_nesting before insert or update of group_id, opens_group_id on public.addon_options
  for each row execute function app.guard_nesting();

-- a group attached to a dish, in order, with the dish's own (tighter) limits when set
create table public.dish_addon_groups (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  dish_id uuid not null,
  group_id uuid not null,
  position integer not null default 0,
  min_units integer check (min_units is null or min_units between 0 and 30),
  max_units integer check (max_units is null or max_units between 1 and 30),
  created_at timestamptz not null default now(),
  unique (venue_id, id),
  unique (dish_id, group_id),
  foreign key (venue_id, dish_id) references public.dishes (venue_id, id) on delete cascade,
  foreign key (venue_id, group_id) references public.addon_groups (venue_id, id) on delete cascade,
  check (min_units is null or max_units is null or min_units <= max_units)
);
alter table public.dish_addon_groups enable row level security;
create index dish_addon_groups_group_idx on public.dish_addon_groups (group_id);
create trigger dish_addon_groups_fixed before update on public.dish_addon_groups for each row execute function app.guard_content();
create trigger dish_addon_groups_limit before insert on public.dish_addon_groups for each row execute function app.guard_limit('groups_per_dish', 'dish_id');

create function app.guard_dish_addon() returns trigger language plpgsql security definer set search_path = '' as $$
declare g record; lo integer; hi integer;
begin
  select selection, min_units, max_units into g from public.addon_groups where id = new.group_id;
  lo := coalesce(new.min_units, g.min_units);
  hi := coalesce(new.max_units, g.max_units);
  if g.selection = 'single' and hi <> 1 then raise exception 'single_max'; end if;
  if lo > hi then raise exception 'limits_invalid'; end if;
  -- a dish may only tighten its group's limits (the snapshot also clamps, should the group be tightened later)
  if (new.min_units is not null and new.min_units < g.min_units) or (new.max_units is not null and new.max_units > g.max_units) then
    raise exception 'limits_loosened';
  end if;
  return new;
end $$;
create trigger dish_addon_groups_guard before insert or update on public.dish_addon_groups for each row execute function app.guard_dish_addon();

-- ---------------------------------------------------------------- "goes well with": an ordered list per dish
create table public.dish_relations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  dish_id uuid not null,
  related_dish_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (venue_id, id),
  unique (dish_id, related_dish_id),
  foreign key (venue_id, dish_id) references public.dishes (venue_id, id) on delete cascade,
  foreign key (venue_id, related_dish_id) references public.dishes (venue_id, id) on delete cascade,
  check (dish_id <> related_dish_id)
);
alter table public.dish_relations enable row level security;
create index dish_relations_related_idx on public.dish_relations (related_dish_id);
create trigger dish_relations_fixed before update on public.dish_relations for each row execute function app.guard_content();
create trigger dish_relations_limit before insert on public.dish_relations for each row execute function app.guard_limit('related', 'dish_id');

-- ---------------------------------------------------------------- upsell rules (F06)
create table public.upsell_rules (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 80),
  trigger text not null check (trigger in ('sheet', 'add', 'checkout')),
  scope_kind text not null default 'all' check (scope_kind in ('all', 'section', 'dish')),
  scope_ids uuid[] not null default '{}' check (cardinality(scope_ids) <= 400),
  days smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  from_time time,
  to_time time,
  basket_has_dishes uuid[] not null default '{}' check (cardinality(basket_has_dishes) <= 400),
  basket_has_sections uuid[] not null default '{}' check (cardinality(basket_has_sections) <= 40),
  basket_lacks_dishes uuid[] not null default '{}' check (cardinality(basket_lacks_dishes) <= 400),
  basket_lacks_sections uuid[] not null default '{}' check (cardinality(basket_lacks_sections) <= 40),
  suggest_kind text not null check (suggest_kind in ('dish', 'option')),
  suggest_dish_id uuid,
  suggest_option_id uuid,
  line_he text not null default '' check (char_length(line_he) <= 120),
  line_en text not null default '' check (char_length(line_en) <= 120),
  priority integer not null default 50 check (priority between 0 and 100),
  cap integer not null default 1 check (cap between 1 and 5),
  active boolean not null default true,
  -- why the database switched the rule off (see app.scrub_rule_refs); cleared when the rule gets a condition again
  inactive_reason text check (inactive_reason in ('basket_has_emptied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, id),
  check (inactive_reason is null or not active),
  -- a rule whose suggestion is deleted goes with it (the activity log records the deletion)
  foreign key (venue_id, suggest_dish_id) references public.dishes (venue_id, id) on delete cascade,
  foreign key (venue_id, suggest_option_id) references public.addon_options (venue_id, id) on delete cascade,
  check ((scope_kind = 'all') = (cardinality(scope_ids) = 0)),
  check ((from_time is null) = (to_time is null)),
  check (from_time is null or (extract(second from from_time) = 0 and extract(second from to_time) = 0)),
  check ((suggest_kind = 'dish' and suggest_dish_id is not null and suggest_option_id is null)
      or (suggest_kind = 'option' and suggest_option_id is not null and suggest_dish_id is null)),
  check (not (suggest_kind = 'option' and trigger = 'checkout'))
);
alter table public.upsell_rules enable row level security;
create index upsell_rules_venue_idx on public.upsell_rules (venue_id) where active;
create trigger upsell_rules_touch before update on public.upsell_rules for each row execute function app.touch();
create trigger upsell_rules_clean before insert or update on public.upsell_rules for each row execute function app.strip_text('label', 'line_he', 'line_en');
create trigger upsell_rules_fixed before update on public.upsell_rules for each row execute function app.guard_content();
create trigger upsell_rules_limit before insert on public.upsell_rules for each row execute function app.guard_limit('rules', 'venue_id');

-- the id lists cannot carry foreign keys: check that each id is a dish or section of the same venue.
-- A rule the database switched off because its "basket has" list lost its last target (inactive_reason
-- 'basket_has_emptied') comes back on only with a new condition: switching it on with the list still empty is refused
-- (rule_condition_emptied), since that would turn "when the basket has X" into "always". Giving it a target again
-- clears the reason. The reason cannot be cleared by hand while the list is empty; a rule meant to have no condition is
-- a new rule.
create function app.guard_rule() returns trigger language plpgsql security definer set search_path = '' as $$
declare dish_ids uuid[]; section_ids uuid[];
begin
  if tg_op = 'INSERT' then
    new.inactive_reason := null;
  elsif old.inactive_reason is not null then
    if cardinality(new.basket_has_dishes) + cardinality(new.basket_has_sections) > 0 then
      new.inactive_reason := null;
    else
      new.inactive_reason := old.inactive_reason;
      if new.active then raise exception 'rule_condition_emptied'; end if;
    end if;
  end if;
  dish_ids := new.basket_has_dishes || new.basket_lacks_dishes || case when new.scope_kind = 'dish' then new.scope_ids else '{}'::uuid[] end;
  section_ids := new.basket_has_sections || new.basket_lacks_sections || case when new.scope_kind = 'section' then new.scope_ids else '{}'::uuid[] end;
  if exists (select 1 from unnest(dish_ids) x(id) where not exists (select 1 from public.dishes d where d.id = x.id and d.venue_id = new.venue_id))
     or exists (select 1 from unnest(section_ids) x(id) where not exists (select 1 from public.sections s where s.id = x.id and s.venue_id = new.venue_id)) then
    raise exception 'rule_ref_unknown';
  end if;
  return new;
end $$;
create trigger upsell_rules_guard before insert or update on public.upsell_rules for each row execute function app.guard_rule();

-- A deleted dish or section leaves no stale id in a rule's lists; a rule whose whole scope is gone goes with it. A rule
-- whose "basket has" list loses its last target is switched off and the switch is logged: an emptied list would read as
-- "no condition", and a condition must never turn into "always".
create function app.scrub_rule_refs() returns trigger language plpgsql security definer set search_path = '' as $$
declare kind text := case tg_table_name when 'dishes' then 'dish' else 'section' end; emptied uuid[];
begin
  if not exists (select 1 from public.venues v where v.id = old.venue_id) then return null; end if;
  delete from public.upsell_rules r
  where r.venue_id = old.venue_id and r.scope_kind = kind and r.scope_ids = array[old.id];
  select coalesce(array_agg(r.id), '{}') into emptied from public.upsell_rules r
  where r.venue_id = old.venue_id and r.active
    and array_remove(case when kind = 'dish' then r.basket_has_dishes else r.basket_has_sections end, old.id)
        || case when kind = 'dish' then r.basket_has_sections else r.basket_has_dishes end = '{}'::uuid[]
    and old.id = any (case when kind = 'dish' then r.basket_has_dishes else r.basket_has_sections end);
  if kind = 'dish' then
    update public.upsell_rules r set scope_ids = array_remove(r.scope_ids, old.id),
      basket_has_dishes = array_remove(r.basket_has_dishes, old.id), basket_lacks_dishes = array_remove(r.basket_lacks_dishes, old.id)
    where r.venue_id = old.venue_id
      and ((r.scope_kind = 'dish' and old.id = any (r.scope_ids)) or old.id = any (r.basket_has_dishes) or old.id = any (r.basket_lacks_dishes));
  else
    update public.upsell_rules r set scope_ids = array_remove(r.scope_ids, old.id),
      basket_has_sections = array_remove(r.basket_has_sections, old.id), basket_lacks_sections = array_remove(r.basket_lacks_sections, old.id)
    where r.venue_id = old.venue_id
      and ((r.scope_kind = 'section' and old.id = any (r.scope_ids)) or old.id = any (r.basket_has_sections) or old.id = any (r.basket_lacks_sections));
  end if;
  if cardinality(emptied) > 0 then
    update public.upsell_rules set active = false, inactive_reason = 'basket_has_emptied' where id = any (emptied);
    perform app.log(old.venue_id, 'upsell_rules.deactivated', 'upsell_rules', emptied::text[],
                    jsonb_build_object('reason', 'basket_has_emptied', 'deleted', kind, 'deletedId', old.id), cardinality(emptied));
  end if;
  return null;
end $$;
create trigger dishes_scrub_rules after delete on public.dishes for each row execute function app.scrub_rule_refs();
create trigger sections_scrub_rules after delete on public.sections for each row execute function app.scrub_rule_refs();

-- ---------------------------------------------------------------- opening hours and closed dates (venue-local time)
-- One row per window; a window belongs to the weekday it opens on; closes <= opens runs past midnight.
create table public.venue_hours (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null check (extract(second from opens) = 0),
  closes time not null check (extract(second from closes) = 0),
  created_at timestamptz not null default now(),
  unique (venue_id, id),
  unique (venue_id, weekday, opens)
);
alter table public.venue_hours enable row level security;
comment on column public.venue_hours.weekday is '0 = Sunday ... 6 = Saturday, in the venue''s time zone.';
create trigger venue_hours_fixed before update on public.venue_hours for each row execute function app.guard_content();
create trigger venue_hours_limit before insert on public.venue_hours for each row execute function app.guard_limit('hours', 'venue_id');

create table public.venue_closures (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note_he text not null default '' check (char_length(note_he) <= 80),
  note_en text not null default '' check (char_length(note_en) <= 80),
  created_at timestamptz not null default now(),
  unique (venue_id, id),
  check (from_date <= to_date and to_date - from_date <= 366)
);
alter table public.venue_closures enable row level security;
create index venue_closures_venue_idx on public.venue_closures (venue_id, to_date);
create trigger venue_closures_fixed before update on public.venue_closures for each row execute function app.guard_content();
create trigger venue_closures_clean before insert or update on public.venue_closures for each row execute function app.strip_text('note_he', 'note_en');
create trigger venue_closures_limit before insert on public.venue_closures for each row execute function app.guard_limit('closures', 'venue_id');

-- ---------------------------------------------------------------- venue-local time (the same rules as packages/contracts/src/time.ts)
-- A local time that does not exist (spring forward) uses the offset before the change; one that happens twice
-- (fall back) is the second one: exactly what `timestamp AT TIME ZONE zone` does. supabase/tests compares the two.
create function app.zoned(p_date date, p_time time, p_tz text) returns timestamptz
language sql immutable set search_path = '' as $$ select (p_date + p_time) at time zone p_tz $$;

create function app.local_date(p_at timestamptz, p_tz text) returns date
language sql immutable set search_path = '' as $$ select (p_at at time zone p_tz)::date $$;

create function app.venue_tz(p_venue uuid) returns text
language sql stable security definer set search_path = '' as $$ select v.time_zone from public.venues v where v.id = p_venue $$;

create function app.is_closed_on(p_venue uuid, p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.venue_closures c where c.venue_id = p_venue and p_date between c.from_date and c.to_date)
$$;

-- the opening windows that open on one local date, as instants
create function app.windows_on(p_venue uuid, p_date date) returns table (starts timestamptz, ends timestamptz)
language sql stable security definer set search_path = '' as $$
  select app.zoned(p_date, h.opens, v.time_zone),
         app.zoned(case when h.closes <= h.opens then p_date + 1 else p_date end, h.closes, v.time_zone)
  from public.venue_hours h join public.venues v on v.id = h.venue_id
  where h.venue_id = p_venue and h.weekday = extract(dow from p_date)::smallint
$$;

-- null when the venue has no hours (then it is never treated as closed)
create function app.is_open_at(p_venue uuid, p_at timestamptz) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare d date := app.local_date(p_at, app.venue_tz(p_venue)); dd date;
begin
  if not exists (select 1 from public.venue_hours where venue_id = p_venue) then return null; end if;
  foreach dd in array array[d - 1, d] loop
    if not app.is_closed_on(p_venue, dd)
       and exists (select 1 from app.windows_on(p_venue, dd) w where w.starts <= p_at and p_at < w.ends) then
      return true;
    end if;
  end loop;
  return false;
end $$;

create function app.next_opening(p_venue uuid, p_after timestamptz, p_horizon integer default 14) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare d date := app.local_date(p_after, app.venue_tz(p_venue)); i integer; t timestamptz;
begin
  if not exists (select 1 from public.venue_hours where venue_id = p_venue) then return null; end if;
  for i in 0 .. p_horizon loop
    if not app.is_closed_on(p_venue, d + i) then
      select min(w.starts) into t from app.windows_on(p_venue, d + i) w where w.starts > p_after;
      if t is not null then return t; end if;
    end if;
  end loop;
  return null;
end $$;

-- when an availability override that starts at p_start ends (null = indefinitely); see resolveUntil in the contracts
create function app.resolve_until(p_venue uuid, p_spec jsonb, p_start timestamptz) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare tz text := app.venue_tz(p_venue); today date := app.local_date(p_start, app.venue_tz(p_venue)); t timestamptz;
begin
  case p_spec->>'kind'
    when 'duration' then
      return p_start + make_interval(mins => (p_spec->>'minutes')::integer);
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

create function app.until_spec_ok(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p) <> 'object' then return false; end if;
  case p->>'kind'
    when 'duration' then return jsonb_typeof(p->'minutes') = 'number' and (p->>'minutes') ~ '^[0-9]+$' and (p->>'minutes')::integer between 1 and 43200;
    when 'time' then return coalesce(p->>'at', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
    when 'date' then return coalesce(p->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (p->>'date')::date is not null;
    when 'next_opening', 'indefinite' then return true;
    else return false;
  end case;
exception when others then
  return false;
end $$;

-- ---------------------------------------------------------------- availability: off now, for 2 h, until opening tomorrow, until a date, indefinitely
-- Restores by the clock (until_at is resolved when stored), so no job is needed; "restore" sets restored_at.
-- Rows are kept as history: who took what off, when, for how long.
create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  target_kind text not null check (target_kind in ('section', 'dish', 'option')),
  target_id uuid not null,
  starts_at timestamptz not null default now(),
  until_kind text not null check (until_kind in ('duration', 'time', 'next_opening', 'date', 'indefinite')),
  until_spec jsonb not null check (app.until_spec_ok(until_spec) and until_spec->>'kind' = until_kind),
  until_at timestamptz,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_by_kind text not null default 'system' check (created_by_kind in ('owner', 'manager', 'counter', 'staff', 'system')),
  restored_at timestamptz,
  restored_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (until_at is null or until_at > starts_at),
  check ((until_kind = 'indefinite') = (until_at is null))
);
alter table public.availability_overrides enable row level security;
create index availability_live_idx on public.availability_overrides (venue_id, target_kind, target_id) where restored_at is null;
create index availability_venue_idx on public.availability_overrides (venue_id, created_at desc);

create function app.actor_kind(p_venue uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  if (select auth.uid()) is null then return 'system'; end if;
  if current_setting('mana.via', true) = 'act_for_owner' and app.is_staff() then return 'staff'; end if;
  r := app.member_role(p_venue);
  if r is not null then return r; end if;
  if app.is_staff() then return 'staff'; end if;
  return 'system';
end $$;

create function app.guard_override() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not app.until_spec_ok(new.until_spec) or new.until_spec->>'kind' is distinct from new.until_kind then
      raise exception 'until_invalid';
    end if;
    if not (
      (new.target_kind = 'section' and exists (select 1 from public.sections s where s.id = new.target_id and s.venue_id = new.venue_id))
      or (new.target_kind = 'dish' and exists (select 1 from public.dishes d where d.id = new.target_id and d.venue_id = new.venue_id))
      or (new.target_kind = 'option' and exists (select 1 from public.addon_options o where o.id = new.target_id and o.venue_id = new.venue_id))
    ) then
      raise exception 'target_unknown';
    end if;
    new.starts_at := least(greatest(coalesce(new.starts_at, now()), now() - interval '1 minute'), now() + interval '7 days');
    new.until_at := app.resolve_until(new.venue_id, new.until_spec, new.starts_at);
    if new.until_at is not null and new.until_at <= new.starts_at then raise exception 'until_in_past'; end if;
    new.created_by := (select auth.uid());
    new.created_by_kind := app.actor_kind(new.venue_id);
    new.restored_at := null;
    new.restored_by := null;
    new.created_at := now();
    return new;
  end if;
  -- an update can only restore (once)
  if (new.venue_id, new.target_kind, new.target_id, new.starts_at, new.until_kind, new.until_spec, new.until_at, new.note,
      new.created_by, new.created_by_kind, new.created_at)
     is distinct from
     (old.venue_id, old.target_kind, old.target_id, old.starts_at, old.until_kind, old.until_spec, old.until_at, old.note,
      old.created_by, old.created_by_kind, old.created_at) then
    raise exception 'override_fixed';
  end if;
  if old.restored_at is not null then
    new.restored_at := old.restored_at;
    new.restored_by := old.restored_by;
  elsif new.restored_at is not null then
    new.restored_at := now();
    new.restored_by := (select auth.uid());
  end if;
  return new;
end $$;
create trigger availability_overrides_guard before insert or update on public.availability_overrides
  for each row execute function app.guard_override();

-- ---------------------------------------------------------------- published revisions: append-only
create table public.menu_revisions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete restrict,
  number integer not null check (number >= 1),
  snapshot_version smallint not null check (snapshot_version >= 2),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and (snapshot->>'v')::smallint = snapshot_version),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (venue_id, number),
  unique (venue_id, id)
);
alter table public.menu_revisions enable row level security;
alter table public.venues add foreign key (id, published_revision_id) references public.menu_revisions (venue_id, id) on delete restrict;

create function app.append_only() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'append_only' using detail = tg_table_name || ' rows are never changed or deleted';
end $$;
create trigger menu_revisions_append_only before update or delete on public.menu_revisions for each row execute function app.append_only();
create trigger menu_revisions_no_truncate before truncate on public.menu_revisions for each statement execute function app.append_only();
