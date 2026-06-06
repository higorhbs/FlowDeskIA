import type {
  WhatsAppClient,
  WhatsAppMessage,
  WAMessage,
} from '@flowdesk/whatsapp-client'
import {
  createWaAuthFileStore,
  enqueueWhatsappInboundJob,
  hasWhatsAppAuth,
  listBusinessIdsWithWhatsAppAuth,
  setBusinessConnected,
} from '@flowdesk/firebase'
import { saveChatMedia } from './chat-media.js'
import { processMessage } from './services/bot.js'
import { waManager } from './wa-manager.js'

const lifecycleAttached = new WeakSet<WhatsAppClient>()

export async function hasStoredSession(businessId: string): Promise<boolean> {
  return hasWhatsAppAuth(businessId)
}

export async function listStoredSessionBusinessIds(): Promise<string[]> {
  return listBusinessIdsWithWhatsAppAuth()
}

export function attachWhatsAppLifecycle(businessId: string, client: WhatsAppClient) {
  if (lifecycleAttached.has(client)) return
  lifecycleAttached.add(client)

  client.on('connected', async () => {
    try {
      await setBusinessConnected(businessId, true)
      attachWhatsAppMessageHandler(businessId, client)
    } catch (err) {
      console.error(`[whatsapp] failed to mark connected for ${businessId}:`, err)
    }
  })

  client.on('disconnected', async () => {
    try {
      await setBusinessConnected(businessId, false)
    } catch (err) {
      console.error(`[whatsapp] failed to mark disconnected for ${businessId}:`, err)
    }
  })
}

async function deliverBotReplies(
  businessId: string,
  client: WhatsAppClient,
  msg: WhatsAppMessage,
  media?: { mediaUrl?: string; mediaType?: WhatsAppMessage['mediaType'] }
) {
  const responses = await processMessage({
    businessId,
    customerPhone: msg.from,
    customerName: msg.pushName,
    messageBody: msg.body,
    replyJid: msg.replyJid,
    mediaUrl: media?.mediaUrl,
    mediaType: media?.mediaType,
  })

  if (responses.length === 0) {
    console.log(`[whatsapp] no bot reply business=${businessId} from=${msg.from}`)
    return
  }

  const dest = msg.replyJid || msg.from
  for (const resp of responses) {
    if (resp.imageUrl) {
      await client.sendImage(dest, resp.imageUrl, resp.text)
    } else if (resp.text) {
      await client.sendText(dest, resp.text)
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  console.log(`[whatsapp] replied business=${businessId} to=${dest} count=${responses.length}`)
}

async function resolveInboundMedia(
  businessId: string,
  client: WhatsAppClient,
  msg: WhatsAppMessage,
  raw: WAMessage
) {
  if (!msg.mediaType) return {}
  const downloaded = await client.downloadMessageMedia(raw)
  if (!downloaded) {
    console.warn(
      `[whatsapp] media download failed business=${businessId} type=${msg.mediaType} id=${msg.messageId}`
    )
    return { mediaType: msg.mediaType }
  }
  const saved = await saveChatMedia(
    businessId,
    downloaded.buffer,
    downloaded.mimetype,
    downloaded.mediaType
  )
  console.log(
    `[whatsapp] media saved business=${businessId} type=${saved.mediaType} url=${saved.mediaUrl}`
  )
  return { mediaUrl: saved.mediaUrl, mediaType: saved.mediaType }
}

async function enqueueInbound(
  businessId: string,
  msg: WhatsAppMessage,
  media?: { mediaUrl?: string; mediaType?: WhatsAppMessage['mediaType'] }
) {
  const jobId = msg.messageId ? `${businessId}_${msg.messageId}` : undefined
  await enqueueWhatsappInboundJob(
    businessId,
    {
      customerPhone: msg.from,
      customerName: msg.pushName,
      messageBody: msg.body,
      replyJid: msg.replyJid,
      mediaUrl: media?.mediaUrl,
      mediaType: media?.mediaType,
    },
    jobId
  )
}

export function attachWhatsAppMessageHandler(businessId: string, client: WhatsAppClient) {
  const flag = '__flowdeskMsgHandler' as const
  if ((client as unknown as Record<string, boolean>)[flag]) return
  ;(client as unknown as Record<string, boolean>)[flag] = true

  client.on('message', (msg: WhatsAppMessage, raw: WAMessage) => {
    void (async () => {
      console.log(
        `[whatsapp] inbound business=${businessId} from=${msg.from} reply=${msg.replyJid} body=${msg.body.slice(0, 60)}`
      )
      let media: { mediaUrl?: string; mediaType?: WhatsAppMessage['mediaType'] } = {}
      try {
        media = await resolveInboundMedia(businessId, client, msg, raw)
      } catch (err) {
        console.error(`[whatsapp] inbound media save failed business=${businessId}:`, err)
      }
      try {
        await enqueueInbound(businessId, msg, media)
        return
      } catch (err) {
        console.error(`[whatsapp] Firestore queue failed business=${businessId}, direct fallback:`, err)
      }
      try {
        await deliverBotReplies(businessId, client, msg, media)
      } catch (directErr) {
        console.error(`[whatsapp] direct reply failed business=${businessId}:`, directErr)
      }
    })()
  })
}

export function ensureWhatsAppClient(businessId: string): WhatsAppClient {
  const client = waManager.getOrCreate(businessId, createWaAuthFileStore(businessId))
  attachWhatsAppLifecycle(businessId, client)
  attachWhatsAppMessageHandler(businessId, client)
  return client
}

export async function resolveWhatsAppClient(
  businessId: string,
  opts?: { waitMs?: number }
): Promise<WhatsAppClient | null> {
  const client = ensureWhatsAppClient(businessId)
  const waitMs = opts?.waitMs ?? 0

  const tryConnect = async () => {
    if (client.isConnected() || client.isReadyToSend()) return
    try {
      if (client.status === 'close') {
        await client.connect()
      } else if (client.status === 'connecting') {
        await new Promise((r) => setTimeout(r, 1500))
        if (!client.isConnected() && !client.isReadyToSend()) await client.kickPairing()
      } else {
        await client.kickPairing()
      }
    } catch (err) {
      console.error(`[whatsapp] resolve connect failed for ${businessId}:`, err)
    }
  }

  if (!client.isConnected() && !client.isReadyToSend()) await tryConnect()

  if (waitMs > 0) {
    const deadline = Date.now() + waitMs
    while (Date.now() < deadline) {
      if (client.isConnected() || client.isReadyToSend()) return client
      if (client.status === 'close') await tryConnect()
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  if (!client.isConnected() && (await hasStoredSession(businessId))) {
    try {
      await client.kickPairing()
    } catch (err) {
      console.error(`[whatsapp] resolve kickPairing failed for ${businessId}:`, err)
    }
    const extraWait = Math.min(12_000, waitMs || 12_000)
    const deadline = Date.now() + extraWait
    while (Date.now() < deadline) {
      if (client.isConnected() || client.isReadyToSend()) return client
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  const ready = client.isConnected() || client.isReadyToSend()
  if (!ready) {
    const debug = client.getDebugInfo()
    console.warn(
      `[whatsapp] resolve timeout business=${businessId} status=${debug.status} socketOpen=${debug.socketOpen}`
    )
  }

  return ready ? client : null
}

export async function waitForWhatsAppReady(
  businessId: string,
  timeoutMs = 30_000,
  opts?: { forPublish?: boolean }
): Promise<WhatsAppClient | null> {
  const client = ensureWhatsAppClient(businessId)
  const ready = () =>
    opts?.forPublish ? client.isPublishReady() : client.isConnected() || client.isReadyToSend()
  if (ready()) return client

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs

    const done = (value: WhatsAppClient | null) => {
      cleanup()
      resolve(value)
    }

    const onConnected = () => {
      if (ready()) done(client)
    }

    const timer = setInterval(() => {
      if (ready()) {
        done(client)
        return
      }
      if (Date.now() >= deadline) done(null)
    }, 400)

    const cleanup = () => {
      clearInterval(timer)
      client.off('connected', onConnected)
    }

    client.on('connected', onConnected)
  })
}

export async function teardownWhatsAppSession(businessId: string) {
  let client = waManager.get(businessId)
  if (!client && (await hasStoredSession(businessId))) {
    client = ensureWhatsAppClient(businessId)
  }
  if (client) {
    try {
      await client.logout()
    } catch {
      await createWaAuthFileStore(businessId).clear().catch(() => undefined)
    }
    waManager.remove(businessId)
  } else {
    await createWaAuthFileStore(businessId).clear().catch(() => undefined)
  }

  await setBusinessConnected(businessId, false)
}

export async function restoreWhatsAppSessions(opts?: { timeoutMs?: number }): Promise<void> {
  const ids = await listStoredSessionBusinessIds()
  if (ids.length === 0) return
  const timeoutMs = opts?.timeoutMs ?? 60_000
  console.log(`[whatsapp] Restoring ${ids.length} stored session(s)...`)
  await Promise.all(
    ids.map(async (id) => {
      const client = ensureWhatsAppClient(id)
      if (client.isConnected() || client.isReadyToSend()) return
      try {
        await client.connect()
      } catch (err) {
        console.error(`[whatsapp] restore connect failed for ${id}:`, err)
      }
      const ready = await waitForWhatsAppReady(id, timeoutMs)
      if (!ready) {
        const debug = client.getDebugInfo()
        console.warn(
          `[whatsapp] restore timeout business=${id} status=${debug.status} socketOpen=${debug.socketOpen}`
        )
      }
    })
  )
}
