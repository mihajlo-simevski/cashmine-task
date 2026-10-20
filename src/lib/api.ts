import type { z } from "zod";

import { PROXY_PREFIX } from "@/lib/proxy-target";

// The browser never talks to the upstream API directly. Calls go to our own
// API route (src/app/api/proxy), which adds the secret token on the server.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
};

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Fetch one of this app's own routes and validate the JSON with `schema`. */
export async function request<T>(
  schema: z.ZodType<T>,
  url: string,
  { body, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return schema.parse(data);
}

/** Call the upstream API through the server proxy, e.g. `api(UserSchema, "users/me")`. */
export function api<T>(schema: z.ZodType<T>, path: string, options?: RequestOptions): Promise<T> {
  return request(schema, `${PROXY_PREFIX}${path.replace(/^\/+/, "")}`, options);
}
