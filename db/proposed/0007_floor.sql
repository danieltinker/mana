-- 0007_floor.sql — PROPOSED, not applied. Café Lima's place system (view/floor/): the venue's floor (layout.v1), its
-- peak windows and time frames, the counter's orders (the guest's "your order is ready" beep) and bidding on tables at
-- peak. seating/peaks.mjs, seating/orders.mjs, seating/bids.mjs and seating/edit.mjs are the reference these tables
-- mirror; their tests (seating/floor.test.mjs) hold the rules. Daniel applies it, if at all, after 0006, and only when
-- the board leaves the demo. Never run from a session; nothing calls it yet.
--
-- Rules the schema keeps:
-- - a floor is one layout.v1 document per venue, checked by validateLayout before it is stored (the owner app's Save);
-- - peak windows are days (0 = Sunday) and HH:MM hours in the venue's time zone; a bid slot is 30–240 minutes; bidding
--   opens 15–720 minutes before a slot and closes 0–60 minutes before it;
-- - frames per zone and per zone at peak: 15–360 minutes in steps of 5;
-- - an order number runs 1–99 per venue and starts again, skipping numbers still waiting; items are ids from the venue's
--   list; no prices are stored here; a party is a number; no name, no phone;
-- - a bid is a whole amount in the venue's currency ≥ the owner's minimum, and ≥ the leader + the step; the leader cannot
--   outbid himself; a guest leads at most one table per slot; when bidding closes the highest bid wins and holds the table
--   for the slot; nothing is charged by these tables (a payment, when there is one, is 0005_payments.sql's job).
-- RLS: the owner reads and writes everything of his venue. A guest is an anonymous session (Supabase anonymous sign-in):
-- he places a bid and reads his own bids and his own order through security-definer functions only; he never lists
-- other guests' bids (he sees the leading amount and the count, not who). Realtime: the board subscribes to orders and
-- bids of its venue; a guest's phone subscribes to its own order row (by a one-time token printed on the receipt) and to
-- the auctions of its venue's open slots. A locked phone needs Web Push (a push_subscriptions table and a sender
-- function), proposed separately.

create table public.venue_floors (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  layout      jsonb not null,                                   -- layout.v1, validated by validateLayout before it lands here
  updated_at  timestamptz not null default now(),
  check (layout->>'v' = '1')
);

create table public.venue_peaks (
  business_id   uuid primary key references public.businesses (id) on delete cascade,
  windows       jsonb not null default '[]'::jsonb,             -- [{ days: [0..6], from: 'HH:MM', to: 'HH:MM' }]
  slot_min      integer not null default 90  check (slot_min between 30 and 240 and slot_min % 15 = 0),
  opens_before  integer not null default 120 check (opens_before between 15 and 720 and opens_before % 15 = 0),
  close_before  integer not null default 10  check (close_before between 0 and 60 and close_before % 5 = 0 and close_before < opens_before),
  frames        jsonb not null default '{"zones":{},"peak":{"minutes":null,"zones":{}}}'::jsonb,
  bid_tables    text[] not null default '{}',
  bid_min       integer not null default 10 check (bid_min between 1 and 1000),
  bid_step      integer not null default 5  check (bid_step between 1 and 500),
  bid_credit    boolean not null default true,                  -- the winning amount is credited to the guest's order
  updated_at    timestamptz not null default now()
);

create table public.counter_orders (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  no          integer not null check (no between 1 and 99),
  items       text[] not null check (cardinality(items) between 1 and 20),
  table_id    text check (table_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  phase       text not null default 'new' check (phase in ('new', 'preparing', 'ready', 'picked')),
  follow      uuid not null default gen_random_uuid(),          -- the receipt's one-time token: the guest's phone follows this
  new_at      timestamptz not null default now(),
  preparing_at timestamptz, ready_at timestamptz, picked_at timestamptz
);
create unique index counter_orders_waiting_no on public.counter_orders (business_id, no) where phase <> 'picked';
create index counter_orders_business_idx on public.counter_orders (business_id, new_at desc);

create table public.table_auctions (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_id    text not null check (table_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  slot_start  timestamptz not null,
  slot_end    timestamptz not null check (slot_end > slot_start),
  closes_at   timestamptz not null check (closes_at <= slot_start),
  phase       text not null default 'open' check (phase in ('open', 'won', 'unsold', 'declined', 'released', 'done')),
  winner      bigint,
  reason      text check (char_length(reason) <= 200),
  decided_at  timestamptz,
  unique (business_id, table_id, slot_start)
);

create table public.table_bids (
  id          bigint generated always as identity primary key,
  auction_id  bigint not null references public.table_auctions (id) on delete cascade,
  guest       uuid not null,                                    -- the anonymous session's auth.uid(); never a name
  party       integer not null check (party between 1 and 40),
  amount      integer not null check (amount >= 1),
  status      text not null default 'leading' check (status in ('leading', 'outbid', 'won', 'lost', 'released')),
  at          timestamptz not null default now()
);
create unique index table_bids_one_leader on public.table_bids (auction_id) where status = 'leading';

alter table public.venue_floors enable row level security;
alter table public.venue_peaks enable row level security;
alter table public.counter_orders enable row level security;
alter table public.table_auctions enable row level security;
alter table public.table_bids enable row level security;
create policy venue_floors_owner on public.venue_floors for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
create policy venue_peaks_owner on public.venue_peaks for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
create policy counter_orders_owner on public.counter_orders for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
create policy table_auctions_owner on public.table_auctions for all to authenticated
  using ((select public.is_venue_owner(business_id))) with check ((select public.is_venue_owner(business_id)));
create policy table_bids_owner on public.table_bids for select to authenticated
  using ((select public.is_venue_owner((select a.business_id from public.table_auctions a where a.id = auction_id))));

-- The guest's phone follows its order by the receipt's token: phase and number only.
create or replace function public.follow_order(p_follow uuid) returns table (no integer, phase text, ready_at timestamptz)
language sql stable security definer set search_path = '' as
$$ select o.no, o.phase, o.ready_at from public.counter_orders o where o.follow = p_follow $$;

-- Is p_slot_start the start of one of the venue's peak slots (peaks.mjs slotAt)? Windows are local HH:MM on days 0..6
-- (0 = Sunday) in the venue's time zone (p_tz: proposed as a businesses column; 'Asia/Jerusalem' until it exists); slots
-- run back to back from a window's start, slot_min each; the last one ends with the window and must be at least 15 minutes.
-- → the slot's end, or null.
create or replace function public.peak_slot_end(p_business uuid, p_slot_start timestamptz, p_tz text default 'Asia/Jerusalem') returns timestamptz
language plpgsql stable security definer set search_path = '' as
$$
declare
  v public.venue_peaks; w jsonb; v_local timestamp := p_slot_start at time zone p_tz; v_dow integer := extract(dow from v_local)::integer;
  v_from timestamp; v_to timestamp; v_start timestamp;
begin
  select * into v from public.venue_peaks where business_id = p_business; if v is null then return null; end if;
  for w in select * from jsonb_array_elements(v.windows) loop
    if not (w->'days') @> to_jsonb(v_dow) then continue; end if;
    v_from := date_trunc('day', v_local) + (w->>'from')::time; v_to := date_trunc('day', v_local) + (w->>'to')::time;
    v_start := v_from;
    while v_start < v_to loop
      if v_start = v_local and least(v_to, v_start + make_interval(mins => v.slot_min)) - v_start >= interval '15 minutes' then
        return (least(v_to, v_start + make_interval(mins => v.slot_min))) at time zone p_tz;
      end if;
      v_start := v_start + make_interval(mins => v.slot_min);
    end loop;
  end loop;
  return null;
end
$$;

-- A guest bids (bids.mjs placeBid is the reference). Every check runs here, in one transaction with the auction row
-- locked, so two bids at once cannot both lead: the table is biddable; the slot is one of the venue's peak slots and
-- bidding for it is open now; the party fits the table (the floor's minParty..maxParty, and it is bookable); the amount
-- clears the minimum or the leader + the step; the leader cannot outbid himself; one leading table per guest per slot.
create or replace function public.place_bid(p_business uuid, p_table text, p_slot_start timestamptz, p_party integer, p_amount integer)
returns table (auction_id bigint, bid_id bigint, leading_amount integer)
language plpgsql security definer set search_path = '' as
$$
declare
  v_guest uuid := (select auth.uid()); v_rules public.venue_peaks; v_auction public.table_auctions; v_lead public.table_bids;
  v_end timestamptz; v_table jsonb;
begin
  if v_guest is null then raise exception 'a bid needs a session'; end if;
  select * into v_rules from public.venue_peaks where business_id = p_business;
  if v_rules is null or not (p_table = any (v_rules.bid_tables)) then raise exception 'this table cannot be bid for'; end if;
  v_end := public.peak_slot_end(p_business, p_slot_start);
  if v_end is null then raise exception 'there is no peak slot at that time'; end if;
  if now() < p_slot_start - make_interval(mins => v_rules.opens_before) then raise exception 'bidding for this slot has not opened yet'; end if;
  if now() >= p_slot_start - make_interval(mins => v_rules.close_before) then raise exception 'bidding for this slot has closed'; end if;
  select t into v_table from public.venue_floors f, jsonb_array_elements(f.layout->'tables') t where f.business_id = p_business and t->>'id' = p_table;
  if v_table is null or (v_table->>'bookable')::boolean is not true then raise exception 'unknown table'; end if;
  if p_party is null or p_party < (v_table->>'minParty')::integer or p_party > (v_table->>'maxParty')::integer then raise exception 'this table does not fit the party'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'the amount must be a whole number'; end if;
  insert into public.table_auctions (business_id, table_id, slot_start, slot_end, closes_at)
    values (p_business, p_table, p_slot_start, v_end, p_slot_start - make_interval(mins => v_rules.close_before))
    on conflict (business_id, table_id, slot_start) do nothing;
  select * into v_auction from public.table_auctions where business_id = p_business and table_id = p_table and slot_start = p_slot_start for update;
  if v_auction.phase <> 'open' or now() >= v_auction.closes_at then raise exception 'bidding for this slot has closed'; end if;
  select * into v_lead from public.table_bids where auction_id = v_auction.id and status = 'leading';
  if v_lead.guest = v_guest then raise exception 'you are already leading'; end if;
  if exists (select 1 from public.table_bids b join public.table_auctions a on a.id = b.auction_id
             where a.business_id = p_business and a.slot_start = p_slot_start and a.id <> v_auction.id and a.phase = 'open' and b.status = 'leading' and b.guest = v_guest)
    then raise exception 'you are leading at another table for this time; one table per guest'; end if;
  if p_amount < coalesce(v_lead.amount + v_rules.bid_step, v_rules.bid_min) then raise exception 'the bid is too low'; end if;
  update public.table_bids set status = 'outbid' where auction_id = v_auction.id and status = 'leading';
  return query insert into public.table_bids (auction_id, guest, party, amount) values (v_auction.id, v_guest, p_party, p_amount)
    returning table_bids.auction_id, table_bids.id, table_bids.amount;
end
$$;

-- What a guest may see of an auction: the leading amount and how many bid, never who.
create or replace function public.auction_view(p_auction bigint) returns table (phase text, leading integer, bidders integer, closes_at timestamptz, mine text)
language sql stable security definer set search_path = '' as
$$ select a.phase, (select b.amount from public.table_bids b where b.auction_id = a.id and b.status in ('leading', 'won')),
          (select count(distinct b.guest)::integer from public.table_bids b where b.auction_id = a.id), a.closes_at,
          (select b.status from public.table_bids b where b.auction_id = a.id and b.guest = (select auth.uid()) order by b.at desc limit 1)
     from public.table_auctions a where a.id = p_auction $$;

-- The clock (bids.mjs tickBids): close the auctions whose time has come; the highest bid wins. A pg_cron job every minute.
create or replace function public.close_due_auctions() returns integer
language plpgsql security definer set search_path = '' as
$$
declare n integer := 0; r record;
begin
  for r in select * from public.table_auctions where phase = 'open' and closes_at <= now() for update skip locked loop
    update public.table_bids set status = case when status = 'leading' then 'won' else 'lost' end where auction_id = r.id;
    update public.table_auctions set phase = case when exists (select 1 from public.table_bids where auction_id = r.id and status = 'won') then 'won' else 'unsold' end,
      winner = (select id from public.table_bids where auction_id = r.id and status = 'won'), decided_at = r.closes_at where id = r.id;
    n := n + 1;
  end loop;
  update public.table_auctions set phase = 'done' where phase = 'won' and slot_end <= now();
  return n;
end
$$;

-- Grants, as in 0001/0002: nothing for anyone by default; then only what each function needs.
revoke all on public.venue_floors, public.venue_peaks, public.counter_orders, public.table_auctions, public.table_bids from anon;
revoke all on function public.peak_slot_end(uuid, timestamptz, text), public.follow_order(uuid), public.place_bid(uuid, text, timestamptz, integer, integer),
  public.auction_view(bigint), public.close_due_auctions() from public, anon, authenticated;
grant execute on function public.follow_order(uuid) to anon, authenticated;              -- a guest's phone, signed in or not, with the receipt's token
grant execute on function public.auction_view(bigint) to anon, authenticated;           -- the leading amount and the count, never who
grant execute on function public.place_bid(uuid, text, timestamptz, integer, integer) to authenticated;   -- an anonymous session is `authenticated`
-- peak_slot_end and close_due_auctions: no grant; place_bid calls the first as its owner, pg_cron runs the second as the owner.
