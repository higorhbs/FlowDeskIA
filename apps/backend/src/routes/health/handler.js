export function healthHandler(c) {
  return c.json({
    status: 'ok',
    ok: true,
    ts: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  })
}
