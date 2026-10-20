export function GET() {
  return Response.json({
    ok: true,
    // Report only whether the proxy is set up, never the values.
    proxyConfigured: Boolean(process.env.API_BASE_URL && process.env.API_TOKEN),
    time: new Date().toISOString(),
  });
}
