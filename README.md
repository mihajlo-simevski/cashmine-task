# CashMine payback (practical task)

A slice of the CashMine app: see payback balances and claim them. Expo (React Native +
TypeScript), delivered as a web app for phones.

**Live:** https://cashmine-app.expo.app — open it on a phone and paste your API token on the first
screen. Decisions and known issues are in [`NOTES.md`](./NOTES.md).

## What works

- **Token screen:** asks for the token on first open, keeps it in this browser only, and has
  "Change token". The token is never in the code, repo or build.
- **Balances (Home):** available / pending / being claimed per asset, the USD total
  (available + pending), when the snapshot was taken and its age, refresh every 15 s plus a Refresh
  button, loading skeletons and error states with retry (401 leads to "Change token"). Long
  amounts show 6 decimals (cut, never rounded up); tap "more" for the exact value.
- **Claim:** pick an asset, type an amount or tap Max, see the fee and what you receive, pick a
  destination, confirm. Input is checked against the API rules (format, decimals, minimum,
  available, more than the fee) with a message for each.
- **Safe submission:** the Idempotency-Key and body are saved before sending. Unclear outcomes
  (timeout, 5xx, network, unreadable reply) are retried with the same key, so a claim is never
  sent twice; the form stays locked until a definite answer arrives, even across reloads.
- **Claim status:** polls until completed or failed; shows fee, amount received and the failure
  reason. A claim just made is reflected on Home right away and reconciled with the next snapshot.
- **Tests:** 58 unit tests (`pnpm test`) for amount parsing, validation, fees, USD totals, the
  balance overlay, error mapping and the retry/idempotency logic.

## Run locally

Requires Node 24 and pnpm 11.

```bash
pnpm install
pnpm web        # http://localhost:8081, then paste your token
pnpm check      # lint + format + typecheck + tests
```

The API base URL lives in one place: `src/lib/config.ts`.

## Layout

```
src/app/                 routes only
src/features/money/      exact amount math (bigint) + the Amount component
src/features/claims/     submission journal + retries, balance overlay, claim screens
src/features/balances/   Home
src/features/token/      token storage and screen
src/lib/                 API client (typed errors), storage, config
ai-logs/                 AI conversations and the list of commands
```

AI tools wrote most of the code; the conversations are in [`ai-logs/`](./ai-logs) (secrets and
personal identifiers removed). The CashMine name, colours and logo belong to CashMine and are used
only for this task.
