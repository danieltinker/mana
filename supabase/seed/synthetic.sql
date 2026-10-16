-- SYNTHETIC demo venue: "Café Demo" (קפה דמו). Every name, dish and price here is invented for tests and demos.
-- No real venue's data belongs in this repository (the mock client's menu and any Wolt content live only in the private demo seeds,
-- outside git). The ids match packages/contracts/test/fixtures.ts, so the snapshot this venue publishes and the fixture
-- describe the same menu (supabase/tests checks it).
--
-- What it has: four sections (breakfast as a day part, mains, drinks, pastries), seven dishes, six add-on groups incl.
-- one nested group (side → sauce), "goes well with" pairs, three upsell rules (one per trigger), a Friday special,
-- opening hours with a Saturday night past midnight.
--
-- Run it as the database owner after the migrations and after app_config.public_base is set; it is a demo venue
-- (is_demo = true, left out of real totals) and it publishes revision 1. It has no members: attach a demo owner with
--   insert into public.venue_members (venue_id, user_id, role) values ('00000000-0000-4000-8000-0000000000c1', '<auth user id>', 'owner');
-- Running it twice does nothing the second time.

do $seed$
declare
  v uuid := '00000000-0000-4000-8000-0000000000c1';
begin
  if exists (select 1 from public.venues where id = v) then
    raise notice 'Café Demo is already seeded';
    return;
  end if;

  -- a demo venue Halom made itself: approved from the start (no review), on a pilot plan
  insert into public.venues (id, slug, name_he, name_en, cuisine_he, cuisine_en, kind, mode, default_lang, langs, accent, surface, is_demo, approved_at)
  values (v, 'cafe-demo', 'קפה דמו', 'Café Demo', 'בית קפה', 'Café', 'cafe', 'view_only', 'he', '{he,en}', '#c8743c', 'oak', true, now());
  insert into public.entitlements (venue_id, plan, status, note) values (v, 'pilot', 'active', 'synthetic demo venue');

  insert into public.schedules (id, venue_id, kind, name_he, name_en, windows) values
    ('00000000-0000-4000-8000-0000000005c1', v, 'day_part', 'בוקר', 'Breakfast', '[{"days": [0, 1, 2, 3, 4, 5, 6], "from": "07:00", "to": "12:00"}]'),
    ('00000000-0000-4000-8000-0000000005c2', v, 'special', 'שישי', 'Friday', '[{"days": [5], "from": "07:00", "to": "15:00"}]');

  insert into public.sections (id, venue_id, position, name_he, name_en, kind, schedule_id) values
    ('00000000-0000-4000-8000-00000000a001', v, 0, 'בוקר', 'Breakfast', 'food', '00000000-0000-4000-8000-0000000005c1'),
    ('00000000-0000-4000-8000-00000000a002', v, 1, 'עיקריות', 'Mains', 'food', null),
    ('00000000-0000-4000-8000-00000000a003', v, 2, 'שתייה', 'Drinks', 'drinks', null),
    ('00000000-0000-4000-8000-00000000a004', v, 3, 'מאפים', 'Pastries', 'dessert', null);

  insert into public.dishes (id, venue_id, section_id, position, name_he, name_en, price, tags, stock_id, schedule_id) values
    ('00000000-0000-4000-8000-00000000d001', v, '00000000-0000-4000-8000-00000000a001', 0, 'שקשוקה', 'Shakshuka', 5400, '{vegetarian}', null, null),
    ('00000000-0000-4000-8000-00000000d002', v, '00000000-0000-4000-8000-00000000a002', 0, 'המבורגר', 'Burger', 6800, '{}', null, null),
    ('00000000-0000-4000-8000-00000000d003', v, '00000000-0000-4000-8000-00000000a002', 1, 'שניצל', 'Schnitzel', 6200, '{}', null, null),
    ('00000000-0000-4000-8000-00000000d004', v, '00000000-0000-4000-8000-00000000a003', 0, 'אספרסו', 'Espresso', 1200, '{vegan}', null, null),
    ('00000000-0000-4000-8000-00000000d005', v, '00000000-0000-4000-8000-00000000a003', 1, 'לימונדה', 'Lemonade', 1600, '{vegan}', null, null),
    ('00000000-0000-4000-8000-00000000d006', v, '00000000-0000-4000-8000-00000000a004', 0, 'קרואסון', 'Croissant', 1400, '{vegetarian}', 'croissant', null),
    ('00000000-0000-4000-8000-00000000d007', v, '00000000-0000-4000-8000-00000000a004', 1, 'עוגת שישי', 'Friday cake', 3200, '{}', null, '00000000-0000-4000-8000-0000000005c2');

  insert into public.addon_groups (id, venue_id, label, name_he, name_en, selection, min_units, max_units) values
    ('00000000-0000-4000-8000-00000000b001', v, 'Side, mains', 'תוספת', 'Side', 'single', 1, 1),
    ('00000000-0000-4000-8000-00000000b002', v, 'Sauce for fries', 'רוטב', 'Sauce', 'single', 1, 1),
    ('00000000-0000-4000-8000-00000000b003', v, 'Burger extras', 'תוספות', 'Extras', 'multiple', 0, 3),
    ('00000000-0000-4000-8000-00000000b004', v, 'Coffee size', 'גודל', 'Size', 'single', 1, 1),
    ('00000000-0000-4000-8000-00000000b005', v, 'Milk', 'חלב', 'Milk', 'single', 0, 1),
    ('00000000-0000-4000-8000-00000000b006', v, 'Bread', 'לחם', 'Bread', 'single', 1, 1);

  -- the nested group's options first (an opener must point at a group that opens nothing; the order does not matter
  -- to the trigger, it only reads clearer)
  insert into public.addon_options (id, venue_id, group_id, position, name_he, name_en, price, max_qty, is_default, opens_group_id) values
    ('00000000-0000-4000-8000-00000000e004', v, '00000000-0000-4000-8000-00000000b002', 0, 'איולי', 'Aioli', 0, 1, true, null),
    ('00000000-0000-4000-8000-00000000e005', v, '00000000-0000-4000-8000-00000000b002', 1, 'קטשופ', 'Ketchup', 0, 1, false, null),
    ('00000000-0000-4000-8000-00000000e006', v, '00000000-0000-4000-8000-00000000b002', 2, 'צ׳יפוטלה', 'Chipotle', 200, 1, false, null),
    ('00000000-0000-4000-8000-00000000e001', v, '00000000-0000-4000-8000-00000000b001', 0, 'צ׳יפס', 'Fries', 0, 1, true, '00000000-0000-4000-8000-00000000b002'),
    ('00000000-0000-4000-8000-00000000e002', v, '00000000-0000-4000-8000-00000000b001', 1, 'סלט ירוק', 'Green salad', 0, 1, false, null),
    ('00000000-0000-4000-8000-00000000e003', v, '00000000-0000-4000-8000-00000000b001', 2, 'בטטה', 'Sweet potato fries', 800, 1, false, '00000000-0000-4000-8000-00000000b002'),
    ('00000000-0000-4000-8000-00000000e007', v, '00000000-0000-4000-8000-00000000b003', 0, 'גבינה', 'Cheese', 400, 2, false, null),
    ('00000000-0000-4000-8000-00000000e008', v, '00000000-0000-4000-8000-00000000b003', 1, 'ביצת עין', 'Fried egg', 500, 1, false, null),
    ('00000000-0000-4000-8000-00000000e009', v, '00000000-0000-4000-8000-00000000b003', 2, 'אבוקדו', 'Avocado', 600, 1, false, null),
    ('00000000-0000-4000-8000-00000000e00a', v, '00000000-0000-4000-8000-00000000b004', 0, 'קצר', 'Single', 0, 1, true, null),
    ('00000000-0000-4000-8000-00000000e00b', v, '00000000-0000-4000-8000-00000000b004', 1, 'כפול', 'Double', 400, 1, false, null),
    ('00000000-0000-4000-8000-00000000e00c', v, '00000000-0000-4000-8000-00000000b005', 0, 'רגיל', 'Regular', 0, 1, false, null),
    ('00000000-0000-4000-8000-00000000e00d', v, '00000000-0000-4000-8000-00000000b005', 1, 'שיבולת שועל', 'Oat', 200, 1, false, null),
    ('00000000-0000-4000-8000-00000000e00e', v, '00000000-0000-4000-8000-00000000b005', 2, 'סויה', 'Soy', 200, 1, false, null),
    ('00000000-0000-4000-8000-00000000e00f', v, '00000000-0000-4000-8000-00000000b006', 0, 'מחמצת', 'Sourdough', 0, 1, true, null),
    ('00000000-0000-4000-8000-00000000e010', v, '00000000-0000-4000-8000-00000000b006', 1, 'חלה', 'Challah', 0, 1, false, null);

  insert into public.dish_addon_groups (venue_id, dish_id, group_id, position) values
    (v, '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000b006', 0),
    (v, '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000b001', 0),
    (v, '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000b003', 1),
    (v, '00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-00000000b001', 0),
    (v, '00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000b004', 0),
    (v, '00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000b005', 1);

  insert into public.dish_relations (venue_id, dish_id, related_dish_id, position) values
    (v, '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d004', 0),
    (v, '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000d005', 0),
    (v, '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000d003', 1),
    (v, '00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000d006', 0);

  insert into public.upsell_rules (id, venue_id, label, trigger, scope_kind, scope_ids, days, from_time, to_time, basket_lacks_sections,
                                   suggest_kind, suggest_dish_id, suggest_option_id, line_he, line_en, priority, cap) values
    ('00000000-0000-4000-8000-00000000f001', v, 'Coffee → croissant, mornings', 'add', 'dish', '{00000000-0000-4000-8000-00000000d004}', '{}', '07:00', '11:00',
     '{00000000-0000-4000-8000-00000000a004}', 'dish', '00000000-0000-4000-8000-00000000d006', null,
     'קרואסון חם ליד הקפה?', 'A warm croissant with your coffee?', 50, 1),
    ('00000000-0000-4000-8000-00000000f002', v, 'Cheese on the burger', 'sheet', 'dish', '{00000000-0000-4000-8000-00000000d002}', '{}', null, null,
     '{}', 'option', null, '00000000-0000-4000-8000-00000000e007', 'להוסיף גבינה?', 'Add cheese?', 40, 2),
    ('00000000-0000-4000-8000-00000000f003', v, 'A drink with a main', 'checkout', 'section', '{00000000-0000-4000-8000-00000000a002}', '{}', null, null,
     '{00000000-0000-4000-8000-00000000a003}', 'dish', '00000000-0000-4000-8000-00000000d005', null, 'משהו לשתות?', 'Something to drink?', 30, 1);

  -- Sun–Thu 07:00–23:00, Fri 07:00–15:00, Sat 19:00–01:00 (past midnight)
  insert into public.venue_hours (venue_id, weekday, opens, closes)
  select v, d, time '07:00', time '23:00' from generate_series(0, 4) d
  union all select v, 5, time '07:00', time '15:00'
  union all select v, 6, time '19:00', time '01:00';

  insert into public.onboarding_progress (venue_id, step, state)
  select v, s, 'done' from unnest(array['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test']) s;

  if app.cfg('public_base') is null or app.cfg('public_base') = 'null'::jsonb then
    raise notice 'Café Demo seeded but not published: set app_config.public_base, then select app.publish(%L, %L)', v, 'synthetic seed';
  else
    perform app.publish(v, 'synthetic seed');
  end if;
end
$seed$;
