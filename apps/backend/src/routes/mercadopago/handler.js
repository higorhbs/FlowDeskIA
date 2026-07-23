import { z } from 'zod'
import {
  deleteBusinessMercadoPagoIntegration,
  getBusiness,
  getBusinessMercadoPagoIntegration,
  getTenant,
  hasAdminCredential,
  setBusinessMercadoPagoIntegration,
} from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../lib/auth-guard.js'
import {
  publicMercadoPagoWebhookUrl,
  validateMercadoPagoAccessToken,
} from '../../services/mercadopago.js'

function tenantAllowsPix(plan) {
  return plan === 'PRO' || plan === 'UNLIMITED'
}

function maskToken(token) {
  const t = String(token || '').trim()
  if (t.length <= 8) return '••••••••'
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  if (user.length <= 2) return `••@${domain}`
  return `${user.slice(0, 2)}•••@${domain}`
}

async function requireMpAuth(c) {
  if (!hasAdminCredential()) {
    return {
      error: json(c, 503, {
        error:
          'Credencial Firebase Admin ausente. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
      }),
    }
  }
  const auth = await requireBearerUser(c)
  if (auth.error) return auth
  return { tenantId: auth.decoded.uid }
}

async function requirePixPlan(c, tenantId) {
  const tenant = await getTenant(tenantId)
  if (!tenantAllowsPix(tenant?.plan)) {
    return json(c, 403, {
      error: 'Cobrança PIX automática disponível no plano Pro ou Unlimited.',
    })
  }
  return null
}

export async function mercadoPagoGetHandler(c) {
  const auth = await requireMpAuth(c)
  if (auth.error) return auth.error

  const id = c.req.param('id')
  if (!(await getBusiness(id, auth.tenantId))) {
    return json(c, 404, { error: 'Negócio não encontrado' })
  }
  const blocked = await requirePixPlan(c, auth.tenantId)
  if (blocked) return blocked

  const integration = await getBusinessMercadoPagoIntegration(id)
  return c.json({
    configured: Boolean(integration?.accessToken),
    accessTokenPreview: integration?.accessToken ? maskToken(integration.accessToken) : null,
    publicKeyPreview: integration?.publicKey ? maskToken(integration.publicKey) : null,
    email: maskEmail(integration?.email),
    mpUserId: integration?.mpUserId || null,
    liveMode: integration?.liveMode !== false,
    webhookUrl: publicMercadoPagoWebhookUrl(),
  })
}

export async function mercadoPagoPutHandler(c) {
  const auth = await requireMpAuth(c)
  if (auth.error) return auth.error

  const id = c.req.param('id')
  if (!(await getBusiness(id, auth.tenantId))) {
    return json(c, 404, { error: 'Negócio não encontrado' })
  }
  const blocked = await requirePixPlan(c, auth.tenantId)
  if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({
      accessToken: z.string().min(20).optional(),
      publicKey: z.string().min(10).optional(),
    })
    .parse(body)

  const existing = await getBusinessMercadoPagoIntegration(id)
  const accessToken = (parsed.accessToken?.trim() || existing?.accessToken || '').trim()
  if (!accessToken) {
    return json(c, 400, { error: 'Informe o Access Token do Mercado Pago.' })
  }

  let profile
  try {
    profile = await validateMercadoPagoAccessToken(accessToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token rejeitado'
    return json(c, 400, { error: `Access Token inválido: ${msg}` })
  }

  const publicKey = parsed.publicKey?.trim() || existing?.publicKey
  await setBusinessMercadoPagoIntegration(id, {
    accessToken,
    publicKey,
    mpUserId: profile.mpUserId,
    email: profile.email,
    liveMode: profile.liveMode,
  })

  return c.json({
    configured: true,
    accessTokenPreview: maskToken(accessToken),
    publicKeyPreview: publicKey ? maskToken(publicKey) : null,
    email: maskEmail(profile.email),
    mpUserId: profile.mpUserId || null,
    liveMode: profile.liveMode,
    webhookUrl: publicMercadoPagoWebhookUrl(),
  })
}

export async function mercadoPagoDeleteHandler(c) {
  const auth = await requireMpAuth(c)
  if (auth.error) return auth.error

  const id = c.req.param('id')
  if (!(await getBusiness(id, auth.tenantId))) {
    return json(c, 404, { error: 'Negócio não encontrado' })
  }
  const blocked = await requirePixPlan(c, auth.tenantId)
  if (blocked) return blocked

  await deleteBusinessMercadoPagoIntegration(id)
  return c.body(null, 204)
}
