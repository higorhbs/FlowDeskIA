import crypto from 'node:crypto'
import axios from 'axios'
import {
  getBusinessMercadoPagoIntegration,
  setBusinessMercadoPagoIntegration,
} from '@flowdesk/firebase'

const MP_API = 'https://api.mercadopago.com'
const MP_AUTH = 'https://auth.mercadopago.com/authorization'
const REFRESH_SKEW_MS = 5 * 60 * 1000

function optionalEnv(name) {
  const v = process.env[name]?.trim()
  return v || undefined
}

export function isMercadoPagoAppConfigured() {
  return Boolean(optionalEnv('MP_CLIENT_ID') && optionalEnv('MP_CLIENT_SECRET'))
}

export function mpRedirectUri() {
  return (
    optionalEnv('MP_REDIRECT_URI') ||
    `${(optionalEnv('API_PUBLIC_URL') || optionalEnv('WA_API_PUBLIC_URL') || '').replace(/\/$/, '')}/mercadopago/oauth/callback`
  )
}

export function buildMercadoPagoAuthUrl(state) {
  const clientId = optionalEnv('MP_CLIENT_ID')
  if (!clientId) throw new Error('MP_CLIENT_ID não configurado')
  const redirectUri = mpRedirectUri()
  if (!redirectUri) throw new Error('MP_REDIRECT_URI não configurado')
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: redirectUri,
  })
  return `${MP_AUTH}?${params.toString()}`
}

export async function exchangeMercadoPagoCode(code) {
  const clientId = optionalEnv('MP_CLIENT_ID')
  const clientSecret = optionalEnv('MP_CLIENT_SECRET')
  const redirectUri = mpRedirectUri()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Credenciais Mercado Pago da plataforma incompletas')
  }
  const { data } = await axios.post(
    `${MP_API}/oauth/token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 }
  )
  return normalizeTokenResponse(data)
}

async function refreshMercadoPagoToken(refreshToken) {
  const clientId = optionalEnv('MP_CLIENT_ID')
  const clientSecret = optionalEnv('MP_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Mercado Pago da plataforma incompletas')
  }
  const { data } = await axios.post(
    `${MP_API}/oauth/token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 }
  )
  return normalizeTokenResponse(data)
}

function normalizeTokenResponse(data) {
  const expiresIn = Number(data.expires_in) || 21600
  return {
    accessToken: String(data.access_token || ''),
    refreshToken: String(data.refresh_token || ''),
    mpUserId: String(data.user_id ?? data.userId ?? ''),
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    liveMode: data.live_mode !== false,
  }
}

export async function fetchMercadoPagoUserEmail(accessToken) {
  try {
    const { data } = await axios.get(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15_000,
    })
    return data?.email ? String(data.email) : undefined
  } catch {
    return undefined
  }
}

export async function getValidMercadoPagoAccessToken(businessId) {
  const integration = await getBusinessMercadoPagoIntegration(businessId)
  if (!integration?.accessToken) return null

  const expiresAt = Date.parse(integration.expiresAt || '')
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_SKEW_MS
  if (stillValid) {
    return { accessToken: integration.accessToken, integration }
  }

  if (!integration.refreshToken) {
    return { accessToken: integration.accessToken, integration }
  }

  const tokens = await refreshMercadoPagoToken(integration.refreshToken)
  const saved = await setBusinessMercadoPagoIntegration(businessId, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || integration.refreshToken,
    mpUserId: tokens.mpUserId || integration.mpUserId,
    expiresAt: tokens.expiresAt,
    email: integration.email,
    liveMode: tokens.liveMode,
  })
  return { accessToken: saved.accessToken, integration: saved }
}

export function publicMercadoPagoWebhookUrl() {
  const envBase =
    optionalEnv('API_PUBLIC_URL') ||
    optionalEnv('WA_API_PUBLIC_URL') ||
    optionalEnv('NEXT_PUBLIC_API_URL')
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) {
    return `${envBase.replace(/\/$/, '')}/webhooks/mercadopago`
  }
  return 'https://api.flowdesk.app/webhooks/mercadopago'
}

export async function createMercadoPagoPixPayment({
  accessToken,
  amount,
  description,
  payerEmail,
  externalReference,
  notificationUrl,
  idempotencyKey,
}) {
  const { data } = await axios.post(
    `${MP_API}/v1/payments`,
    {
      transaction_amount: Number(amount),
      description,
      payment_method_id: 'pix',
      payer: { email: payerEmail },
      external_reference: externalReference,
      notification_url: notificationUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      timeout: 25_000,
    }
  )

  const tx = data?.point_of_interaction?.transaction_data || {}
  return {
    mpPaymentId: String(data.id),
    status: String(data.status || ''),
    pixCopyPaste: String(tx.qr_code || ''),
    pixQrCode: String(tx.qr_code_base64 || ''),
  }
}

export async function fetchMercadoPagoPayment(accessToken, paymentId) {
  const { data } = await axios.get(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 20_000,
  })
  return data
}

export function signOAuthState(businessId) {
  const secret = optionalEnv('MP_CLIENT_SECRET') || 'flowdesk-mp'
  const ts = Date.now().toString(36)
  const payload = `${businessId}.${ts}`
  const sig = simpleHmac(secret, payload)
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyOAuthState(state) {
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8')
    const parts = raw.split('.')
    if (parts.length !== 3) return null
    const [businessId, ts, sig] = parts
    const secret = optionalEnv('MP_CLIENT_SECRET') || 'flowdesk-mp'
    const expected = simpleHmac(secret, `${businessId}.${ts}`)
    if (sig !== expected) return null
    const age = Date.now() - parseInt(ts, 36)
    if (!Number.isFinite(age) || age > 15 * 60 * 1000 || age < 0) return null
    return businessId
  } catch {
    return null
  }
}

function simpleHmac(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32)
}
