import { randomBytes } from 'node:crypto'
import {
  hasAdminCredential,
  getBusiness,
  updateBusiness,
  listPendingPrintJobs,
  ackPrintJob,
} from '@flowdesk/firebase'
import { normalizePrinterConfig } from '@flowdesk/shared'
import { json, requireBearerUser, requireAgentToken } from '../../lib/auth-guard.js'

const HEARTBEAT_MIN_INTERVAL_MS = 20_000

function requireAdmin(c) {
  if (!hasAdminCredential()) {
    return json(c, 503, {
      error:
        'Credencial Firebase Admin ausente. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
    })
  }
  return null
}

function sameList(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export async function postPrinterAgentPairHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('id')
  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  const business = await getBusiness(businessId, auth.decoded.uid)
  if (!business) return json(c, 404, { error: 'Negócio não encontrado.' })

  const token = randomBytes(24).toString('hex')
  const nextConfig = normalizePrinterConfig({ ...business.printerConfig, agentToken: token })
  await updateBusiness(businessId, business.tenantId, { printerConfig: nextConfig })

  return json(c, 200, { token })
}

export async function getPrinterAgentPollHandler(c) {
  const businessId = c.req.param('id')
  const auth = await requireAgentToken(c, businessId)
  if (auth.error) return auth.error

  const cfg = normalizePrinterConfig(auth.business.printerConfig)
  const printersRaw = c.req.query('printers')
  const printers = printersRaw
    ? printersRaw.split(',').map((p) => p.trim()).filter(Boolean)
    : undefined

  const lastSeenAt = cfg.agentLastSeenAt ? Date.parse(cfg.agentLastSeenAt) : 0
  const printersChanged = printers && !sameList(printers, cfg.agentPrinters ?? [])
  const heartbeatStale = Date.now() - lastSeenAt > HEARTBEAT_MIN_INTERVAL_MS

  if (printersChanged || heartbeatStale) {
    const nextConfig = normalizePrinterConfig({
      ...cfg,
      agentPrinters: printers ?? cfg.agentPrinters,
      agentLastSeenAt: new Date().toISOString(),
    })
    await updateBusiness(businessId, auth.business.tenantId, { printerConfig: nextConfig })
  }

  const jobs = await listPendingPrintJobs(businessId)
  return json(c, 200, {
    jobs: jobs.map((j) => ({ id: j.id, payloadBase64: j.payloadBase64, printerName: j.printerName })),
  })
}

export async function postPrinterAgentAckHandler(c) {
  const businessId = c.req.param('id')
  const auth = await requireAgentToken(c, businessId)
  if (auth.error) return auth.error

  const body = await c.req.json().catch(() => ({}))
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : ''
  if (!jobId) return json(c, 400, { error: 'jobId é obrigatório.' })
  const status = body?.status === 'error' ? 'error' : 'done'

  await ackPrintJob(businessId, jobId, status, typeof body?.error === 'string' ? body.error : undefined)
  return json(c, 200, { status: 'ok' })
}
