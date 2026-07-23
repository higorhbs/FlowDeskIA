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
  buildMercadoPagoAuthUrl,
  exchangeMercadoPagoCode,
  fetchMercadoPagoUserEmail,
  isMercadoPagoAppConfigured,
  signOAuthState,
  verifyOAuthState,
} from '../../services/mercadopago.js'

function tenantAllowsPix(plan) {
  return plan === 'PRO' || plan === 'UNLIMITED'
}

function panelBaseUrl() {
  return (process.env.WEB_ORIGIN || process.env.CORS_ORIGIN || 'https://flowdesk.ia.br')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '')
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
    platformConfigured: isMercadoPagoAppConfigured(),
    email: maskEmail(integration?.email),
    mpUserId: integration?.mpUserId || null,
    liveMode: integration?.liveMode !== false,
  })
}

export async function mercadoPagoConnectHandler(c) {
  const auth = await requireMpAuth(c)
  if (auth.error) return auth.error

  const id = c.req.param('id')
  if (!(await getBusiness(id, auth.tenantId))) {
    return json(c, 404, { error: 'Negócio não encontrado' })
  }
  const blocked = await requirePixPlan(c, auth.tenantId)
  if (blocked) return blocked

  if (!isMercadoPagoAppConfigured()) {
    return json(c, 503, {
      error: 'Mercado Pago da plataforma não configurado. Defina MP_CLIENT_ID e MP_CLIENT_SECRET.',
    })
  }

  try {
    const state = signOAuthState(id)
    const url = buildMercadoPagoAuthUrl(state)
    return c.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao gerar URL OAuth'
    return json(c, 500, { error: msg })
  }
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

export async function mercadoPagoOAuthCallbackHandler(c) {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const base = panelBaseUrl()

  if (error) {
    return c.redirect(`${base}/businesses?mp=error`)
  }

  const businessId = state ? verifyOAuthState(state) : null
  if (!code || !businessId) {
    return c.redirect(`${base}/businesses?mp=invalid`)
  }

  try {
    const tokens = await exchangeMercadoPagoCode(code)
    if (!tokens.accessToken || !tokens.refreshToken) {
      return c.redirect(`${base}/businesses/${businessId}/payments?mp=token_error`)
    }
    const email = await fetchMercadoPagoUserEmail(tokens.accessToken)
    await setBusinessMercadoPagoIntegration(businessId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mpUserId: tokens.mpUserId,
      expiresAt: tokens.expiresAt,
      email,
      liveMode: tokens.liveMode,
    })
    return c.redirect(`${base}/businesses/${businessId}/payments?mp=connected`)
  } catch (err) {
    console.error('[mercadopago] oauth callback failed:', err)
    return c.redirect(`${base}/businesses/${businessId}/payments?mp=error`)
  }
}
