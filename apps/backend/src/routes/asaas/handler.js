import axios from 'axios'
import { z } from 'zod'
import {
  deleteBusinessAsaasIntegration,
  getBusiness,
  getBusinessAsaasIntegration,
  getTenant,
  hasAdminCredential,
  setBusinessAsaasIntegration,
} from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../lib/auth-guard.js'
import { resolveAsaasCredentials } from '../../services/asaas-credentials.js'

function maskApiKey(key) {
  const t = key.trim()
  if (t.length <= 8) return '••••••••'
  return `••••${t.slice(-4)}`
}

function maskToken(token) {
  if (token.length <= 4) return '••••'
  return `••••${token.slice(-4)}`
}

function isLocalHost(host) {
  if (!host) return false
  return /(^|\.)localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host)
}

function publicWebhookUrl(c) {
  const envBase =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.WA_API_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim()
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) {
    return `${envBase.replace(/\/$/, '')}/webhooks/asaas`
  }

  const host = c.req.header('x-forwarded-host') || c.req.header('host')
  const proto = (c.req.header('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https'
  if (host && !isLocalHost(host)) {
    return `${proto}://${host.replace(/\/$/, '')}/webhooks/asaas`
  }
  return 'https://api.flowdesk.app/webhooks/asaas'
}

function tenantAllowsPix(plan) {
  return plan === 'PRO' || plan === 'UNLIMITED'
}

async function requireAsaasAuth(c) {
  if (!hasAdminCredential()) {
    return {
      error: json(c, 503, {
        error: 'Credencial Firebase Admin ausente. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
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

async function fetchAsaasBalance(creds) {
  const res = await axios.get(`${creds.baseUrl}/finance/balance`, {
    headers: { access_token: creds.apiKey },
    timeout: 15_000,
  })
  return typeof res.data.balance === 'number' ? res.data.balance : null
}

export async function asaasGetHandler(c) {
  const auth = await requireAsaasAuth(c)
  if (auth.error) return auth.error

  const id = c.req.param('id')
  if (!(await getBusiness(id, auth.tenantId))) {
    return json(c, 404, { error: 'Negócio não encontrado' })
  }
  const blocked = await requirePixPlan(c, auth.tenantId)
  if (blocked) return blocked

  const integration = await getBusinessAsaasIntegration(id)
  const creds = resolveAsaasCredentials(integration)

  let balanceBrl = null
  if (creds) {
    try {
      balanceBrl = await fetchAsaasBalance(creds)
    } catch {
      balanceBrl = null
    }
  }

  return c.json({
    configured: Boolean(creds),
    sandbox: integration?.sandbox ?? false,
    keyPreview: integration?.apiKey ? maskApiKey(integration.apiKey) : null,
    webhookTokenConfigured: Boolean(integration?.webhookToken),
    webhookTokenPreview: integration?.webhookToken ? maskToken(integration.webhookToken) : null,
    webhookUrl: publicWebhookUrl(c),
    balanceBrl,
  })
}

export async function asaasPutHandler(c) {
  const auth = await requireAsaasAuth(c)
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
      apiKey: z.string().min(20).optional(),
      sandbox: z.boolean().optional(),
      webhookToken: z.string().min(8).max(200).optional(),
    })
    .parse(body)

  const existing = await getBusinessAsaasIntegration(id)
  const apiKey = (parsed.apiKey?.trim() || existing?.apiKey || '').trim()
  if (!apiKey) {
    return json(c, 400, { error: 'Informe a Chave API do Asaas.' })
  }

  const sandbox = false
  const creds = resolveAsaasCredentials({ apiKey, sandbox })
  if (!creds) {
    return json(c, 400, { error: 'Não foi possível validar a chave Asaas.' })
  }

  try {
    await fetchAsaasBalance(creds)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chave rejeitada pelo Asaas'
    return json(c, 400, { error: `Chave inválida: ${msg}.` })
  }

  const webhookToken = parsed.webhookToken?.trim() || existing?.webhookToken
  await setBusinessAsaasIntegration(id, { apiKey, sandbox, webhookToken })

  let balanceBrl = null
  try {
    balanceBrl = await fetchAsaasBalance(creds)
  } catch {
    /* ignore */
  }

  return c.json({
    configured: true,
    sandbox,
    keyPreview: maskApiKey(apiKey),
    webhookTokenConfigured: Boolean(webhookToken),
    webhookUrl: publicWebhookUrl(c),
    balanceBrl,
  })
}

export async function asaasDeleteHandler(c) {
  const auth = await requireAsaasAuth(c)
  if (auth.error) return auth.error

  const id = c.req.param('id')
  if (!(await getBusiness(id, auth.tenantId))) {
    return json(c, 404, { error: 'Negócio não encontrado' })
  }
  const blocked = await requirePixPlan(c, auth.tenantId)
  if (blocked) return blocked

  await deleteBusinessAsaasIntegration(id)
  return c.body(null, 204)
}
