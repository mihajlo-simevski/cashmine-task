// Forwards /api/proxy/<path> to API_BASE_URL/<path> with the secret API_TOKEN.
// The token lives only in server env vars (.env.local locally, EAS env on
// hosting), so it never ships in the browser bundle.

import { resolveProxyTarget } from "@/lib/proxy-target";

// Adjust to match the API docs (e.g. "x-api-key" with the bare token).
const AUTH_HEADER = "authorization";
const formatToken = (token: string) => `Bearer ${token}`;

const FORWARDED_REQUEST_HEADERS = ["accept", "accept-language", "content-type", "idempotency-key"];
// Only these upstream headers reach the browser. Everything else (cookies, redirects,
// encoding headers that no longer match the decoded body) is dropped.
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag"];
// The upstream API is untrusted: stop the browser from running anything it returns.
const SAFETY_HEADERS = {
  "content-security-policy": "default-src 'none'; sandbox",
  "x-content-type-options": "nosniff",
};

async function forward(request: Request): Promise<Response> {
  const baseUrl = process.env.API_BASE_URL;
  const token = process.env.API_TOKEN;
  if (!baseUrl || !token) {
    return Response.json({ error: "API proxy is not configured" }, { status: 500 });
  }

  const target = resolveProxyTarget(request.url, baseUrl);
  if (!target) return Response.json({ error: "Invalid path" }, { status: 400 });

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(AUTH_HEADER, formatToken(token));

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      // Never follow redirects: the token must only go to API_BASE_URL.
      redirect: "error",
    });
  } catch {
    return Response.json({ error: "Upstream request failed" }, { status: 502 });
  }

  const responseHeaders = new Headers(SAFETY_HEADERS);
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };
