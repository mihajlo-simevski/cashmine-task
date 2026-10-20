import { z } from "zod";

import { api, ApiError, apiWithMeta, retryDelay, shouldRetryQuery } from "@/lib/api";
import { mockFetch } from "@/test/mock-fetch";

const UserSchema = z.object({ id: z.string() });

describe("api", () => {
  it("calls the API directly with the given token", async () => {
    const fetchMock = mockFetch(200, { id: "u1" });

    await expect(api(UserSchema, "/balances", { token: "t1" })).resolves.toEqual({ id: "u1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://task-api.cashmine.io/v1/balances");
    expect(init.headers.Authorization).toBe("Bearer t1");
  });

  it("parses the error envelope", async () => {
    mockFetch(400, { error: { code: "VALIDATION", message: "Too small", field: "amount" } });

    const error = await api(UserSchema, "claims", { token: "t" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION",
      details: { field: "amount", apiMessage: "Too small", hasEnvelope: true },
    });
  });

  it("reads retryAfterMs from a 429", async () => {
    mockFetch(429, { error: { code: "RATE_LIMITED", message: "Slow", retryAfterMs: 2300 } });

    const error = await api(UserSchema, "balances", { token: "t" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "RATE_LIMITED", details: { retryAfterMs: 2300 } });
  });

  it("maps a network failure to NETWORK", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await api(UserSchema, "balances", { token: "t" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("rejects a 2xx body that fails the schema", async () => {
    mockFetch(200, { id: 42 });

    const error = await api(UserSchema, "balances", { token: "t" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 200, code: "INVALID_RESPONSE" });
  });

  it("returns headers with the data", async () => {
    mockFetch(200, { id: "c1" }, { "Idempotent-Replayed": "true" });

    const { headers, status } = await apiWithMeta(UserSchema, "claims", { token: "t" });
    expect(status).toBe(200);
    expect(headers.get("idempotent-replayed")).toBe("true");
  });
});

describe("query retries", () => {
  const err = (status: number, code: ApiError["code"]) => new ApiError(status, code);

  it("doesn't retry 4xx except 429", () => {
    expect(shouldRetryQuery(0, err(401, "UNAUTHORIZED"))).toBe(false);
    expect(shouldRetryQuery(0, err(400, "VALIDATION"))).toBe(false);
    expect(shouldRetryQuery(0, err(429, "RATE_LIMITED"))).toBe(true);
    expect(shouldRetryQuery(0, err(503, "SERVER"))).toBe(true);
    expect(shouldRetryQuery(3, err(503, "SERVER"))).toBe(false);
  });

  it("waits retryAfterMs, capped at 10 s", () => {
    expect(retryDelay(0, new ApiError(429, "RATE_LIMITED", { retryAfterMs: 2300 }))).toBe(2300);
    expect(retryDelay(0, new ApiError(429, "RATE_LIMITED", { retryAfterMs: 60_000 }))).toBe(10_000);
  });
});
