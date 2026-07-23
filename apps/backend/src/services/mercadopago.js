import axios from 'axios'
import { getBusinessMercadoPagoIntegration } from '@flowdesk/firebase'

const MP_API = 'https://api.mercadopago.com'

function optionalEnv(name) {
  const v = process.env[name]?.trim()
  return v || undefined
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

export async function validateMercadoPagoAccessToken(accessToken) {
  const { data } = await axios.get(`${MP_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15_000,
  })
  return {
    mpUserId: data?.id != null ? String(data.id) : '',
    email: data?.email ? String(data.email) : undefined,
    liveMode: !String(accessToken).includes('TEST'),
  }
}

export async function getBusinessMercadoPagoAccessToken(businessId) {
  const integration = await getBusinessMercadoPagoIntegration(businessId)
  if (!integration?.accessToken?.trim()) return null
  return { accessToken: integration.accessToken.trim(), integration }
}

export async function fetchMercadoPagoPayment(accessToken, paymentId) {
  const { data } = await axios.get(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 20_000,
  })
  return data
}
