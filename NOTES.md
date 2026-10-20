# Notes

Time spent: about 2 hours in the task slot (19:00–21:00 UTC), plus project setup beforehand
(tooling, hosting, an empty Expo app) as allowed.

## Decisions

**How amounts are represented.** Every amount is a `bigint` in the asset's smallest unit
(`10^decimals`), parsed with one strict regex (`^(0|[1-9]\d*)(\.\d+)?$`, at most `decimals` places)
for both API data and user input. No `Number()`/`parseFloat` on money anywhere, even for display.
USD values round **down** (a balance never looks bigger than it is) and the total is summed exactly
and rounded once. Long amounts display 6 decimals, cut not rounded, with a tap for the exact value;
the confirm screen always shows exact amounts. _Alternatives:_ a decimal library (more weight, same
result) or floats (wrong for 18-decimal ETH). Some of these rules (no floats even when formatting,
round displayed values down) came from previous experience with payments.

**Balance right after a claim.** I asked the AI for options first (`ai-logs/02-build-session.md`,
search "Adjust immediately"): **A** show only server numbers (user 1 claims again), **B** adjust
at once and reconcile, **C** hide the balance until the next snapshot (feels broken). **Chose B.**
A claim created after the snapshot's `asOf` is shown as moved from available to "being claimed"
(pending), removed from available only (completed) or ignored (failed). Once a snapshot with
`asOf ≥ createdAt` arrives, the server's number already includes it and the local adjustment drops
out — no double counting, no unexplained jump. The card says "Includes your claim of X made just
now". Max and validation use the adjusted amount. Timestamps are compared with `Date.parse`.

**When the result of a claim is unknown.** The Idempotency-Key and body are saved to browser
storage _before_ the request (if storage fails, the claim isn't sent). Only a 4xx with the error
envelope counts as "rejected" (cleared, error shown). 401 and 409 keep the record and pause.
Everything else (timeouts, any 5xx, network errors, a 2xx that fails validation) is **unknown**:
the app retries with the same key and body, then shows "We're confirming your claim" with only
"Check again". The record is never cleared by a timer, blocks new claims, survives reloads, is
bound to the token used at confirm, and a double tap / second tab can't start a second one (sync
lock + Web Locks). The API returns the original claim for a repeated key, so replay _is_ the lookup.
This happened for real while testing: the first POST got no answer, the retry returned
`Idempotent-Replayed: true`, and activity shows exactly one claim.

**Other decisions.** The browser calls the API directly (CORS is open; the brief forbids the token
in the build, so an earlier server proxy was removed). All API text is rendered as plain text;
responses are validated with strict zod schemas and invalid data is an error, never a 0. Light
theme using CashMine's own palette and logo.

**Assumptions** (no one to ask): a snapshot includes every claim created before its `asOf` (the docs
imply it); the server remembers an Idempotency-Key at least as long as the token lives (24 h).

## Working with AI

All in `ai-logs/02-build-session.md` unless noted.

1. **A prompt that didn't get what I wanted.** I asked Claude Design for "a light variation" and got
   a generic teal palette. I changed the prompt to "use the same colours as cashmine.io" and pointed
   it at the site; it then read the site's CSS tokens (brand orange `#F58A3A`, warm neutrals) and I
   added the logo. Search "same color these as cashmine.io".
2. **AI output that was wrong or risky.** (a) The plan's test for the USD total expected `82058n`;
   a second review on another model caught that 820.5772… must round down to `82057n`. Search
   "wrong test value". (b) The first plan cleared the claim record on a 409 and after 10 minutes,
   which could allow a second claim; the external review flagged it and replay-by-key replaced it.
   (c) Simulating a 503 in the browser showed "Updated 2 s ago" while refreshes kept failing — the
   age was measured from the last success. Fixed with a ticking clock.
3. **Where I disagreed.** The review asked for a SHA-256 token fingerprint for storage keys; I kept
   FNV-1a because the token itself sits in the same browser storage, so a cryptographic hash
   protects nothing (search "One suggestion I didn't take"). I also dropped the design's progress bar on the status screen: the API reports
   no progress, so it would be invented.

## Not done / known issues

- **Activity** is basic: a "Load more" list (cursor paging); no filters, and amounts for an asset
  missing from the balances list are shown as the raw string.
- Home doesn't poll a pending claim's status; the status screen does, and Home reconciles via the
  15 s snapshot. After a claim settles, "being claimed" can lag up to one snapshot.
- 409 and 429 paths and resume-after-reload are covered by unit tests but weren't exercised in the
  browser. No screen-level (RNTL) tests for Home and Claim yet.
- Pull-to-refresh isn't wired (there's a Refresh button). Light theme only.
- Safari private mode can block storage; then claims are refused on purpose (stated on screen).

Next: Home polling of open claims, screen tests for the claim flow, activity filters.
