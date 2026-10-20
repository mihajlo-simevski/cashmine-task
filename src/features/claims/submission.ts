import { useSyncExternalStore } from "react";

import { type Claim, ClaimSchema } from "@/features/api/schemas";
import { tokenKey } from "@/features/token/token-store";
import { ApiError, apiWithMeta, MAX_RETRY_WAIT_MS } from "@/lib/api";
import { storage } from "@/lib/storage";

// The claim journal. A claim's Idempotency-Key and body are saved *before* the request,
// and the record is only removed once a response settles it. Replaying the same key and
// body is safe: the API returns the original claim and never creates a second one.

export type ClaimBody = { asset: string; amount: string; destinationId: string };

export type PendingSubmission = {
  key: string;
  body: ClaimBody;
  tokenKey: string;
  firstAttemptAt: string;
};

export type Outcome =
  | { kind: "created"; claim: Claim; replayed: boolean }
  /** The API refused it; no claim exists for this key. Safe to clear. */
  | { kind: "rejected"; error: ApiError }
  /** 401 or 409: the claim may exist. Keep the journal; the user must act. */
  | { kind: "paused"; error: ApiError }
  /** No clear answer (timeout, 5xx, network, unreadable 2xx). Keep the journal. */
  | { kind: "unknown"; error: unknown };

const journalKey = (token: string) => `cashmine.pending.${tokenKey(token)}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: PendingSubmission | null }>();

function isPending(value: unknown): value is PendingSubmission {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const body = v.body as Record<string, unknown> | undefined;
  return (
    typeof v.key === "string" &&
    typeof v.tokenKey === "string" &&
    typeof v.firstAttemptAt === "string" &&
    typeof body === "object" &&
    body !== null &&
    typeof body.asset === "string" &&
    typeof body.amount === "string" &&
    typeof body.destinationId === "string"
  );
}

export function loadPending(token: string): PendingSubmission | null {
  const key = journalKey(token);
  const raw = storage.get(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  let value: PendingSubmission | null = null;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    value = isPending(parsed) ? parsed : null;
  } catch {
    value = null;
  }
  cache.set(key, { raw, value });
  return value;
}

/** Saves and reads back. False means storage can't be trusted, so don't send the claim. */
export function savePending(token: string, submission: PendingSubmission): boolean {
  const ok = storage.set(journalKey(token), JSON.stringify(submission));
  listeners.forEach((listener) => listener());
  return ok && loadPending(token)?.key === submission.key;
}

export function clearPending(token: string): void {
  storage.remove(journalKey(token));
  listeners.forEach((listener) => listener());
}

export function usePendingSubmission(token: string): PendingSubmission | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadPending(token),
    () => null,
  );
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createSubmission(
  token: string,
  body: ClaimBody,
  now = new Date(),
): PendingSubmission {
  return {
    key: newIdempotencyKey(),
    body,
    tokenKey: tokenKey(token),
    firstAttemptAt: now.toISOString(),
  };
}

type Classification = "rejected" | "paused" | "rate_limited" | "unknown";

/** Anything not known to be a refusal is treated as "the claim may exist". */
export function classifyPostError(error: unknown): Classification {
  if (!(error instanceof ApiError)) return "unknown";
  if (error.status === 401 || error.status === 409) return "paused";
  if (error.status === 429) return "rate_limited";
  if (error.status >= 400 && error.status < 500 && error.details.hasEnvelope) return "rejected";
  return "unknown";
}

/** POSTs the claim with the token captured at Confirm, never the "current" token. */
export async function postClaim(
  token: string,
  submission: PendingSubmission,
  signal?: AbortSignal,
): Promise<{ claim: Claim; replayed: boolean }> {
  const { data, headers } = await apiWithMeta(ClaimSchema, "claims", {
    token,
    method: "POST",
    body: submission.body,
    headers: { "Idempotency-Key": submission.key },
    signal,
  });
  return { claim: data, replayed: headers.get("idempotent-replayed") === "true" };
}

type Deps = {
  post: (submission: PendingSubmission) => Promise<{ claim: Claim; replayed: boolean }>;
  sleep: (ms: number) => Promise<void>;
  signal?: AbortSignal;
};

/** Sends the claim, retrying unclear outcomes with the same key and body. */
export async function submitWithRetry(
  submission: PendingSubmission,
  { post, sleep, signal }: Deps,
  { maxAttempts = 4 }: { maxAttempts?: number } = {},
): Promise<Outcome> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) break;
    try {
      const { claim, replayed } = await post(submission);
      return { kind: "created", claim, replayed };
    } catch (error) {
      lastError = error;
      const kind = classifyPostError(error);
      if (kind === "rejected" || kind === "paused") {
        return { kind, error: error as ApiError };
      }
      if (attempt === maxAttempts - 1) break;
      let wait = 1000 * 2 ** attempt;
      if (kind === "rate_limited") {
        const hinted = (error as ApiError).details.retryAfterMs;
        if (hinted !== undefined && hinted > MAX_RETRY_WAIT_MS) break;
        wait = hinted ?? wait;
      }
      await sleep(Math.min(wait, MAX_RETRY_WAIT_MS));
    }
  }
  return { kind: "unknown", error: lastError };
}
