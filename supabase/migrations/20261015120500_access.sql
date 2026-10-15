-- Mana, clean schema 6/7: who may do what. Every grant and every row-level security policy lives in this file, so
-- the access model can be read (and reviewed) in one place. supabase/tests checks each rule.
--
-- Roles
--   anon            a guest's phone or the product page: no table at all; only public_menu, track_events, submit_lead.
--   authenticated   a signed-in person. What they reach depends on venue_members.role and on public.staff:
--     owner         everything of their venue (menu, hours, availability, settings, team, records, publish)
--     manager       like the owner, except the team, the support switch and plan
--     counter       reads the menu; sets and restores availability; nothing else (cannot change a price)
--     Halom support reads across venues; writes into a venue ONLY through act_for_owner (logged, with a reason)
--     Halom admin   the same as support in phase 1 (admin-only functions come with billing, phase 3)
--   service_role    edge functions (the scanner): bypasses RLS; never in a browser.
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
-- the service role (edge functions such as the scanner) is granted explicitly: newer Supabase projects do not grant
-- new tables to the API roles by default. It bypasses RLS; the append-only and same-venue triggers still hold for it.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all tables in schema app to service_role;

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
-- a venue always keeps an owner
create function app.guard_last_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.venues v where v.id = old.venue_id)
     and not exists (select 1 from public.venue_members m where m.venue_id = old.venue_id and m.role = 'owner' and m.user_id <> old.user_id) then
    raise exception 'last_owner';
  end if;
  return coalesce(new, old);
end $$;
create trigger venue_members_last_owner before update or delete on public.venue_members for each row execute function app.guard_last_owner();

grant select on public.staff to authenticated;
create policy staff_read on public.staff for select to authenticated using (user_id = (select auth.uid()) or (select app.is_staff()));
-- staff_invites: no access (an admin adds a code hash by SQL; redeem_staff_invite reads it)

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

-- ---------------------------------------------------------------- Mana's leads: Halom staff only (they are personal data)
grant select on public.leads to authenticated;
grant update (status, owner, notes) on public.leads to authenticated;
create policy leads_read on public.leads for select to authenticated using ((select app.is_staff()));
create policy leads_work on public.leads for update to authenticated using ((select app.is_staff())) with check ((select app.is_staff()));

-- public.app_config, public.staff_invites, public.events: no grants at all

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
  public.publish_menu(uuid, text), public.my_dashboard(uuid, text), public.redeem_staff_invite(text), public.ops_overview(),
  public.act_for_owner(uuid, text, text, jsonb) to authenticated;
grant execute on all functions in schema public to service_role;
