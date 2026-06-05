import { createBusiness, hasAdminCredential, listBusinesses } from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../lib/auth-guard.js'

const BUSINESS_TYPES = new Set([
  'BARBERSHOP',
  'SALON',
  'RESTAURANT',
  'DENTAL',
  'STORE',
  'OTHER',
])

function requireAdmin(c) {
  if (!hasAdminCredential()) {
    return json(c, 503, {
      error:
        'Credencial Firebase Admin ausente. Configure GOOGLE_APPLICATION_CREDENTIALS.',
    })
  }
  return null
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}

function parseCreateBody(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const type = typeof body?.type === 'string' ? body.type.trim().toUpperCase() : ''
  const phone = normalizePhone(
    typeof body?.whatsapp === 'string'
      ? body.whatsapp
      : typeof body?.phone === 'string'
        ? body.phone
        : ''
  )
  const description =
    typeof body?.description === 'string' ? body.description.trim() : undefined

  if (name.length < 2) return { error: 'Informe o nome do negócio (mín. 2 caracteres).' }
  if (!BUSINESS_TYPES.has(type)) {
    return {
      error:
        'Tipo inválido. Use: BARBERSHOP, SALON, RESTAURANT, DENTAL, STORE ou OTHER.',
    }
  }
  if (!phone) {
    return { error: 'Informe um número de WhatsApp válido (10 a 15 dígitos).' }
  }

  return {
    data: {
      name,
      type,
      phone,
      ...(description ? { description } : {}),
    },
  }
}

export async function createBusinessHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  const parsed = parseCreateBody(await c.req.json().catch(() => ({})))
  if (parsed.error) return json(c, 400, { error: parsed.error })

  try {
    const business = await createBusiness(auth.decoded.uid, parsed.data)
    return json(c, 201, business)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar negócio.'
    return json(c, 500, { error: message })
  }
}

export async function listBusinessesHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  try {
    const items = await listBusinesses(auth.decoded.uid)
    const businesses = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return json(c, 200, { businesses })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao listar negócios.'
    return json(c, 500, { error: message })
  }
}
