import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { balancesKey } from "@/features/balances/useBalances";
import { upsertLocalClaim } from "@/features/claims/local-claims";
import {
  type ClaimBody,
  clearPending,
  createSubmission,
  loadPending,
  type PendingSubmission,
  postClaim,
  savePending,
  submitWithRetry,
} from "@/features/claims/submission";
import { tokenKey } from "@/features/token/token-store";
import type { ApiError } from "@/lib/api";

export type SubmitPhase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "unknown" }
  | { kind: "paused"; error: ApiError }
  | { kind: "rejected"; error: ApiError }
  | { kind: "blocked" }
  | { kind: "storage" };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type LockManagerLike = {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<void>,
  ) => Promise<void>;
};

/** Runs `fn` while holding a cross-tab lock when the browser supports Web Locks. */
async function exclusive(name: string, fn: () => Promise<void>, onBusy: () => void) {
  const locks = (globalThis.navigator as { locks?: LockManagerLike } | undefined)?.locks;
  if (!locks) return fn();
  return locks.request(name, { ifAvailable: true }, async (lock) => {
    if (!lock) onBusy();
    else await fn();
  });
}

export function useSubmitClaim(token: string) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<SubmitPhase>({ kind: "idle" });
  // Set synchronously on the first tap, so a double tap can't create two keys.
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);

  // Leaving the screen or switching token stops retries; the journal stays saved.
  useEffect(() => () => abort.current?.abort(), [token]);

  const drive = useCallback(
    async (submission: PendingSubmission) => {
      setPhase({ kind: "submitting" });
      const controller = new AbortController();
      abort.current = controller;
      const outcome = await submitWithRetry(submission, {
        post: (s) => postClaim(token, s, controller.signal),
        sleep,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (outcome.kind === "created") {
        const { claim, replayed } = outcome;
        // Record the claim before clearing the journal, so a crash in between can't lose it.
        upsertLocalClaim(token, {
          id: claim.id,
          asset: claim.asset,
          amount: claim.amount,
          createdAt: claim.createdAt,
          status: claim.status,
        });
        clearPending(token);
        void queryClient.invalidateQueries({ queryKey: balancesKey(token) });
        setPhase({ kind: "idle" });
        router.replace({
          pathname: "/claims/[id]",
          params: { id: claim.id, ...(replayed && { replayed: "1" }) },
        });
      } else if (outcome.kind === "rejected") {
        clearPending(token);
        setPhase({ kind: "rejected", error: outcome.error });
      } else if (outcome.kind === "paused") {
        setPhase({ kind: "paused", error: outcome.error });
      } else {
        setPhase({ kind: "unknown" });
      }
    },
    [queryClient, token],
  );

  const run = useCallback(
    async (work: () => Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await exclusive(`cashmine-claim-${tokenKey(token)}`, work, () =>
          setPhase({ kind: "blocked" }),
        );
      } finally {
        busy.current = false;
      }
    },
    [token],
  );

  /** Starts a new claim. Refuses if one is still being confirmed or storage fails. */
  const confirm = useCallback(
    (body: ClaimBody) =>
      run(async () => {
        if (loadPending(token)) {
          setPhase({ kind: "blocked" });
          return;
        }
        const submission = createSubmission(token, body);
        if (!savePending(token, submission)) {
          setPhase({ kind: "storage" });
          return;
        }
        await drive(submission);
      }),
    [drive, run, token],
  );

  /** Replays the saved claim with the same key, body and token. */
  const resume = useCallback(
    () =>
      run(async () => {
        const submission = loadPending(token);
        if (submission) await drive(submission);
      }),
    [drive, run, token],
  );

  const reset = useCallback(() => setPhase({ kind: "idle" }), []);

  return { phase, confirm, resume, reset };
}
