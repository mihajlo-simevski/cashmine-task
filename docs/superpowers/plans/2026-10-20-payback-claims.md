# Payback Balances and Claims Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first Expo web app where a user enters their token, sees payback balances, and claims them with exact money math and no duplicate claims.

**Architecture:** Browser calls `https://task-api.cashmine.io` directly with the user's token (from browser storage). Pure, tested modules hold the money math (`amount.ts`), the balance overlay (`overlay.ts`) and the claim submission state machine (`submission.ts`); screens are thin TanStack Query consumers.

**Tech Stack:** Expo SDK 57, Expo Router, TypeScript, NativeWind + reusables, TanStack Query 5, zod 4, i18next, Jest (jest-expo) + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-20-payback-claims-design.md`

## Global Constraints

- Deadline: last push and deploy before **21:00 UTC**. Commit ≥ every 30 min, conventional commits, no squash.
- API base URL only in `src/lib/config.ts`: `export const API_BASE_URL = "https://task-api.cashmine.io";`
- Token never in code, repo, env vars or build. Stored in browser storage only.
- No floats in money math: `bigint` minor units. Amount regex `^(0|[1-9]\d*)(\.\d+)?$`, ≤ `decimals` fraction digits.
- All strings via `src/i18n/en.ts`; semantic colour tokens; `Text` from `@/components/ui/text`; icons one-by-one import.
- API data is untrusted: render as plain text only; never open URLs from it.
- Browser storage access wrapped in try/catch (works when storage is unavailable).
- `pnpm check` green before each commit.

## Review Focus

1. **Timeout/5xx on POST /v1/claims** → no second claim: the retry reuses the same Idempotency-Key and body. (Task 4 tests.)
2. **Snapshot older than a just-created claim** → available shows reduced once, not twice, and returns to server number when a newer snapshot arrives. (Task 3 tests.)
3. **Amount input edge cases** (".5", "1.", "05", "1e-3", "0", more decimals than allowed, amount == fee, Max with pending local claims). (Task 1 + Task 4 tests.)
4. **401 mid-session / expired token** → user sent to change token, no crash, no infinite retries. (Task 2 tests.)
5. **Reload during an unresolved claim** → submission resumes (≤10 min) or falls back to activity check; form stays locked. (Task 4 tests.)

---

### Task 1: Money core

**Files:**

- Create: `src/features/money/amount.ts`
- Test: `src/features/money/__tests__/amount.test.ts`

**Interfaces — Produces:**

- `parseAmount(input: string, decimals: number): { ok: true; value: bigint } | { ok: false; error: "format" | "too_many_decimals" }`
- `formatAmount(value: bigint, decimals: number, opts?: { trim?: boolean }): string` (exact; `trim` drops trailing fraction zeros; negative values keep `-`)
- `type ClaimAmountError = "format" | "too_many_decimals" | "zero" | "below_min" | "above_available" | "not_above_fee"`
- `validateClaimAmount(input: string, rules: { decimals: number; min: bigint; fee: bigint; available: bigint }): { ok: true; amount: bigint; receive: bigint } | { ok: false; error: ClaimAmountError }`
- `usdCents(amount: bigint, decimals: number, usdPrice: string): bigint` (half-up rounding to cents; `usdPrice` parsed with the same strict parser at its own scale)
- `formatUsd(cents: bigint, locale?: string): string` (Intl.NumberFormat, USD)

- [ ] **Step 1: Write failing tests** — `parseAmount`: `"0.5",18 → 500000000000000000n`; `"12",6 → 12000000n`; `".5" "1." "05" "1e-3" "" " 1" "-1"` → `format`; `"0.1234567",6 → too_many_decimals`. `formatAmount(1234500n,6) → "1.234500"`, trim → `"1.2345"`, `0n → "0"` (trim). `validateClaimAmount`: `"0" → zero`; below min; above available; `amount == fee → not_above_fee`; valid returns `receive = amount − fee` (e.g. ETH `"0.5"` fee `"0.0012"` → receive formats `"0.4988"`). `usdCents(820413207n,6,"1.0002") → 82058n` ($820.58); sum of several assets; `usdCents(1n,6,"0.004") → 0n`.
- [ ] **Step 2:** `pnpm test src/features/money` → FAIL (module missing).
- [ ] **Step 3:** Implement with string splitting + `BigInt`, no `Number` on amounts.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `feat: add exact amount parsing, validation and USD math`.

### Task 2: Token, API client, app shell (remove proxy)

**Files:**

- Create: `src/lib/config.ts`, `src/lib/storage.ts`, `src/features/token/token-store.ts`, `src/features/token/useToken.ts`, `src/features/token/components/TokenScreen.tsx`, `src/app/token.tsx`, `src/features/api/schemas.ts`
- Modify: `src/lib/api.ts`, `src/lib/query-client.ts`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/i18n/en.ts`, `CLAUDE.md` (Data/Secrets/Deploy sections: no proxy, token from user), `README.md`
- Delete: `src/app/api/` (proxy + health), `src/lib/proxy-target.ts`, `src/lib/__tests__/proxy-target.test.ts`, `src/lib/__tests__/proxy-route.test.ts`, `src/features/setup/`, `.env.example`
- Test: `src/lib/__tests__/api.test.ts` (rewrite), `src/features/token/__tests__/token-store.test.ts`

**Interfaces — Produces:**

- `storage.get(key: string): string | null`, `storage.set(key: string, value: string): void`, `storage.remove(key: string): void` (localStorage on web, in-memory fallback; never throws)
- `getToken(): string | null`, `setToken(t: string): void`, `clearToken(): void`, `subscribeToken(cb: () => void): () => void`; `useToken(): string | null` (useSyncExternalStore); `tokenKey(token: string): string` (short non-reversible hash, e.g. FNV-1a hex, for per-token storage keys)
- `class ApiError extends Error { status: number; code: "VALIDATION"|"UNAUTHORIZED"|"NOT_FOUND"|"IDEMPOTENCY_MISMATCH"|"RATE_LIMITED"|"SERVER"|"TIMEOUT"|"NETWORK"|"UNKNOWN"; field?: string; retryAfterMs?: number; apiMessage?: string }` — `NETWORK` for fetch throw/abort (status 0).
- `api<T>(schema: z.ZodType<T>, path: string, opts?: { method?; body?; headers?; timeoutMs?: number; signal? }): Promise<T>` — `${API_BASE_URL}/v1/${path}`, `Authorization: Bearer <getToken()>`, default timeout 15000 ms via AbortController. Also `apiWithMeta` returning `{ data, status, headers }` (needed for 201 vs 200 replay).
- `isUnknownOutcome(e: unknown): boolean` — true for NETWORK, 500/503 SERVER, 504 TIMEOUT.
- `shouldRetryQuery(failureCount: number, e: unknown): boolean` and `retryDelay(attempt: number, e: unknown): number` (uses `retryAfterMs`). 401 → `clearToken()` is **not** automatic; screens show the "token invalid" state with a Change token button.
- zod schemas in `schemas.ts`: `BalancesSchema`, `ClaimOptionsSchema`, `ClaimSchema`, `ActivityPageSchema` (amounts as `z.string()`).
- Routing: `_layout.tsx` redirects to `/token` when no token (except on `/token`). `TokenScreen`: input + Save; when a token exists, shows "Change token". Changing token → `queryClient.clear()`.

- [ ] **Step 1: Write failing tests** — api: sends `Authorization: Bearer t1` to `https://task-api.cashmine.io/v1/balances`; error envelope → `ApiError{status:400, code:"VALIDATION", field:"amount"}`; 429 → `retryAfterMs` 2300; fetch reject → `code:"NETWORK"`; `isUnknownOutcome` true for 504/503/500/NETWORK, false for 400/401/409; `shouldRetryQuery` false for 401/400, true for 429/503 under max. token-store: set/get/clear round-trip; works when `localStorage` throws.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; delete proxy files; update docs listed above.
- [ ] **Step 4:** `pnpm check` PASS.
- [ ] **Step 5:** Commit `feat: ask for the API token in the app and call the API directly`.

### Task 3: Balances overlay + Home screen (then deploy)

**Files:**

- Create: `src/features/claims/local-claims.ts`, `src/features/claims/overlay.ts`, `src/features/balances/useBalances.ts`, `src/features/balances/components/HomeScreen.tsx`, `src/features/balances/components/BalanceCard.tsx`, `src/features/balances/components/Freshness.tsx`
- Modify: `src/app/index.tsx`, `src/components/layout/Screen.tsx` (optional `refreshControl` prop), `src/i18n/en.ts`
- Test: `src/features/claims/__tests__/overlay.test.ts`, `src/features/balances/__tests__/HomeScreen.test.tsx`

**Interfaces — Produces:**

- `type LocalClaim = { id: string; asset: string; amount: string; createdAt: string; status: "pending"|"completed"|"failed" }`
- `local-claims.ts`: `getLocalClaims(token: string): LocalClaim[]`, `upsertLocalClaim(token: string, c: LocalClaim): void`, `useLocalClaims(token): LocalClaim[]` (subscribable). Prune claims older than 1 h.
- `applyOverlay(snapshot: Balances, claims: LocalClaim[]): AdjustedBalance[]` where `AdjustedBalance = { asset; decimals; available: bigint; pending: bigint; claiming: bigint; usdPrice: string; adjustedBy: bigint }` — subtracts claims with `createdAt > asOf && status !== "failed"` from available and adds to claiming.
- `useBalances(): { query, adjusted: AdjustedBalance[] | undefined, totalCents: bigint | undefined }` — `refetchInterval: 15000`.
- Home: total USD (available + pending), per-asset card (available / pending / claiming, "includes your claim just now" when `adjustedBy > 0`), freshness "Updated 12 s ago" (ticks every second; warning style when > 60 s), skeletons, error card with Retry (401 → Change token), Refresh button + pull-to-refresh, "Claim" button per asset → `/claim?asset=X`, header link to change token (and Activity if built).

- [ ] **Step 1: Write failing tests** — overlay: claim created after asOf reduces available and raises claiming once; claim created before asOf → unchanged; failed claim → unchanged; two claims same asset sum; other asset untouched. HomeScreen (mockFetch): renders total `$` and each asset; error 503 shows Retry; shows "includes your claim" when a local claim is newer than asOf.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm check` PASS; `npx expo start --web` smoke check at 390 px with the user's token (user enters it in the browser — never in a command).
- [ ] **Step 5:** Commit `feat: add balances home screen with claim-aware totals`; `pnpm deploy:web:prod`; `curl -s -o /dev/null -w "%{http_code}" https://cashmine-app.expo.app` → 200.

### Task 4: Claim form, confirm, safe submission

**Files:**

- Create: `src/features/claims/submission.ts`, `src/features/claims/useSubmitClaim.ts`, `src/features/claims/components/ClaimScreen.tsx`, `src/features/claims/components/ClaimConfirm.tsx`, `src/app/claim.tsx`
- Modify: `src/i18n/en.ts`
- Test: `src/features/claims/__tests__/submission.test.ts`, `src/features/claims/__tests__/ClaimScreen.test.tsx`

**Interfaces — Consumes:** Task 1 `validateClaimAmount`, `formatAmount`; Task 2 `apiWithMeta`, `isUnknownOutcome`, `ApiError`, `tokenKey`; Task 3 `upsertLocalClaim`, `useBalances().adjusted`.
**Produces:**

- `type PendingSubmission = { key: string; body: { asset: string; amount: string; destinationId: string }; firstAttemptAt: string }`
- `submission.ts`: `loadPending(token): PendingSubmission | null`, `savePending(token, s)`, `clearPending(token)`;
  `submitWithRetry(s: PendingSubmission, deps: { post: (s) => Promise<Claim>; sleep: (ms) => Promise<void>; now: () => number }, opts?: { maxAttempts?: number }): Promise<{ kind: "created"; claim: Claim } | { kind: "rejected"; error: ApiError } | { kind: "unknown"; error: unknown }>` — retries only `isUnknownOutcome`/429 with the **same** key and body; backoff 1s, 2s, 4s (or `retryAfterMs`); stops at `maxAttempts` (default 4).
  `canAutoReplay(s, now): boolean` — `now − firstAttemptAt ≤ 10 min`.
  `findClaimInActivity(s, items): ActivityItem | null` — `type==="claim"`, same asset, `amount === "-" + body.amount` (normalised via parse), `createdAt ≥ firstAttemptAt`.
- ClaimScreen: asset picker (assets from balances), amount input (Controller + Input, `inputMode="decimal"`), Max = adjusted available, fee + receive from claim-options (`useQuery(["claim-options", asset])`), destination (first or picker if > 1, label as plain text), inline validation messages per `ClaimAmountError`, Continue → confirm step (amount, fee, receive, destination) → Confirm creates `PendingSubmission`, `savePending` **before** request, runs `submitWithRetry`.
  On created: `upsertLocalClaim`, `clearPending`, invalidate balances, `router.replace('/claims/'+id)`. On rejected 400: field error, clearPending. 409: error + clearPending. 401: token state. On unknown: locked "We're confirming your claim" + "Check again" (re-run with same pending). On mount with saved pending: auto-resume if `canAutoReplay`, else fetch activity and use `findClaimInActivity`; none → "We couldn't confirm this claim" + Activity link + Dismiss.

- [ ] **Step 1: Write failing tests** — submission: first call 504 then 201 → `created`, `post` called twice with identical key and body; 400 → `rejected` after one call; 409 → `rejected`; always-503 → `unknown` after 4 calls, all with the same key; 429 waits `retryAfterMs`; `canAutoReplay` true at 9 min, false at 11 min; `findClaimInActivity` matches `-0.5`/`"-0.50"` normalisation and ignores older items. ClaimScreen: Max fills adjusted available; ".5" shows format error; amount == fee shows not-above-fee; shows fee and receive "0.4988".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm check` PASS; manual claim on web with real token (user types it in the browser).
- [ ] **Step 5:** Commit `feat: add claim flow with idempotent, retry-safe submission`.

### Task 5: Claim status screen

**Files:**

- Create: `src/features/claims/components/ClaimStatusScreen.tsx`, `src/app/claims/[id].tsx`
- Modify: `src/i18n/en.ts`
- Test: `src/features/claims/__tests__/ClaimStatusScreen.test.tsx`

**Interfaces — Consumes:** `ClaimSchema`, `api`, `upsertLocalClaim`, `formatAmount`.

- `useQuery(["claim", id])` with `refetchInterval: (q) => q.state.data?.status === "pending" ? 2000 : false`; on status change → `upsertLocalClaim` + invalidate balances. Shows amount, fee, receive, destination id, status badge, `failureReason` (plain text), "returned to available" copy on failed, Back to Home.

- [ ] **Step 1: Failing test** — pending renders "Processing"; completed renders "Completed"; failed renders failureReason and "returned to available".
- [ ] **Step 2–4:** Run FAIL → implement → `pnpm check` PASS.
- [ ] **Step 5:** Commit `feat: track claim status until it settles`; `pnpm deploy:web:prod`.

### Task 6 (only if Task 5 is deployed by ~20:25 UTC): Activity

**Files:** Create `src/features/activity/components/ActivityScreen.tsx`, `src/app/activity.tsx`; modify `en.ts`, Home header link. Test `src/features/activity/__tests__/ActivityScreen.test.tsx`.

- `useInfiniteQuery(["activity"], { getNextPageParam: (p) => p.nextCursor ?? undefined })`, `limit=20`; rows: type label, asset, signed amount (`formatAmount` on parsed absolute + sign), status badge, exchange (plain text), date; "Load more" button; empty, loading, error states.
- [ ] Test: renders first page; "Load more" requests `cursor=<nextCursor>`; hides button when `nextCursor` null. Implement, `pnpm check`, commit `feat: add paginated activity history`, deploy.

### Task 7: Notes, README, logs (start by 20:40 UTC at the latest)

**Files:** Create `NOTES.md`; modify `README.md`, `ai-logs/*`.

- [ ] `NOTES.md` (~1 page): Decisions (amounts, balance-after-claim B vs A/C with the conversation location in ai-logs, unknown outcome, USD total, snapshot assumption, 10-min replay window, per-token storage); Working with AI (three moments with ai-log pointers); Not done / known issues.
- [ ] README: live link `https://cashmine-app.expo.app`, run locally (`pnpm install`, `pnpm web`), what works.
- [ ] Re-export AI logs with the scratchpad exporter (token redaction verified: `grep -c "ct1\." ai-logs/*` → 0).
- [ ] `pnpm check`, commit `docs: add notes, README and final AI logs`, final `pnpm deploy:web:prod`, push. All before 21:00 UTC.
