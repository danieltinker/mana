-- Mana, clean schema 7/8: who may do what. Every grant and every row-level security policy lives in this file, so
-- the access model can be read (and reviewed) in one place. supabase/tests checks each rule.
--
-- Roles
--   anon            a guest's phone or the product page: no table at all; only public_menu, track_events, submit_lead.
--   authenticated   a signed-in person. What they reach depends on venue_members.role and on public.staff:
--     owner         everything of their venue (menu, hours, availability, settings, team, records, publish)
--     manager       like the owner, except the team, the support switch and plan
--     counter       reads the menu; sets and restores availability; nothing else (cannot change a price)
--     Halom support reads across venues; writes into a venue's menu ONLY through act_for_owner (logged, with a
--                   reason); approves venues and sets plans through ops_* functions (logged, with a reason); reads
--                   leads (personal data) only through ops_leads, which logs every read
--     Halom admin   like support, and creates staff invites (create_staff_invite)
--                   (staff count as staff only with an MFA session when app_config.staff_require_aal2 is on)
--   service_role    edge functions (the scanner): bypasses RLS; never in a browser; reads the records, never writes them.
--
-- Helpers (schema app, SECURITY DEFINER): is_member, is_owner, can_edit (owner|manager), can_operate
-- (owner|manager|counter), can_read (member or staff), can_see_records (owner|manager or staff), is_staff.

-- ---------------------------------------------------------------- start from nothing
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema app from anon, authenticated;
-- Supabase grants every new table, sequence and function in public to the API roles by default. Mana opts out:
-- every later migration grants what it adds, by name, here or in its own access section (supabase/README.md).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- (PostgreSQL also grants EXECUTE on every new function to PUBLIC, and that default can only be revoked globally,
-- which would reach other schemas. Instead each migration revokes what it creates, and supabase/tests fails when anon
-- or authenticated can run anything beyond the RPCs granted below.)
-- The service role (edge functions such as the scanner) bypasses RLS, so it gets only what it needs, granted explicitly
-- (newer Supabase projects do not grant new tables to the API roles by default): never TRUNCATE, TRIGGER or REFERENCES;
-- the records (activity log, revisions, events, rollups) are read-only to it; availability overrides are never deleted.
revoke all on all tables in schema public from service_role;
revoke all on all tables in schema app from service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke insert, update, delete on public.activity_log, public.menu_revisions, public.events, public.rollups_minute, public.rollups_day
  from service_role;
revoke delete on public.availability_overrides from service_role;
grant select on all tables in schema app to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public revoke truncate, trigger, references on tables from service_role;

-- ---------------------------------------------------------------- venues and people
grant select on public.venues to authenticated;
grant update (name_he, name_en, area_he, area_en, cuisine_he, cuisine_en, kind, default_lang, langs, time_zone, accent, surface, template,
              logo_path, table_img_path, order_url, book_url, phone, sold_out_display, support_can_act)
  on public.venues to authenticated;
create policy venues_read on public.venues for select to authenticated using ((select app.can_read(id)));
create policy venues_edit on public.venues for update to authenticated using ((select app.can_edit(id))) with check ((select app.can_edit(id)));
-- the support switch is the owner's alone (a manager cannot turn Halom's access on or off)
create function app.guard_venue_owner_fields() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.support_can_act is distinct from old.support_can_act and current_user = 'authenticated' and not app.is_owner(new.id) then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger venues_owner_fields before update of support_can_act on public.venues for each row execute function app.guard_venue_owner_fields();

grant select, delete on public.venue_members to authenticated;
grant update (role) on public.venue_members to authenticated;
create policy members_read on public.venue_members for select to authenticated
  using (user_id = (select auth.uid()) or (select app.can_see_records(venue_id)));
-- no insert from clients in phase 1: create_venue adds the owner; team invites are a phase-2 RPC (invite, accept)
create policy members_change on public.venue_members for update to authenticated
  using ((select app.is_owner(venue_id))) with check ((select app.is_owner(venue_id)));
create policy members_remove on public.venue_members for delete to authenticated using ((select app.is_owner(venue_id)));
-- a venue always keeps an owner. The venue's row is locked first, so two owners removing each other at the same time
-- are serialised: the second sees the first's change and is refused.
create function app.guard_last_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1 from public.venues v where v.id = old.venue_id for no key update;
    if found and not exists (select 1 from public.venue_members m where m.venue_id = old.venue_id and m.role = 'owner' and m.user_id <> old.user_id) then
      raise exception 'last_owner';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger venue_members_last_owner before update or delete on public.venue_members for each row execute function app.guard_last_owner();

grant select on public.staff to authenticated;
create policy staff_read on public.staff for select to authenticated using (user_id = (select auth.uid()) or (select app.is_staff()));
-- staff_invites: no access (create_staff_invite writes the hash, redeem_staff_invite reads it)

grant select on public.entitlements to authenticated;
create policy entitlements_read on public.entitlements for select to authenticated using ((select app.can_see_records(venue_id)));

-- ---------------------------------------------------------------- the menu: members and staff read; owner and manager write
do $$
declare t text;
begin
  foreach t in array array['schedules', 'sections', 'dishes', 'assets', 'addon_groups', 'addon_options', 'dish_addon_groups',
                           'dish_relations', 'upsell_rules', 'venue_hours', 'venue_closures'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select app.can_read(venue_id)))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select app.can_edit(venue_id)))', t || '_add', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select app.can_edit(venue_id))) with check ((select app.can_edit(venue_id)))', t || '_change', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select app.can_edit(venue_id)))', t || '_remove', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- availability: the counter may take things off and bring them back
grant select on public.availability_overrides to authenticated;
grant insert (venue_id, target_kind, target_id, starts_at, until_kind, until_spec, note) on public.availability_overrides to authenticated;
grant update (restored_at) on public.availability_overrides to authenticated;
create policy availability_read on public.availability_overrides for select to authenticated using ((select app.can_read(venue_id)));
create policy availability_add on public.availability_overrides for insert to authenticated with check ((select app.can_operate(venue_id)));
create policy availability_restore on public.availability_overrides for update to authenticated
  using ((select app.can_operate(venue_id))) with check ((select app.can_operate(venue_id)));
-- no delete: the overrides are the history of what was off, when, and who did it

-- ---------------------------------------------------------------- records: owner, manager and Halom staff read; only functions write
grant select on public.menu_revisions to authenticated;
create policy revisions_read on public.menu_revisions for select to authenticated using ((select app.can_see_records(venue_id)));

grant select on public.activity_log to authenticated;
create policy activity_read on public.activity_log for select to authenticated
  using (case when venue_id is null then (select app.is_staff()) else (select app.can_see_records(venue_id)) end);

grant select on public.rollups_minute, public.rollups_day to authenticated;
create policy rollups_minute_read on public.rollups_minute for select to authenticated using ((select app.can_see_records(venue_id)));
create policy rollups_day_read on public.rollups_day for select to authenticated using ((select app.can_see_records(venue_id)));
-- public.events: no access through the API (raw events; dashboards read the rollups)

-- ---------------------------------------------------------------- onboarding, imports, support cases
grant select on public.onboarding_progress to authenticated;
grant insert (venue_id, step, state, blockers) on public.onboarding_progress to authenticated;
grant update (state, blockers) on public.onboarding_progress to authenticated;
create policy onboarding_read on public.onboarding_progress for select to authenticated using ((select app.can_see_records(venue_id)));
create policy onboarding_add on public.onboarding_progress for insert to authenticated with check ((select app.can_edit(venue_id)));
create policy onboarding_change on public.onboarding_progress for update to authenticated
  using ((select app.can_edit(venue_id))) with check ((select app.can_edit(venue_id)));

grant select on public.menu_imports to authenticated;
grant insert (id, venue_id, source, raw_paths, raw_text, input_sha256, rights_confirmed) on public.menu_imports to authenticated;
grant update (status, rights_confirmed, parsed, exceptions) on public.menu_imports to authenticated;
create policy imports_read on public.menu_imports for select to authenticated using ((select app.can_see_records(venue_id)));
create policy imports_add on public.menu_imports for insert to authenticated with check ((select app.can_edit(venue_id)));
create policy imports_change on public.menu_imports for update to authenticated
  using ((select app.can_edit(venue_id))) with check ((select app.can_edit(venue_id)));

grant select on public.support_cases to authenticated;
grant insert (venue_id, topic, subject, body) on public.support_cases to authenticated;
grant update (status, topic) on public.support_cases to authenticated;
create policy cases_read on public.support_cases for select to authenticated using ((select app.can_see_records(venue_id)));
create policy cases_open on public.support_cases for insert to authenticated with check ((select app.can_edit(venue_id)));
create policy cases_change on public.support_cases for update to authenticated
  using ((select app.can_edit(venue_id))) with check ((select app.can_edit(venue_id)));

-- ---------------------------------------------------------------- Mana's leads: personal data, never read directly
-- No grant to authenticated at all: staff read through ops_leads (each read is written to the activity log) and work a
-- lead through ops_update_lead. Every later read of personal data follows the same pattern (a logged definer function).

-- public.app_config, public.staff_invites, public.events, public.leads: no grants at all

-- ---------------------------------------------------------------- files (Supabase Storage): "<venue id>/..." in both buckets
-- menu-private: the owner's original photos and import screenshots; members who edit, and Halom staff, read them.
-- menu-public: what the owner approved (reliefs, photos, logo, table); anyone may load a file by its address,
-- nobody may list the bucket; owners and managers write under their own venue's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('menu-private', 'menu-private', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']),
  ('menu-public', 'menu-public', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy mana_private_read on storage.objects for select to authenticated
  using (bucket_id = 'menu-private' and (select app.can_see_records(app.path_venue(name))));
create policy mana_private_write on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-private' and (select app.can_edit(app.path_venue(name))));
create policy mana_private_change on storage.objects for update to authenticated
  using (bucket_id = 'menu-private' and (select app.can_edit(app.path_venue(name))))
  with check (bucket_id = 'menu-private' and (select app.can_edit(app.path_venue(name))));
create policy mana_private_remove on storage.objects for delete to authenticated
  using (bucket_id = 'menu-private' and (select app.can_edit(app.path_venue(name))));
create policy mana_public_write on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-public' and (select app.can_edit(app.path_venue(name))));
create policy mana_public_change on storage.objects for update to authenticated
  using (bucket_id = 'menu-public' and (select app.can_edit(app.path_venue(name))))
  with check (bucket_id = 'menu-public' and (select app.can_edit(app.path_venue(name))));
create policy mana_public_remove on storage.objects for delete to authenticated
  using (bucket_id = 'menu-public' and (select app.can_edit(app.path_venue(name))));
-- the client app reads back what it wrote to the public bucket (uploads with upsert need it); still no anonymous listing
create policy mana_public_read_own on storage.objects for select to authenticated
  using (bucket_id = 'menu-public' and (select app.can_read(app.path_venue(name))));

-- ---------------------------------------------------------------- Realtime: the dashboards subscribe to their rollups and to what is off
-- (Supabase Realtime applies the same RLS to postgres_changes)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rollups_minute, public.rollups_day, public.availability_overrides;
  end if;
end $$;

-- ---------------------------------------------------------------- functions: nothing by default, then by name
-- (last in this file, so the functions created above are covered too)
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated, service_role;
-- the helpers that policies, storage policies and check constraints call run with the caller's rights; the schema is
-- not exposed through the API, so none of them can be called from a browser
grant execute on function app.is_member(uuid), app.is_owner(uuid), app.can_edit(uuid), app.can_operate(uuid), app.can_read(uuid),
  app.can_see_records(uuid), app.is_staff(), app.path_venue(text), app.windows_ok(jsonb), app.until_spec_ok(jsonb)
  to authenticated, service_role;

grant execute on function public.public_menu(text), public.track_events(jsonb),
  public.submit_lead(uuid, text, text, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.slug_available(text), public.create_venue(text, text, text, text, text), public.preview_menu(uuid),
  public.publish_menu(uuid, text), public.restore_revision(uuid, integer), public.unpublish_menu(uuid), public.my_dashboard(uuid, text),
  public.redeem_staff_invite(text), public.create_staff_invite(text, text), public.ops_overview(), public.ops_approve_venue(uuid, text),
  public.ops_set_plan(uuid, text, timestamptz, text, text), public.ops_leads(text, text, timestamptz, integer),
  public.ops_update_lead(uuid, text, text, text), public.act_for_owner(uuid, text, text, jsonb) to authenticated;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------- the grant audit: run it after every migration
-- Returns every grant to anon or authenticated that is not on the intended list below (problem 'unexpected'), every
-- intended grant that is gone ('missing'), and any TRUNCATE / TRIGGER / REFERENCES or write on a record table held by
-- the service role ('unexpected'). Nothing returned = the access model is exactly the one this file describes. A
-- migration that changes access updates the list in the same change; supabase/tests asserts it returns nothing.
create function app.audit_grants() returns table (problem text, grantee text, object text, privilege text)
language plpgsql stable security definer set search_path = '' as $$
declare expected text[] := array[
  'anon|function|public.public_menu(text)|EXECUTE',
  'anon|function|public.submit_lead(uuid,text,text,text,text,text,text,text,integer)|EXECUTE',
  'anon|function|public.track_events(jsonb)|EXECUTE',
  'authenticated|column|public.availability_overrides.note|INSERT',
  'authenticated|column|public.availability_overrides.restored_at|UPDATE',
  'authenticated|column|public.availability_overrides.starts_at|INSERT',
  'authenticated|column|public.availability_overrides.target_id|INSERT',
  'authenticated|column|public.availability_overrides.target_kind|INSERT',
  'authenticated|column|public.availability_overrides.until_kind|INSERT',
  'authenticated|column|public.availability_overrides.until_spec|INSERT',
  'authenticated|column|public.availability_overrides.venue_id|INSERT',
  'authenticated|column|public.menu_imports.exceptions|UPDATE',
  'authenticated|column|public.menu_imports.id|INSERT',
  'authenticated|column|public.menu_imports.input_sha256|INSERT',
  'authenticated|column|public.menu_imports.parsed|UPDATE',
  'authenticated|column|public.menu_imports.raw_paths|INSERT',
  'authenticated|column|public.menu_imports.raw_text|INSERT',
  'authenticated|column|public.menu_imports.rights_confirmed|INSERT',
  'authenticated|column|public.menu_imports.rights_confirmed|UPDATE',
  'authenticated|column|public.menu_imports.source|INSERT',
  'authenticated|column|public.menu_imports.status|UPDATE',
  'authenticated|column|public.menu_imports.venue_id|INSERT',
  'authenticated|column|public.onboarding_progress.blockers|INSERT',
  'authenticated|column|public.onboarding_progress.blockers|UPDATE',
  'authenticated|column|public.onboarding_progress.state|INSERT',
  'authenticated|column|public.onboarding_progress.state|UPDATE',
  'authenticated|column|public.onboarding_progress.step|INSERT',
  'authenticated|column|public.onboarding_progress.venue_id|INSERT',
  'authenticated|column|public.support_cases.body|INSERT',
  'authenticated|column|public.support_cases.status|UPDATE',
  'authenticated|column|public.support_cases.subject|INSERT',
  'authenticated|column|public.support_cases.topic|INSERT',
  'authenticated|column|public.support_cases.topic|UPDATE',
  'authenticated|column|public.support_cases.venue_id|INSERT',
  'authenticated|column|public.venue_members.role|UPDATE',
  'authenticated|column|public.venues.accent|UPDATE',
  'authenticated|column|public.venues.area_en|UPDATE',
  'authenticated|column|public.venues.area_he|UPDATE',
  'authenticated|column|public.venues.book_url|UPDATE',
  'authenticated|column|public.venues.cuisine_en|UPDATE',
  'authenticated|column|public.venues.cuisine_he|UPDATE',
  'authenticated|column|public.venues.default_lang|UPDATE',
  'authenticated|column|public.venues.kind|UPDATE',
  'authenticated|column|public.venues.langs|UPDATE',
  'authenticated|column|public.venues.logo_path|UPDATE',
  'authenticated|column|public.venues.name_en|UPDATE',
  'authenticated|column|public.venues.name_he|UPDATE',
  'authenticated|column|public.venues.order_url|UPDATE',
  'authenticated|column|public.venues.phone|UPDATE',
  'authenticated|column|public.venues.sold_out_display|UPDATE',
  'authenticated|column|public.venues.support_can_act|UPDATE',
  'authenticated|column|public.venues.surface|UPDATE',
  'authenticated|column|public.venues.table_img_path|UPDATE',
  'authenticated|column|public.venues.template|UPDATE',
  'authenticated|column|public.venues.time_zone|UPDATE',
  'authenticated|function|public.act_for_owner(uuid,text,text,jsonb)|EXECUTE',
  'authenticated|function|app.can_edit(uuid)|EXECUTE',
  'authenticated|function|app.can_operate(uuid)|EXECUTE',
  'authenticated|function|app.can_read(uuid)|EXECUTE',
  'authenticated|function|app.can_see_records(uuid)|EXECUTE',
  'authenticated|function|app.is_member(uuid)|EXECUTE',
  'authenticated|function|app.is_owner(uuid)|EXECUTE',
  'authenticated|function|app.is_staff()|EXECUTE',
  'authenticated|function|app.path_venue(text)|EXECUTE',
  'authenticated|function|app.until_spec_ok(jsonb)|EXECUTE',
  'authenticated|function|app.windows_ok(jsonb)|EXECUTE',
  'authenticated|function|public.create_staff_invite(text,text)|EXECUTE',
  'authenticated|function|public.create_venue(text,text,text,text,text)|EXECUTE',
  'authenticated|function|public.my_dashboard(uuid,text)|EXECUTE',
  'authenticated|function|public.ops_approve_venue(uuid,text)|EXECUTE',
  'authenticated|function|public.ops_leads(text,text,timestamp with time zone,integer)|EXECUTE',
  'authenticated|function|public.ops_overview()|EXECUTE',
  'authenticated|function|public.ops_set_plan(uuid,text,timestamp with time zone,text,text)|EXECUTE',
  'authenticated|function|public.ops_update_lead(uuid,text,text,text)|EXECUTE',
  'authenticated|function|public.preview_menu(uuid)|EXECUTE',
  'authenticated|function|public.public_menu(text)|EXECUTE',
  'authenticated|function|public.publish_menu(uuid,text)|EXECUTE',
  'authenticated|function|public.redeem_staff_invite(text)|EXECUTE',
  'authenticated|function|public.restore_revision(uuid,integer)|EXECUTE',
  'authenticated|function|public.slug_available(text)|EXECUTE',
  'authenticated|function|public.submit_lead(uuid,text,text,text,text,text,text,text,integer)|EXECUTE',
  'authenticated|function|public.track_events(jsonb)|EXECUTE',
  'authenticated|function|public.unpublish_menu(uuid)|EXECUTE',
  'authenticated|table|public.activity_log|SELECT',
  'authenticated|table|public.addon_groups|DELETE',
  'authenticated|table|public.addon_groups|INSERT',
  'authenticated|table|public.addon_groups|SELECT',
  'authenticated|table|public.addon_groups|UPDATE',
  'authenticated|table|public.addon_options|DELETE',
  'authenticated|table|public.addon_options|INSERT',
  'authenticated|table|public.addon_options|SELECT',
  'authenticated|table|public.addon_options|UPDATE',
  'authenticated|table|public.assets|DELETE',
  'authenticated|table|public.assets|INSERT',
  'authenticated|table|public.assets|SELECT',
  'authenticated|table|public.assets|UPDATE',
  'authenticated|table|public.availability_overrides|SELECT',
  'authenticated|table|public.dish_addon_groups|DELETE',
  'authenticated|table|public.dish_addon_groups|INSERT',
  'authenticated|table|public.dish_addon_groups|SELECT',
  'authenticated|table|public.dish_addon_groups|UPDATE',
  'authenticated|table|public.dish_relations|DELETE',
  'authenticated|table|public.dish_relations|INSERT',
  'authenticated|table|public.dish_relations|SELECT',
  'authenticated|table|public.dish_relations|UPDATE',
  'authenticated|table|public.dishes|DELETE',
  'authenticated|table|public.dishes|INSERT',
  'authenticated|table|public.dishes|SELECT',
  'authenticated|table|public.dishes|UPDATE',
  'authenticated|table|public.entitlements|SELECT',
  'authenticated|table|public.menu_imports|SELECT',
  'authenticated|table|public.menu_revisions|SELECT',
  'authenticated|table|public.onboarding_progress|SELECT',
  'authenticated|table|public.rollups_day|SELECT',
  'authenticated|table|public.rollups_minute|SELECT',
  'authenticated|table|public.schedules|DELETE',
  'authenticated|table|public.schedules|INSERT',
  'authenticated|table|public.schedules|SELECT',
  'authenticated|table|public.schedules|UPDATE',
  'authenticated|table|public.sections|DELETE',
  'authenticated|table|public.sections|INSERT',
  'authenticated|table|public.sections|SELECT',
  'authenticated|table|public.sections|UPDATE',
  'authenticated|table|public.staff|SELECT',
  'authenticated|table|public.support_cases|SELECT',
  'authenticated|table|public.upsell_rules|DELETE',
  'authenticated|table|public.upsell_rules|INSERT',
  'authenticated|table|public.upsell_rules|SELECT',
  'authenticated|table|public.upsell_rules|UPDATE',
  'authenticated|table|public.venue_closures|DELETE',
  'authenticated|table|public.venue_closures|INSERT',
  'authenticated|table|public.venue_closures|SELECT',
  'authenticated|table|public.venue_closures|UPDATE',
  'authenticated|table|public.venue_hours|DELETE',
  'authenticated|table|public.venue_hours|INSERT',
  'authenticated|table|public.venue_hours|SELECT',
  'authenticated|table|public.venue_hours|UPDATE',
  'authenticated|table|public.venue_members|DELETE',
  'authenticated|table|public.venue_members|SELECT',
  'authenticated|table|public.venues|SELECT'
];
begin
  return query
  with actual as (
    select r.rolname::text as grantee, 'table' as kind, (n.nspname || '.' || c.relname)::text as object, pr.priv as privilege
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege(r.rolname, c.oid, pr.priv)
    union all
    select r.rolname::text, 'column', (n.nspname || '.' || c.relname || '.' || a.attname)::text, pr.priv
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join (values ('anon'), ('authenticated')) r(rolname)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and not has_table_privilege(r.rolname, c.oid, pr.priv) and has_column_privilege(r.rolname, c.oid, a.attnum, pr.priv)
    union all
    select r.rolname::text, 'function', p.oid::regprocedure::text, 'EXECUTE'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    where n.nspname in ('public', 'app') and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    union all
    select 'service_role', 'table', (n.nspname || '.' || c.relname)::text, pr.priv
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) pr(priv)
    where n.nspname in ('public', 'app') and c.relkind in ('r', 'p') and has_table_privilege('service_role', c.oid, pr.priv)
      and (pr.priv in ('TRUNCATE', 'REFERENCES', 'TRIGGER') or n.nspname = 'app'
           or c.relname in ('activity_log', 'menu_revisions', 'events', 'rollups_minute', 'rollups_day')
           or (c.relname = 'availability_overrides' and pr.priv = 'DELETE'))
  )
  select 'unexpected'::text, a.grantee, a.object, a.privilege from actual a
  where a.grantee = 'service_role' or (a.grantee || '|' || a.kind || '|' || a.object || '|' || a.privilege) <> all (expected)
  union all
  select 'missing'::text, split_part(e, '|', 1), split_part(e, '|', 3), split_part(e, '|', 4) from unnest(expected) e
  where e not in (select a.grantee || '|' || a.kind || '|' || a.object || '|' || a.privilege from actual a)
  order by 1, 2, 3, 4;
end $$;
revoke execute on function app.audit_grants() from public, anon, authenticated;
