-- PROPOSAL from the back-office lane (6 Oct 2026). Not applied anywhere. Additive: nothing in 0001_core.sql changes
-- except ops_set_entitlement, which keeps its signature and answers. Tested with test/real-sql.mjs --proposal
-- on PostgreSQL 16 with 0001_core.sql loaded.

-- 1) Lead edits that can CLEAR a field. ops_update_lead() keeps a field when it gets NULL, so a date
--    (next_action_on) can never be removed. Here only the keys present in the patch are touched; null or '' clears.
create or replace function public.ops_patch_lead(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  if p_patch ? 'status' and coalesce(p_patch->>'status', '') not in ('new', 'qualified', 'scoped', 'agreed', 'production', 'review', 'deployed', 'support', 'lost', 'spam') then
    return jsonb_build_object('ok', false, 'code', 'bad_status');
  end if;
  if p_patch ? 'next_action_on' and coalesce(p_patch->>'next_action_on', '') <> '' and p_patch->>'next_action_on' !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'code', 'bad_date');      -- ISO dates only ('tomorrow' and 'infinity' are valid date input in PostgreSQL)
  end if;
  update public.leads set
    status = case when p_patch ? 'status' then p_patch->>'status' else status end,
    owner = case when p_patch ? 'owner' then nullif(left(trim(coalesce(p_patch->>'owner', '')), 80), '') else owner end,
    next_action = case when p_patch ? 'next_action' then nullif(left(trim(coalesce(p_patch->>'next_action', '')), 300), '') else next_action end,
    next_action_on = case when p_patch ? 'next_action_on' then nullif(p_patch->>'next_action_on', '')::date else next_action_on end,
    notes = case when p_patch ? 'notes' then nullif(left(coalesce(p_patch->>'notes', ''), 4000), '') else notes end
  where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'no_lead'); end if;
  return jsonb_build_object('ok', true);
exception when invalid_datetime_format or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'bad_date');
end $$;
revoke all on function public.ops_patch_lead(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ops_patch_lead(uuid, jsonb) to authenticated;

-- 2) Numbers the overview cannot know today. The funnel's first step is currently an approximation
--    (accounts without a business + businesses); with accountsTotal it becomes exact, and accountsByDay gives a
--    third time series (people who signed up). lastViewDay tells "a diner opened this menu on <day>" per business;
--    leadsTotal says how many enquiries exist beyond the 300 that ops_overview() returns.
create or replace function public.ops_overview_extra() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  return jsonb_build_object(
    'accountsTotal', (select count(*) from auth.users u where not exists (select 1 from public.staff s where s.user_id = u.id)),
    'accountsByDay', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'accounts', d.n) order by d.day)
       from (select (u.created_at at time zone 'Asia/Jerusalem')::date as day, count(*) n from auth.users u
             where u.created_at > now() - interval '30 days' and not exists (select 1 from public.staff s where s.user_id = u.id)
             group by 1) d), '[]'::jsonb),
    'leadsTotal', (select count(*) from public.leads),
    'lastViewDay', coalesce((select jsonb_object_agg(v.business_id, v.day)
       from (select business_id, max(day) as day from public.menu_views_daily where views > 0 group by business_id) v), '{}'::jsonb)
  );
end $$;
revoke all on function public.ops_overview_extra() from public, anon, authenticated;
grant execute on function public.ops_overview_extra() to authenticated;

-- 3) Who changed a plan, and when. Today a plan change leaves no trace except the free-text note.
create table public.ops_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  staff_id uuid references auth.users on delete set null,
  action text not null check (char_length(action) <= 60),
  business_id uuid references public.businesses on delete cascade,
  detail jsonb not null default '{}'
);
alter table public.ops_log enable row level security;        -- no policy: reachable only through security-definer functions
revoke all on public.ops_log from anon, authenticated;
create index ops_log_business_idx on public.ops_log (business_id, at desc);

create or replace function public.ops_set_entitlement(p_business uuid, p_plan text, p_status text, p_until timestamptz default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  if p_plan is null or p_plan not in ('trial', 'pilot', 'paid') then return jsonb_build_object('ok', false, 'code', 'bad_plan'); end if;
  if p_status is null or p_status not in ('pending', 'trialing', 'active', 'expired', 'suspended') then return jsonb_build_object('ok', false, 'code', 'bad_status'); end if;
  select to_jsonb(e) - 'business_id' into v_before from public.entitlements e where e.business_id = p_business for update;
  if v_before is null then return jsonb_build_object('ok', false, 'code', 'no_business'); end if;
  update public.entitlements set plan = p_plan, status = p_status,
    trial_ends_at = case when p_status = 'trialing' then coalesce(p_until, trial_ends_at, now() + interval '30 days') else trial_ends_at end,
    trial_started_at = case when p_status = 'trialing' then coalesce(trial_started_at, now()) else trial_started_at end,
    current_period_end = case when p_status = 'active' then p_until else current_period_end end,
    note = coalesce(nullif(left(coalesce(p_note, ''), 500), ''), note)
  where business_id = p_business;
  insert into public.ops_log (staff_id, action, business_id, detail)
  values ((select auth.uid()), 'set_entitlement', p_business,
          jsonb_build_object('before', v_before, 'plan', p_plan, 'status', p_status, 'until', p_until, 'note', nullif(left(coalesce(p_note, ''), 500), '')));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.ops_set_entitlement(uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.ops_set_entitlement(uuid, text, text, timestamptz, text) to authenticated;

create or replace function public.ops_business_log(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'detail', l.detail,
           'staff', (select u.email from auth.users u where u.id = l.staff_id)) order by l.at desc)
         from (select * from public.ops_log where business_id = p_business order by at desc limit 50) l), '[]'::jsonb);
end $$;
revoke all on function public.ops_business_log(uuid) from public, anon, authenticated;
grant execute on function public.ops_business_log(uuid) to authenticated;
