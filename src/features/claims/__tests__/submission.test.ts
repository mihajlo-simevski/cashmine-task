import type { Claim } from "@/features/api/schemas";
import {
  classifyPostError,
  clearPending,
  createSubmission,
  loadPending,
  postClaim,
  savePending,
  submitWithRetry,
} from "@/features/claims/submission";
import { setToken } from "@/features/token/token-store";
import { ApiError } from "@/lib/api";
import { mockFetchSequence } from "@/test/mock-fetch";

const claim: Claim = {
  id: "clm_1",
  asset: "ETH",
  amount: "0.5",
  fee: "0.0012",
  receiveAmount: "0.4988",
  destinationId: "dest_wallet",
  status: "pending",
  failureReason: null,
  createdAt: "2026-10-20T19:10:00.000Z",
  updatedAt: "2026-10-20T19:10:00.000Z",
};
const body = { asset: "ETH", amount: "0.5", destinationId: "dest_wallet" };
const noSleep = () => Promise.resolve();

beforeEach(() => localStorage.clear());

describe("classifyPostError", () => {
  it("treats only refusals as rejected and everything unclear as unknown", () => {
    expect(classifyPostError(new ApiError(400, "VALIDATION", { hasEnvelope: true }))).toBe(
      "rejected",
    );
    expect(classifyPostError(new ApiError(404, "NOT_FOUND", { hasEnvelope: true }))).toBe(
      "rejected",
    );
    expect(classifyPostError(new ApiError(401, "UNAUTHORIZED", { hasEnvelope: true }))).toBe(
      "paused",
    );
    expect(classifyPostError(new ApiError(409, "IDEMPOTENCY_MISMATCH"))).toBe("paused");
    expect(classifyPostError(new ApiError(429, "RATE_LIMITED"))).toBe("rate_limited");
    expect(classifyPostError(new ApiError(400, "UNKNOWN"))).toBe("unknown"); // no envelope
    expect(classifyPostError(new ApiError(408, "UNKNOWN"))).toBe("unknown");
    expect(classifyPostError(new ApiError(502, "SERVER"))).toBe("unknown");
    expect(classifyPostError(new ApiError(201, "INVALID_RESPONSE"))).toBe("unknown");
    expect(classifyPostError(new TypeError("boom"))).toBe("unknown");
  });
});

describe("submitWithRetry", () => {
  const submission = createSubmission("tokA", body);

  it("retries an unclear outcome with the same key and body", async () => {
    const post = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(504, "TIMEOUT", { hasEnvelope: true }))
      .mockResolvedValueOnce({ claim, replayed: true });

    const outcome = await submitWithRetry(submission, { post, sleep: noSleep });

    expect(outcome).toEqual({ kind: "created", claim, replayed: true });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toBe(submission);
    expect(post.mock.calls[1][0]).toBe(submission);
  });

  it("stops at once on a refusal or a 401/409", async () => {
    for (const [error, kind] of [
      [new ApiError(400, "VALIDATION", { hasEnvelope: true }), "rejected"],
      [new ApiError(409, "IDEMPOTENCY_MISMATCH", { hasEnvelope: true }), "paused"],
      [new ApiError(401, "UNAUTHORIZED", { hasEnvelope: true }), "paused"],
    ] as const) {
      const post = jest.fn().mockRejectedValue(error);
      const outcome = await submitWithRetry(submission, { post, sleep: noSleep });
      expect(outcome.kind).toBe(kind);
      expect(post).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up as unknown (not rejected) after repeated server errors", async () => {
    const post = jest.fn().mockRejectedValue(new ApiError(503, "SERVER", { hasEnvelope: true }));
    const outcome = await submitWithRetry(submission, { post, sleep: noSleep });
    expect(outcome.kind).toBe("unknown");
    expect(post).toHaveBeenCalledTimes(4);
  });

  it("waits retryAfterMs on 429 and gives up when the wait is too long", async () => {
    const sleep = jest.fn(noSleep);
    const post = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", { retryAfterMs: 2300 }))
      .mockResolvedValueOnce({ claim, replayed: false });
    await submitWithRetry(submission, { post, sleep });
    expect(sleep).toHaveBeenCalledWith(2300);

    const slow = jest
      .fn()
      .mockRejectedValue(new ApiError(429, "RATE_LIMITED", { retryAfterMs: 60_000 }));
    expect((await submitWithRetry(submission, { post: slow, sleep })).kind).toBe("unknown");
    expect(slow).toHaveBeenCalledTimes(1);
  });
});

describe("postClaim over real fetch calls", () => {
  it("sends the Idempotency-Key and the token captured at confirm, even after a token change", async () => {
    setToken("tokA");
    const submission = createSubmission("tokA", body);
    const fetchMock = mockFetchSequence([
      new TypeError("network down"),
      { status: 200, body: claim, headers: { "Idempotent-Replayed": "true" } },
    ]);

    const post = (s: typeof submission) => postClaim("tokA", s);
    const sleep = () => {
      setToken("tokB"); // the user switches token while the claim is retrying
      return Promise.resolve();
    };
    const outcome = await submitWithRetry(submission, { post, sleep });

    expect(outcome).toEqual({ kind: "created", claim, replayed: true });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe("Bearer tokA");
      expect(init.headers["Idempotency-Key"]).toBe(submission.key);
      expect(init.body).toBe(JSON.stringify(body));
    }
  });

  it("treats a 201 with an unreadable body as unknown, never as rejected", async () => {
    mockFetchSequence([{ status: 201, body: "<html>" }]);
    const outcome = await submitWithRetry(
      createSubmission("tokA", body),
      { post: (s) => postClaim("tokA", s), sleep: noSleep },
      { maxAttempts: 1 },
    );
    expect(outcome.kind).toBe("unknown");
  });
});

describe("journal", () => {
  it("saves, reads back and clears per token", () => {
    const s = createSubmission("tokA", body);
    expect(savePending("tokA", s)).toBe(true);
    expect(loadPending("tokA")?.key).toBe(s.key);
    expect(loadPending("tokB")).toBeNull();
    clearPending("tokA");
    expect(loadPending("tokA")).toBeNull();
  });

  it("reports failure when storage throws, so no claim is sent", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(savePending("tokA", createSubmission("tokA", body))).toBe(false);
    spy.mockRestore();
  });

  it("creates a fresh key per submission", () => {
    expect(createSubmission("t", body).key).not.toBe(createSubmission("t", body).key);
  });
});
