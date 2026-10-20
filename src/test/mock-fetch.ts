// Minimal fetch stub. The Jest environment has no global Response, and the app
// only reads `ok`, `status` and `text()`.
export function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === null ? "" : JSON.stringify(body)),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}
