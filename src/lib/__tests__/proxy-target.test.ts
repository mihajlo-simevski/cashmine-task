import { resolveProxyTarget } from "@/lib/proxy-target";

const BASE = "https://api.example.com/v1";
const at = (path: string) => `https://app.example.com/api/proxy/${path}`;

describe("resolveProxyTarget", () => {
  it("maps the path and query onto the base URL", () => {
    expect(resolveProxyTarget(at("users/me?page=2"), BASE)?.href).toBe(
      "https://api.example.com/v1/users/me?page=2",
    );
  });

  it("accepts a base URL with a trailing slash", () => {
    expect(resolveProxyTarget(at("users"), `${BASE}/`)?.href).toBe(
      "https://api.example.com/v1/users",
    );
  });

  it.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["an encoded path outside the base", "%2e%2e/admin"],
    ["a path outside the base", "../admin"],
  ])("rejects %s so the token never leaves the API", (_name, path) => {
    expect(resolveProxyTarget(at(path), BASE)).toBeNull();
  });

  it("rejects requests outside the proxy prefix", () => {
    expect(resolveProxyTarget("https://app.example.com/api/health", BASE)).toBeNull();
  });
});
