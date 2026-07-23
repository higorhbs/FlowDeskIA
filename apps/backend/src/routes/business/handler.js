import {
  createBusiness,
  getBusiness,
  getTenant,
  hasAdminCredential,
  listBusinesses,
  uploadBusinessMedia,
  deleteBusinessMedia,
} from '@flowdesk/firebase'
import {
  assertLeadFlowMediaQuota,
  countLeadFlowMediaNodes,
  getLeadFlowMediaLimit,
  normalizeLeadCaptureFlow,
} from '@flowdesk/shared'
import { json, requireBearerUser } from '../../lib/auth-guard.js'

const BUSINESS_TYPES = new Set([
  'BARBERSHOP',
  'RESTAURANT',
  'DENTAL',
  'STORE',
  'OTHER',
])

function requireAdmin(c) {
  if (!hasAdminCredential()) {
    return json(c, 503, {
      error:
        'Credencial Firebase Admin ausente. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
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
  const typeRaw = typeof body?.type === 'string' ? body.type.trim().toUpperCase() : ''
  const type = typeRaw === 'SALON' ? 'BARBERSHOP' : typeRaw
  const phone = normalizePhone(
    typeof body?.whatsapp === 'string'
      ? body.whatsapp
      : typeof body?.phone === 'string'
        ? body.phone
        : ''
  )
  const description =
    typeof body?.description === 'string' ? body.description.trim() : undefined
  const typeLabel =
    typeof body?.typeLabel === 'string' ? body.typeLabel.trim() : undefined
  const address = typeof body?.address === 'string' ? body.address.trim() : undefined
  const greetingMsg =
    typeof body?.greetingMsg === 'string' ? body.greetingMsg.trim() : undefined
  const awayMsg = typeof body?.awayMsg === 'string' ? body.awayMsg.trim() : undefined
  const workingHours =
    body?.workingHours && typeof body.workingHours === 'object' ? body.workingHours : undefined

  if (name.length < 2) return { error: 'Informe o nome do negócio (mín. 2 caracteres).' }
  if (!BUSINESS_TYPES.has(type)) {
    return {
      error:
        'Tipo inválido. Use: BARBERSHOP, RESTAURANT, DENTAL, STORE ou OTHER.',
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
      ...(typeLabel ? { typeLabel } : {}),
      ...(address ? { address } : {}),
      ...(greetingMsg ? { greetingMsg } : {}),
      ...(awayMsg ? { awayMsg } : {}),
      ...(workingHours ? { workingHours } : {}),
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

async function resolveOwnedBusiness(c, businessId) {
  const auth = await requireBearerUser(c)
  if (auth.error) return { error: auth.error }

  const business = await getBusiness(businessId, auth.decoded.uid)
  if (!business) {
    return { error: json(c, 404, { error: 'Negócio não encontrado.' }) }
  }
  return { auth, business }
}

async function readUploadFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null
  const buf = Buffer.from(await file.arrayBuffer())
  const mimetype = file.type || 'image/jpeg'
  return { buffer: buf, mimetype }
}

export async function postLeadFlowMediaHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const form = await c.req.parseBody()
  const upload = await readUploadFile(form.file)
  if (!upload?.buffer?.length) {
    return json(c, 400, { error: 'Envie uma imagem, GIF ou vídeo.' })
  }

  const nodeId = String(form.nodeId ?? '').trim()
  const flow = normalizeLeadCaptureFlow(ctx.business.leadFlow)
  const tenant = await getTenant(ctx.business.tenantId)
  const plan = tenant?.plan ?? 'STARTER'
  const limit = getLeadFlowMediaLimit(plan)
  const used = countLeadFlowMediaNodes(flow)
  const replacing = nodeId && flow.nodes.some((n) => n.id === nodeId && n.imageUrl)
  if (!replacing && used >= limit) {
    return json(c, 400, {
      error:
        limit === 1
          ? 'Seu plano permite 1 mídia (imagem, GIF ou vídeo) no fluxo guiado.'
          : `Seu plano permite ${limit} mídias no fluxo guiado e você já atingiu o limite.`,
    })
  }

  try {
    const prevNode = nodeId ? flow.nodes.find((n) => n.id === nodeId) : undefined
    const saved = await uploadBusinessMedia(businessId, 'flow', upload.buffer, upload.mimetype)
    const draft = normalizeLeadCaptureFlow({
      ...flow,
      nodes: flow.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              imageUrl: saved.mediaUrl,
              imageStoragePath: saved.mediaStoragePath,
              mediaType: saved.mediaType === 'video' || saved.mediaType === 'gif' ? saved.mediaType : 'image',
            }
          : n,
      ),
    })
    assertLeadFlowMediaQuota(draft, plan)
    if (prevNode?.imageStoragePath || prevNode?.imageUrl) {
      await deleteBusinessMedia(prevNode.imageUrl, prevNode.imageStoragePath).catch(() => undefined)
    }
    return json(c, 200, {
      mediaUrl: saved.mediaUrl,
      mediaStoragePath: saved.mediaStoragePath,
      mediaType: saved.mediaType === 'video' || saved.mediaType === 'gif' ? saved.mediaType : 'image',
    })
  } catch (err) {
    return json(c, 400, {
      error: err instanceof Error ? err.message : 'Upload inválido',
    })
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
