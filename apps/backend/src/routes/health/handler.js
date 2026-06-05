import { hasAdminCredential } from '@flowdesk/firebase'

export function healthHandler(c) {
  return c.json({
    status: 'ok',
    ok: true,
    ts: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  })
}

export function healthAdminHandler(c) {
  return c.json({
    ok: hasAdminCredential(),
    adminConfigured: hasAdminCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? null,
  })
}

export function healthPaymentsHandler(c) {
  return c.json({
    asaasConfigured: Boolean(
      process.env.ASAAS_API_KEY?.trim() && process.env.ASAAS_BASE_URL?.trim(),
    ),
  })
}
