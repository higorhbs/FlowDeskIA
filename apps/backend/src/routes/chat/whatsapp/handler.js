import {
  createMessage,
  getBusiness,
  getConversation,
  hasAdminCredential,
  setBusinessConnected,
  upsertConversation,
} from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../../lib/auth-guard.js'
import { saveChatMedia } from '../../../whatsapp/chat-media.js'
import { connectForQr, readWhatsAppStatus } from '../../../whatsapp/wa-connect.js'
import { isWhatsAppRuntime } from '../../../whatsapp/wa-manager.js'
import {
  resolveWhatsAppClient,
  teardownWhatsAppSession,
} from '../../../whatsapp/wa-lifecycle.runtime.js'

function requireAdmin(c) {
  if (!hasAdminCredential()) {
    return json(c, 503, { error: 'Credencial Firebase Admin ausente.' })
  }
  return null
}

function waUnavailable(c) {
  return json(c, 503, {
    status: 'error',
    message: 'WhatsApp exige processo contínuo (ENABLE_WORKERS=true).',
  })
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

export async function getQrCodeHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  if (!isWhatsAppRuntime()) {
    return json(c, 200, {
      connected: false,
      status: 'unavailable',
      message: 'WhatsApp indisponível neste servidor.',
    })
  }

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  try {
    const payload = await readWhatsAppStatus(businessId, ctx.business)
    return json(c, 200, payload)
  } catch (err) {
    return json(c, 500, {
      error: err instanceof Error ? err.message : 'Erro ao ler status WhatsApp.',
    })
  }
}

export async function postQrCodeHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked
  if (!isWhatsAppRuntime()) return waUnavailable(c)

  const businessId = c.req.param('businessId')
  const force = c.req.query('force') === '1'
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  try {
    const result = await connectForQr(businessId, force)
    if (result.status === 'already_connected') {
      await setBusinessConnected(businessId, true)
    }
    return json(c, 200, result)
  } catch (err) {
    return json(c, 500, {
      status: 'error',
      message: err instanceof Error ? err.message : 'Falha ao gerar QR Code',
    })
  }
}

export async function deleteConnectionHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked
  if (!isWhatsAppRuntime()) return waUnavailable(c)

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  await teardownWhatsAppSession(businessId)
  return json(c, 200, { status: 'disconnected' })
}

export async function postMessageHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked
  if (!isWhatsAppRuntime()) return waUnavailable(c)

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const body = await c.req.json().catch(() => ({}))
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const conversationId =
    typeof body.conversationId === 'string' ? body.conversationId.trim() : ''

  if (!to || !text) {
    return json(c, 400, { error: 'Destino e mensagem são obrigatórios.' })
  }

  const client = await resolveWhatsAppClient(businessId, { waitMs: 12_000 })
  if (!client) {
    await setBusinessConnected(businessId, false)
    return json(c, 400, {
      error: 'WhatsApp desconectado. Escaneie o QR Code novamente.',
    })
  }

  let convId = conversationId
  let dest = to
  if (convId) {
    const conv = await getConversation(businessId, convId)
    if (!conv) return json(c, 404, { error: 'Conversa não encontrada.' })
    dest = conv.replyJid?.trim() || conv.customerPhone?.trim() || dest
  } else {
    const conv = await upsertConversation(businessId, to)
    convId = conv.id
    dest = conv.replyJid?.trim() || conv.customerPhone?.trim() || dest
  }

  const waMessageId = await client.sendText(dest, text)
  const message = await createMessage(businessId, convId, {
    role: 'HUMAN',
    content: text,
  })

  return json(c, 200, { messageId: waMessageId, message })
}

async function readUploadFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null
  const buf = Buffer.from(await file.arrayBuffer())
  const mimetype = file.type || 'application/octet-stream'
  return { buffer: buf, mimetype }
}

export async function postMessageMediaHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked
  if (!isWhatsAppRuntime()) return waUnavailable(c)

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const form = await c.req.parseBody()
  const conversationId = String(form.conversationId ?? '').trim()
  const caption = String(form.text ?? '').trim()
  const upload = await readUploadFile(form.file)

  if (!conversationId) {
    return json(c, 400, { error: 'conversationId é obrigatório.' })
  }
  if (!upload?.buffer?.length) {
    return json(c, 400, { error: 'Arquivo de mídia é obrigatório.' })
  }

  const conv = await getConversation(businessId, conversationId)
  if (!conv) return json(c, 404, { error: 'Conversa não encontrada.' })

  const client = await resolveWhatsAppClient(businessId, { waitMs: 12_000 })
  if (!client) {
    await setBusinessConnected(businessId, false)
    return json(c, 400, {
      error: 'WhatsApp desconectado. Escaneie o QR Code novamente.',
    })
  }

  let mediaUrl
  let mediaStoragePath
  let mediaType
  try {
    const saved = await saveChatMedia(businessId, upload.buffer, upload.mimetype)
    mediaUrl = saved.mediaUrl
    mediaStoragePath = saved.mediaStoragePath
    mediaType = saved.mediaType
  } catch (err) {
    return json(c, 400, {
      error: err instanceof Error ? err.message : 'Upload inválido',
    })
  }

  const dest = conv.replyJid?.trim() || conv.customerPhone?.trim()
  if (!dest) return json(c, 400, { error: 'Destino da conversa inválido.' })

  const waMessageId = await client.sendChatMedia(dest, mediaUrl, mediaType, caption)
  const content =
    caption ||
    (mediaType === 'image' ? '[imagem]' : mediaType === 'video' ? '[video]' : '[audio]')
  const message = await createMessage(businessId, conversationId, {
    role: 'HUMAN',
    content,
    mediaUrl,
    mediaStoragePath,
    mediaType,
    waMessageId,
  })

  return json(c, 200, { messageId: waMessageId, message })
}
