/**
 * @jest-environment node
 */
import { GET } from "@/app/api/proxy/[...path]+api";

const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = "https://api.example.com/v1";
  process.env.API_TOKEN = "test-token";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function upstream(body: string, init: ResponseInit) {
  const fetchMock = jest.fn().mockResolvedValue(new Response(body, init));
  globalThis.fetch = fetchMock;
  return fetchMock;
}

describe("API proxy", () => {
  it("adds the token server-side and refuses redirects", async () => {
    const fetchMock = upstream("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await GET(new Request("https://app.test/api/proxy/users/me"));

    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe("https://api.example.com/v1/users/me");
    expect(init.headers.get("authorization")).toBe("Bearer test-token");
    expect(init.redirect).toBe("error");
  });

  it("forwards only safe response headers and blocks active content", async () => {
    upstream("<script>alert(1)</script>", {
      status: 200,
      headers: {
        "content-type": "text/html",
        "set-cookie": "a=b",
        location: "https://evil.example",
      },
    });

    const res = await GET(new Request("https://app.test/api/proxy/users/me"));

    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns 502 when the upstream request fails (e.g. a redirect)", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("unexpected redirect"));

    const res = await GET(new Request("https://app.test/api/proxy/users/me"));

    expect(res.status).toBe(502);
  });

  it("rejects paths that would leave the API host", async () => {
    const fetchMock = upstream("{}", { status: 200 });

    const res = await GET(new Request("https://app.test/api/proxy//evil.example/x"));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
