import type { z } from "zod";

import { API_BASE_URL } from "@/lib/config";

// The browser calls the API directly (CORS is open) with the token the user entered.
// Everything the API returns is untrusted data: validated with zod, shown as plain text.

export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "IDEMPOTENCY_MISMATCH"
  | "RATE_LIMITED"
  | "SERVER"
  | "TIMEOUT"
  | "NETWORK"
  | "ABORTED"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

const KNOWN_CODES = new Set<string>([
  "VALIDATION",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "IDEMPOTENCY_MISMATCH",
  "RATE_LIMITED",
  "SERVER",
  "TIMEOUT",
]);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly details: {
      field?: string;
      retryAfterMs?: number;
      apiMessage?: string;
      /** True when the body was the documented `{ error: { code } }` envelope. */
      hasEnvelope?: boolean;
    } = {},
  ) {
    super(`API ${status} ${code}`);
    this.name = "ApiError";
  }
}

export const DEFAULT_TIMEOUT_MS = 15_000;

type HeaderReader = { get(name: string): string | null };

export type RequestOptions = {
  token: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function codeForStatus(status: number): ApiErrorCode {
  if (status === 504) return "TIMEOUT";
  if (status >= 500) return "SERVER";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  return "UNKNOWN";
}

function toApiError(status: number, body: unknown, headers: HeaderReader): ApiError {
  const retryAfterHeader = Number.parseInt(headers.get("retry-after") ?? "", 10);
  const headerMs = Number.isFinite(retryAfterHeader) ? retryAfterHeader * 1000 : undefined;
  const error =
    typeof body === "object" && body !== null && "error" in body
      ? (body as { error: unknown }).error
      : undefined;
  if (typeof error === "object" && error !== null && "code" in error) {
    const e = error as {
      code: unknown;
      message?: unknown;
      field?: unknown;
      retryAfterMs?: unknown;
    };
    const code = typeof e.code === "string" && KNOWN_CODES.has(e.code) ? e.code : "UNKNOWN";
    return new ApiError(status, code as ApiErrorCode, {
      hasEnvelope: true,
      field: typeof e.field === "string" ? e.field : undefined,
      apiMessage: typeof e.message === "string" ? e.message : undefined,
      retryAfterMs: typeof e.retryAfterMs === "number" ? e.retryAfterMs : headerMs,
    });
  }
  return new ApiError(status, codeForStatus(status), { retryAfterMs: headerMs });
}

async function readJson(response: { text(): Promise<string> }): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Calls `/v1/<path>` and returns the validated body with the status and headers. */
export async function apiWithMeta<T>(
  schema: z.ZodType<T>,
  path: string,
  { token, method = "GET", body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal }: RequestOptions,
): Promise<{ data: T; status: number; headers: HeaderReader }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1/${path.replace(/^\/+/, "")}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, signal?.aborted ? "ABORTED" : "NETWORK");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const data = await readJson(response).catch(() => undefined);
  if (!response.ok) throw toApiError(response.status, data, response.headers);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(response.status, "INVALID_RESPONSE");
  return { data: parsed.data, status: response.status, headers: response.headers };
}

export async function api<T>(
  schema: z.ZodType<T>,
  path: string,
  options: RequestOptions,
): Promise<T> {
  return (await apiWithMeta(schema, path, options)).data;
}

const MAX_QUERY_RETRIES = 3;
export const MAX_RETRY_WAIT_MS = 10_000;

/** Reads retry 429s, 5xx and network errors; other 4xx won't fix themselves. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (!(error instanceof ApiError)) return true;
  if (error.code === "RATE_LIMITED") return true;
  return !(error.status >= 400 && error.status < 500) && error.code !== "INVALID_RESPONSE";
}

export function retryDelay(attempt: number, error: unknown): number {
  const hinted = error instanceof ApiError ? error.details.retryAfterMs : undefined;
  return Math.min(hinted ?? 1000 * 2 ** attempt, MAX_RETRY_WAIT_MS);
}
