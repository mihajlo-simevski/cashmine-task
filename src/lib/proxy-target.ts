export const PROXY_PREFIX = "/api/proxy/";

/**
 * Maps an incoming /api/proxy/<path>?<query> URL onto the upstream API.
 * Returns null when the result would leave the configured API, e.g. for paths
 * like "https://evil.example" or "//evil.example" that URL() treats as absolute.
 */
export function resolveProxyTarget(requestUrl: string, baseUrl: string): URL | null {
  const incoming = new URL(requestUrl);
  if (!incoming.pathname.startsWith(PROXY_PREFIX)) return null;

  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const path = incoming.pathname.slice(PROXY_PREFIX.length);
  const target = new URL(path + incoming.search, base);

  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return null;
  return target;
}
