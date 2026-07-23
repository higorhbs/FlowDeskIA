import { getAdminAuth, getBusiness } from '@flowdesk/firebase'

export function json(c, status, body) {
  return c.json(body, status)
}

async function bearerIdToken(c) {
  const header = c.req.header('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export async function requireBearerUser(c) {
  const token = await bearerIdToken(c)
  if (!token) return { error: json(c, 401, { error: 'Unauthorized' }) }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    if (decoded.email_verified !== true) {
      return {
        error: json(c, 403, { error: 'Confirme seu e-mail antes de acessar o painel.' }),
      }
    }
    return { decoded }
  } catch {
    return { error: json(c, 401, { error: 'Token inválido.' }) }
  }
}

export async function requireAgentToken(c, businessId) {
  const token = c.req.header('X-Agent-Token')
  if (!token) return { error: json(c, 401, { error: 'Unauthorized' }) }

  const business = await getBusiness(businessId)
  if (!business) return { error: json(c, 404, { error: 'Negócio não encontrado.' }) }

  const expected = business.printerConfig?.agentToken
  if (!expected || token !== expected) {
    return { error: json(c, 401, { error: 'Token de agente inválido.' }) }
  }
  return { business }
}
