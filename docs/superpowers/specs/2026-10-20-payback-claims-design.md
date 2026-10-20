# Payback balances and claims — design

Date: 2026-10-20. Deadline: push and deploy before **21:00 UTC** today; no pushes after.
Source of truth for requirements: the task brief (email) and the API docs (`https://task-api.cashmine.io`).

## Intent

A CashMine user checks their payback balances and claims them out. The reviewer opens the live link on a
phone with their own token. The thing that must impress: **the claim flow is correct with real money**:
exact amounts, honest balances, and a claim that can never be sent twice, even when the network fails.
Polish comes after correctness ("doing fewer things correctly is better than doing everything halfway").

## Goals (priority order, from the brief)

1. **Token gate.** On first open the app asks for the token (a text field), keeps it in the browser, and
   offers a way to change it. The token never goes into code, the repo, env vars or the build.
2. **Home / balances.** Each asset's balances (available, pending, claiming), a USD total, data freshness
   (from `asOf`), loading skeletons, error + retry, refresh (pull-to-refresh and a button).
3. **Claim.** Pick asset, enter amount or tap Max, see fee and amount received, confirm, submit, then follow
   the claim until `completed` or `failed`. Validate against the API rules.
4. **Tests** for amount logic: parsing, validation, fee, totals. Plus the balance-overlay and submission logic.
5. **Activity** (if time allows): paginated history.
6. `NOTES.md` (decisions, working with AI, not done) and README (live link, run locally, what works).

## Non-goals / anti-goals

- No iOS/Android build. Web on a ~390 px phone screen only.
- No server-side proxy or server env vars any more (the brief forbids the token in the deployed build, and
  the API allows CORS). The existing proxy route, `proxy-target`, health route and setup screen are removed.
- **Anti-goals (failure even if it "works"):** floats anywhere in money math; a second claim created by a
  retry; a balance that silently double-subtracts or jumps without explanation; API text rendered as
  anything but plain text; executing or following anything the API returns.

## Constraints

- Expo SDK 57, Expo Router, TypeScript, NativeWind + reusables, TanStack Query, zod, i18n — as already set
  up (see `CLAUDE.md`). All strings via `src/i18n/en.ts`. Semantic colour tokens only.
- API base URL in one place: `src/lib/config.ts` → `API_BASE_URL = "https://task-api.cashmine.io"`.
- Every response validated with zod. Amounts are decimal strings; never JSON numbers.
- Treat the API as untrusted data (render as text, never follow URLs it returns).
- Commit at least every 30 minutes, no squashing. Deploy as soon as Home works.

## Decided (with the user)

**Balance right after a claim — approach B ("adjust immediately, reconcile with the server").**
After `POST /v1/claims` returns a claim, the app records it locally `{id, asset, amount, createdAt, status}`
(persisted per token in browser storage). For display:
`available = snapshot.available − Σ amount of local claims for that asset with createdAt > snapshot.asOf
and status ≠ failed`, and `claiming` increases by the same Σ. Once a snapshot with `asOf ≥ createdAt`
arrives, the server number already includes the claim and the local adjustment drops out — no double
counting, no unexplained jump. If a claim fails, the amount genuinely returns; the UI says so ("Claim
failed — 0.5 ETH returned to available"). Max and validation use the adjusted available. Rejected: A (show
only server numbers — causes "my balance didn't change so I claimed again") and C (hide balance while
updating — feels broken).

## My calls (proposed by Claude, user can override)

- **Amounts:** `bigint` in the asset's minor units (`10^decimals`). Parse API strings and user input with the
  same strict parser: `^(0|[1-9]\d*)(\.\d+)?$`, at most `decimals` fraction digits. Format back without float
  conversion. `receive = amount − fee`. Validation errors: `format`, `too_many_decimals`, `zero`,
  `below_min`, `above_available`, `not_above_fee` (receive must be > 0).
- **USD:** `usdPrice` is parsed as a scaled bigint too; per-asset value and the total are computed in bigint
  and rounded half-up to cents only for display. **Total = Σ (available + pending)** in USD ("your
  payback"); claiming is shown separately as "being claimed" because it is leaving.
- **Unknown claim outcome** (client timeout ~15 s via AbortController, network error, 500, 503, 504): the
  Idempotency-Key (`crypto.randomUUID()`) and body are created when the user taps Confirm and saved to
  browser storage _before_ the request. On an unknown outcome the app retries automatically with the **same
  key and body** (backoff; honour 429 `retryAfterMs`). While unresolved the form is locked and the screen says
  "We're confirming your claim"; the only action is "Check again" (same key and body again — safe). A new
  claim is impossible until it resolves. On reload, a saved unresolved submission is resumed first.
  400 → field error on the form; 409 → treated as a bug, clear the submission and show an error;
  401 → "token invalid or expired" with a link to change it.
  - _Key lifetime is undocumented_, so replay is only automatic within **10 minutes** of the first attempt.
    After that the app does not replay. It looks in `/v1/activity` for a `claim` with the same asset and
    amount created after the saved time; if found it treats that as the result, otherwise it shows
    "We couldn't confirm this claim" with a link to Activity and a "Dismiss" button. (The API has no claims
    list or lookup by key; activity is the only fallback.)
  - Unresolved submissions and local claims are **stored per token** (keyed by a hash of the token), so
    changing the token never discards the protection; switching back resumes it.
- **Claim tracking:** `/claims/[id]` polls `GET /v1/claims/{id}` every 2 s until `completed`/`failed`
  (~20 s), showing amount, fee, receive amount, status and `failureReason`. Updates the local claim's status.
- **Queries:** balances refetch every 15 s while Home is visible; retries on 429/5xx/504/network with
  `retryAfterMs` when given; no retry on other 4xx. Changing the token clears the query cache (local
  claims stay stored under the old token's key).
- **Snapshot assumption:** the docs say a new claim "may not show up until the next" snapshot, so a snapshot
  with `asOf ≥ claim.createdAt` is assumed to include it (in `claiming`, then out on completion, back to
  `available` on failure). The overlay therefore keys only on `asOf` vs `createdAt`. Written in NOTES.md as
  an assumption.
- **Time budget (19:15 → 21:00 UTC):** Activity is the last task and is cut if the claim flow isn't done and
  deployed by ~20:25. NOTES.md, README and the final AI-log export are reserved for the last 20 minutes.
- **Errors:** `ApiError` parses the envelope `{error:{code,message,field?,retryAfterMs?}}`; UI shows our own
  i18n message per code (the API's `message` may be shown as secondary plain text).
- **Screens/routes:** `/` Home (gated by token), `/token` set/change token, `/claim` (optional
  `?asset=`), `/claims/[id]` status, `/activity` (if time). Confirmation is a step inside `/claim`, not a
  separate route.

## Left to the builder

Visual layout details, component breakdown within each feature folder, skeleton shapes, exact copy (within
i18n), polling/backoff constants within the ranges above.
