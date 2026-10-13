-- 0005_payments.sql — PROPOSED, not applied. The payments ledger (payments/ledger.mjs is the reference these tables
-- mirror; its tests hold the rules). Daniel applies it, if at all, after 0003 and 0004, and only when a pilot restaurant
-- has a provider account. Nothing here is called by the apps yet.
--
-- Rules the schema keeps: amounts are integer agorot; one state machine per payment_intent (a trigger refuses any other
-- move); an idempotency key is unique per intent; a split bill is N intents against one bill; tips are their own rows
-- and never part of the bill's total; a bill closes when the captured shares reach its total (a trigger); card numbers
-- have no column anywhere; provider credentials are NOT here (Supabase Vault / edge-function secrets, per restaurant).
-- RLS: owners read their own restaurant's rows through public.is_member(business_id); nobody writes from a client —
-- only the edge functions (service role, after a verified round trip) insert or update.

create table public.bills (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_no    text,
  currency    text not null default 'ILS' check (currency = 'ILS'),
  total       integer not null check (total >= 0),             -- agorot: the sum of bill_lines
  captured    integer not null default 0 check (captured >= 0), -- agorot: captured shares, tips excluded
  refunded    integer not null default 0 check (refunded >= 0),
  status      text not null default 'open' check (status in ('open', 'closed', 'void')),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index bills_business_idx on public.bills (business_id, created_at desc);

create table public.bill_lines (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.bills (id) on delete cascade,
  idx         integer not null,
  item_id     uuid references public.items (id) on delete set null,
  name        text not null,
  qty         integer not null check (qty >= 1),
  unit_amount integer not null check (unit_amount >= 0),       -- agorot
  kind        text not null default 'dish' check (kind in ('dish', 'service', 'deposit', 'other')),
  unique (bill_id, idx)
);

create table public.bill_shares (                                -- how a bill was split: by seat, by items, equal, custom
  id        uuid primary key default gen_random_uuid(),
  bill_id   uuid not null references public.bills (id) on delete cascade,
  kind      text not null check (kind in ('equal', 'items', 'seat', 'custom')),
  seat      integer,
  line_idx  integer[],                                           -- for kind = 'items'
  amount    integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table public.payment_intents (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid not null references public.bills (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  share_id        uuid references public.bill_shares (id) on delete set null,
  kind            text not null check (kind in ('charge', 'authorize', 'tokenize')),
  amount          integer not null check (amount >= 0),         -- the share of the bill, agorot
  tip             integer not null default 0 check (tip >= 0),  -- asked from the provider on top of amount
  state           text not null default 'created' check (state in ('created', 'pending', 'authorized', 'captured', 'released', 'failed', 'refunded_partial', 'refunded_full')),
  idempotency_key text not null unique,
  provider        text check (provider in ('mock', 'grow', 'payplus')),
  provider_ref    text,                                          -- the provider's process / page id
  txn_ref         text,                                          -- the provider's transaction id once there is one
  token_ref       text,                                          -- a provider token id for a kept card: never card data
  held            integer not null default 0 check (held >= 0),
  captured        integer not null default 0 check (captured >= 0),
  captured_share  integer not null default 0 check (captured_share >= 0),
  refunded        integer not null default 0 check (refunded >= 0),
  refund_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index intents_bill_idx on public.payment_intents (bill_id);

create table public.tips (                                       -- payouts and reporting; the document gets a 'Tip' line from the intent
  id         uuid primary key default gen_random_uuid(),
  bill_id    uuid not null references public.bills (id) on delete cascade,
  intent_id  uuid not null references public.payment_intents (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount     integer not null check (amount > 0),
  collected  integer not null default 0 check (collected >= 0),
  state      text not null default 'pending' check (state in ('pending', 'partial', 'collected')),
  created_at timestamptz not null default now()
);

create table public.refunds (
  id         uuid primary key default gen_random_uuid(),
  intent_id  uuid not null references public.payment_intents (id) on delete cascade,
  bill_id    uuid not null references public.bills (id) on delete cascade,
  amount     integer not null check (amount > 0),
  provider_ref text,
  created_at timestamptz not null default now()
);

create table public.payment_events (                             -- the journal: every verified provider event, append-only
  id          bigserial primary key,
  intent_id   uuid references public.payment_intents (id) on delete set null,
  business_id uuid not null,
  type        text not null,
  amount      integer,
  provider    text,
  provider_ref text,
  verified    boolean not null default false,                    -- true only after the round trip; the ledger function refuses false
  raw         jsonb,
  created_at  timestamptz not null default now()
);

-- the state machine, as in payments/ledger.mjs TRANSITIONS
create or replace function public.payment_intent_guard() returns trigger language plpgsql as $$
begin
  if new.captured > greatest(new.held, new.amount + new.tip) then raise exception 'over-capture on %', old.id; end if;
  if new.refunded > new.captured then raise exception 'over-refund on %', old.id; end if;
  if new.captured_share > new.amount then raise exception 'captured share over the share on %', old.id; end if;
  if old.state = new.state then new.updated_at := now(); return new; end if;
  if not (
       (old.state = 'created'          and new.state in ('pending', 'failed'))
    or (old.state = 'pending'          and new.state in ('authorized', 'captured', 'failed'))
    or (old.state = 'authorized'       and new.state in ('captured', 'released', 'failed'))
    or (old.state = 'captured'         and new.state in ('refunded_partial', 'refunded_full'))
    or (old.state = 'refunded_partial' and new.state in ('refunded_partial', 'refunded_full'))
  ) then raise exception 'payment_intent %: % -> % is not allowed', old.id, old.state, new.state; end if;
  if new.state = 'refunded_full' and new.refunded <> new.captured then raise exception 'refunded_full with % of % refunded on %', new.refunded, new.captured, old.id; end if;
  new.updated_at := now(); return new;
end $$;
create trigger payment_intents_guard before update on public.payment_intents for each row execute function public.payment_intent_guard();

-- a bill closes when its captured shares reach its total
create or replace function public.bill_close() returns trigger language plpgsql as $$
begin
  if new.status = 'open' and new.captured >= new.total then new.status := 'closed'; new.closed_at := now(); end if;
  return new;
end $$;
create trigger bills_close before update of captured on public.bills for each row execute function public.bill_close();

-- RLS: owner-only reads; no client writes (the edge functions use the service role after a verified round trip)
alter table public.bills enable row level security;
alter table public.bill_lines enable row level security;
alter table public.bill_shares enable row level security;
alter table public.payment_intents enable row level security;
alter table public.tips enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_events enable row level security;
create policy bills_select on public.bills for select to authenticated using ((select public.is_member(business_id)));
create policy bill_lines_select on public.bill_lines for select to authenticated using ((select public.is_member((select b.business_id from public.bills b where b.id = bill_id))));
create policy bill_shares_select on public.bill_shares for select to authenticated using ((select public.is_member((select b.business_id from public.bills b where b.id = bill_id))));
create policy intents_select on public.payment_intents for select to authenticated using ((select public.is_member(business_id)));
create policy tips_select on public.tips for select to authenticated using ((select public.is_member(business_id)));
create policy refunds_select on public.refunds for select to authenticated using ((select public.is_member((select i.business_id from public.payment_intents i where i.id = intent_id))));
create policy events_select on public.payment_events for select to authenticated using ((select public.is_member(business_id)));
-- no insert/update/delete policies: clients cannot write; the service role bypasses RLS from the edge functions only.

-- Smoke test: payments/test/smoke.sql, self-checking (every rule above raises if it does not hold), run after this file
-- is loaded into the stack's Postgres through STACK_EXTRA_SQL:
--     psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p <stack pg port> -U postgres -d postgres -f payments/test/smoke.sql
