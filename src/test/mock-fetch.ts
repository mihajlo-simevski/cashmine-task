// Minimal fetch stub. The Jest environment has no global Response, and the app only
// reads `ok`, `status`, `headers.get()` and `text()`.
type MockResponse = { status: number; body: unknown; headers?: Record<string, string> };

export function fakeResponse({ status, body, headers = {} }: MockResponse) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: () =>
      Promise.resolve(body === null ? "" : typeof body === "string" ? body : JSON.stringify(body)),
  };
}

export function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const fetchMock = jest.fn().mockResolvedValue(fakeResponse({ status, body, headers }));
  globalThis.fetch = fetchMock;
  return fetchMock;
}

/** Each call returns the next response (or throws it when it is an Error). */
export function mockFetchSequence(responses: (MockResponse | Error)[]) {
  const fetchMock = jest.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(fakeResponse(r));
  }
  globalThis.fetch = fetchMock;
  return fetchMock;
}
