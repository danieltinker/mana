-- Smoke test for db/proposed/0005_payments.sql, self-checking: every block raises if a rule does not hold, so a clean
-- run (exit 0 with ON_ERROR_STOP) is the pass. Run against the studio stack's Postgres after db/00*.sql and
-- db/proposed/*.sql are loaded (STACK_EXTRA_SQL), as the superuser:
--     psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p <stack pg port> -U postgres -d postgres -f payments/test/smoke.sql
-- It writes a throwaway business, user and bill inside one transaction and rolls everything back.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000f001', 'smoke-payments@example.invalid');
insert into public.businesses (id, slug, name_en, created_by) values ('00000000-0000-0000-0000-00000000f00b', 'smoke-payments', 'Smoke', '00000000-0000-0000-0000-00000000f001');
insert into public.memberships (business_id, user_id, role) values ('00000000-0000-0000-0000-00000000f00b', '00000000-0000-0000-0000-00000000f001', 'owner');
insert into public.bills (id, business_id, total) values ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-00000000f00b', 20600);
insert into public.payment_intents (id, bill_id, business_id, kind, amount, idempotency_key)
  values ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-00000000f00b', 'charge', 20600, 'smoke-payments-1');

do $$ begin
  -- the idempotency key is unique
  begin
    insert into public.payment_intents (bill_id, business_id, kind, amount, idempotency_key) values ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-00000000f00b', 'charge', 1, 'smoke-payments-1');
    raise exception 'FAIL: a duplicate idempotency key was accepted';
  exception when unique_violation then null; end;
  -- created → captured is not a move
  begin
    update public.payment_intents set state = 'captured' where idempotency_key = 'smoke-payments-1';
    raise exception 'FAIL: created -> captured was allowed';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- created → pending → captured is
  update public.payment_intents set state = 'pending' where idempotency_key = 'smoke-payments-1';
  update public.payment_intents set state = 'captured', captured = 20600, captured_share = 20600 where idempotency_key = 'smoke-payments-1';
  -- over-capture, even without a state change
  begin
    update public.payment_intents set captured = 99999 where idempotency_key = 'smoke-payments-1';
    raise exception 'FAIL: over-capture was allowed';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- the bill closes when the captured shares reach its total
  update public.bills set captured = 20600 where id = '00000000-0000-0000-0000-00000000f0b1';
  if (select status from public.bills where id = '00000000-0000-0000-0000-00000000f0b1') <> 'closed' then raise exception 'FAIL: the bill did not close'; end if;
  -- captured → pending is not a move; refunded_full needs the whole amount and is final
  begin
    update public.payment_intents set state = 'pending' where idempotency_key = 'smoke-payments-1';
    raise exception 'FAIL: captured -> pending was allowed';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    update public.payment_intents set state = 'refunded_full', refunded = 100 where idempotency_key = 'smoke-payments-1';
    raise exception 'FAIL: refunded_full with a partial amount was allowed';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  update public.payment_intents set state = 'refunded_partial', refunded = 100, refund_count = 1 where idempotency_key = 'smoke-payments-1';
  update public.payment_intents set state = 'refunded_full', refunded = 20600, refund_count = 2 where idempotency_key = 'smoke-payments-1';
  begin
    update public.payment_intents set state = 'captured' where idempotency_key = 'smoke-payments-1';
    raise exception 'FAIL: refunded_full -> captured was allowed';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;

-- RLS: the owner reads, a stranger reads nothing, no client writes
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.bills where id = '00000000-0000-0000-0000-00000000f0b1') <> 1 then raise exception 'FAIL: the owner cannot read the bill'; end if;
  if (select count(*) from public.payment_intents where idempotency_key = 'smoke-payments-1') <> 1 then raise exception 'FAIL: the owner cannot read the intent'; end if;
  begin
    insert into public.bills (business_id, total) values ('00000000-0000-0000-0000-00000000f00b', 1);
    raise exception 'FAIL: a client could insert a bill';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f002","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.bills) <> 0 then raise exception 'FAIL: a stranger can read bills'; end if;
  if (select count(*) from public.payment_intents) <> 0 then raise exception 'FAIL: a stranger can read intents'; end if;
end $$;
reset role;
select 'ok: 0005_payments smoke test passed' as result;
rollback;
