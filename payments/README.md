# Mana payments

Pay at the table, deposits for a booking, split bills and tips, on any Israeli gateway, without Halom ever touching a
card or holding money. Plain ESM JavaScript, no dependencies, no network in tests. Nothing here is wired to the apps
yet; it is the port, the ledger, a local provider and the proposed schema, with the rules under test.

```
npm test            # in payments/: node --test test/*.test.mjs   (27 tests, no network)
```

## The architecture (R2 §5.1)

```
guest menu · owner app · booking  ──►  edge functions (the Payments service)  ──►  PaymentProvider port
                                            │                                        ├─ providers/mock.mjs     local, deterministic
                                            ▼                                        ├─ providers/grow.mjs     adapter #1 (platform programme)
                                     the ledger (Mana's own rows)                    └─ providers/payplus.mjs  adapter #2 (clean REST)
```

| File | What it is |
|---|---|
| `port.mjs` | The `PaymentProvider` interface (JSDoc types): `createCheckout({intent: charge \| authorize \| tokenize, …})`, `capture`, `release`, `chargeToken`, `refund`, `cancel`, `verifyCallback → PaymentEvent`, `issueDocument`; capability flags `supportsPartialCapture`, `holdWindowDays`, `bitMaxAmount`, `walletTokensReusable`, `maxRefundsPerTxn`, `sandbox`; `assertAgorot`, `assertProvider`, `assertCheckoutRequest`, `PaymentError` (codes: `declined`, `forged`, `over_capture`, `refund_cap`, `duplicate`, `no_credentials` …). |
| `ledger.mjs` | `bill`, `bill_share`, `payment_intent`, `tip`, `refund`, a journal. One state machine per intent: `created → pending → authorized → captured \| released \| failed`, `captured → refunded_partial → refunded_full`. Integer agorot only. An idempotency key is unique per intent. N intents per bill for a split; the bill closes when the captured shares reach its total. Tips are their own rows and a line item, never part of the bill's total. `applyEvent` refuses an event that is not `verified`. |
| `service.mjs` | What the edge functions run: `checkout`, `onCallback` (verify by a round trip, then move the ledger), `capture`, `release`, `refund` (the provider's cap is checked before the provider is asked), `cancel`, `chargeToken`. |
| `providers/mock.mjs` | A deterministic local provider that plays both sides: approve, decline (an amount ending in 99, or on request), holds, capture ≤ held, at most two refunds and never more than captured, same-day cancel, tokens, idempotent token charges, a callback signed with a test secret, and `forge()` to make the callbacks an attacker would send. |
| `providers/grow.mjs` | Grow (Meshulam): `createPaymentProcess`, `approveTransaction` (the required round trip; Grow's notify has no signature), `settleSuspendedTransaction` (J5 partial capture), `createTransactionWithToken`. Docs: https://developers.grow.business. Refuses to run without `apiKey` + `userId` + `pageCode`. |
| `providers/payplus.mjs` | PayPlus REST v1.0: `PaymentPages/generateLink`, HMAC-SHA256 callback hash, `PaymentPages/ipn` (the round trip), `Transactions/ChargeByTransactionUid` (J5 capture), `Transactions/Charge` with a token, `RefundByTransactionUid`, `books/docs/new/{type}`. Docs: https://docs.payplus.co.il. Refuses to run without `api-key` + `secret-key` + `payment_page_uid`. |
| `../db/proposed/0005_payments.sql` | The ledger tables with the state machine as a trigger, the bill-close trigger and RLS sketched (owner-only reads; no client writes). Proposed: nothing applied. |

## The rules

1. **No card number ever reaches Halom.** The guest pays on the provider's own page: by redirect, or in an
   `<iframe allow="payment" sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation">`. The port has no
   field for a PAN and `assertCheckoutRequest` is what every adapter checks first. PCI scope stays SAQ A.
2. **Never trust a callback alone.** A callback is answered "received" at once, then the adapter verifies it: the
   signature where the provider has one (PayPlus `hash`), and always a round trip to the provider's own record
   (Grow `approveTransaction`, PayPlus `ipn`). The amount the provider holds must be the amount the intent asked for.
   Only an event with `verified: true` moves the ledger; `applyEvent` throws on anything else. The tests forge
   callbacks four ways (unsigned, wrong secret, right secret with a false claim, unknown reference): all are rejected.
3. **Halom never holds funds.** Every charge settles to the restaurant's own gateway account and acquirer. Halom's fee
   is invoiced, or deducted by the gateway (Grow's `companyCommission`), never netted by Mana. This keeps Mana out of
   the 2023 payment-services licensing regime; a legal check is still owed (R2 §5.4).
4. **Per-restaurant keys only in Supabase secrets** (Vault / edge-function secrets), keyed by the restaurant's id. Never
   in `config.js`, never in this public repository; the adapters throw `no_credentials` without them.
5. **Integer agorot.** ₪38.00 is `3800`. Floats are refused at the port.
6. **Idempotency.** Every intent has a key; the same key is the same intent and the same checkout; a provider's retried
   callback is applied once (the state machine refuses the second). Token charges carry the key to the provider
   (`transactionUniqueIdentifier`, `more_info`).
7. **Refund caps and same-day semantics.** Grow allows two API refunds per transaction and a same-day reversal is the
   whole amount; the service refuses the third refund before asking. A wrong share on a split bill is corrected on that
   share's own transaction, never by partial refunds of one bill-level charge.

## The flows

- **Pay at the table.** The guest menu opens `createCheckout(intent: 'charge', amount: bill + tip)` for the table's
  bill (or one share of it), the provider's page is shown, the callback is verified, the bill closes when the captured
  shares reach its total. Tips are a `Tip` line on the intent (so the document is right) and a `tips` row (payouts).
- **Split bills.** `splitEqual(bill, n)` (agorot remainder spread so the shares sum exactly), `splitByItems(bill,
  groups)` or custom shares; one intent per share; a failed share is paid again by a new intent, the others untouched.
- **Deposits as holds.** `createCheckout(intent: 'authorize', amount: deposit)` places a J5 hold. On arrival `release`
  (or `capture(0)`); on no-show `capture(fee)` ≤ the hold (partial capture where the provider has it). Hold windows are
  short (≈5–10 days, acquirer-set), so for a booking further out the card is **tokenised at booking and the hold is
  placed at T-3 days** by a scheduled job; past the window `capture` throws `hold_expired` and the fee is a
  `chargeToken` instead.
- **Documents.** The provider's own documents by default (`issueDocument`); Grow issues no credit document on a refund,
  so the restaurant's bookkeeping must.

## What Daniel and Rami must open before any money moves (R2 §5.3)

| # | What | Who |
|---|---|---|
| 1 | **Grow platform agreement**: platform `apiKey`, sandbox `userId`/`pageCode`s (card, Bit, J5-enabled), commission setup, the embedded registration form; production credentials come only after Grow reviews the integration | Rami (commercial), Daniel (technical) |
| 2 | **PayPlus staging account**: `api-key`, `secret-key`, `payment_page_uid` with tokenisation, J5 and Invoice+ enabled on the test terminal (not self-serve) | Daniel for dev; each restaurant for production |
| 3 | **A pilot restaurant's acquiring agreement** (Isracard / Max / Cal / CardCom) with J5 and token permissions on the terminal; J5, Bit and wallets cannot be tested in any sandbox, so the first holds are ₪1–10 on a live terminal with refunds pre-approved | the restaurant, Halom guides |
| 4 | Bit merchant account per restaurant (through the gateway) | the restaurant |
| 5 | Apple Pay domain verification file for every domain that hosts a checkout (`/.well-known/apple-developer-merchantid-domain-association`) | Daniel, through the halom repo |
| 6 | Public HTTPS callback endpoints (edge functions); local development needs a tunnel, all providers refuse localhost | Daniel |
| 7 | Legal check of the 2023 Payment Services law on this model (no customer funds through Halom) | Halom counsel |

## Open before go-live (not guessed here)

Grow: the J5 window (7 or 10 days), the refund endpoint's path (`GROW_ENDPOINTS.refund` is `null` and `refund()`
says so), whether a suspended charge can be released explicitly, the status-code table. PayPlus: how staging credentials
are obtained, the J5 duration, an explicit J5 release. Both: current fee schedules (not public).
