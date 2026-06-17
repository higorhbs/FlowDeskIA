import type {
  WhatsAppClient,
  WhatsAppMessage,
  WAMessage,
} from '@flowdesk/whatsapp-client'
import {
  createWaAuthFileStore,
  getBusiness,
  getBusinessMediaReadUrl,
  getTenant,
  enqueueWhatsappInboundJob,
  hasWhatsAppAuth,
  listBusinessIdsWithWhatsAppAuth,
  resolveBusinessMediaBuffer,
  setBusinessConnected,
} from '@flowdesk/firebase'
import { planAllowsChatMediaStorage } from '@flowdesk/shared'
import { log } from '../lib/log.js'
import { saveChatMedia } from './chat-media.js'
import { persistBotReplies, processMessage, takeLastProcessMeta, type BotResponse } from './services/bot.js'
import { waManager } from './wa-manager.js'

const lifecycleAttached = new WeakSet<WhatsAppClient>()

function restoreStaggerMs(): number {
  const raw = process.env.WA_RESTORE_STAGGER_MS?.trim()
  if (!raw) return 3000
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 3000
}

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
      log.error(`[whatsapp] failed to mark connected for ${businessId}:`, err)
    }
  })

  client.on('disconnected', async () => {
    try {
      await setBusinessConnected(businessId, false)
    } catch (err) {
      log.error(`[whatsapp] failed to mark disconnected for ${businessId}:`, err)
    }
  })
}

function resolveLeadFlowDeliveryMediaType(resp: BotResponse): "image" | "video" | "gif" {
  const hint = `${resp.imageUrl ?? ""} ${resp.imageStoragePath ?? ""}`.toLowerCase();
  if (hint.includes(".gif")) return "gif";
  if (hint.includes(".mp4") || hint.includes(".mov")) return "video";
  if (resp.mediaType === "gif" || resp.mediaType === "video") return resp.mediaType;
  return "image";
}

async function deliverLeadFlowMedia(
  client: WhatsAppClient,
  dest: string,
  resp: BotResponse,
): Promise<string | undefined> {
  if (!resp.imageUrl) return undefined;
  const mediaType = resolveLeadFlowDeliveryMediaType(resp);
  const caption = resp.text?.trim() || undefined;
  const local = await resolveBusinessMediaBuffer(resp.imageUrl, resp.imageStoragePath);
  const signedUrl = await getBusinessMediaReadUrl(resp.imageUrl, resp.imageStoragePath);

  if (mediaType === "gif") {
    const buffer = local?.buffer?.length ? local.buffer : undefined;
    const mediaUrl = signedUrl ?? resp.imageUrl;
    const altUrl = signedUrl && signedUrl !== resp.imageUrl ? resp.imageUrl : undefined;
    if (!buffer?.length) {
      log.warn(
        `[whatsapp] lead flow gif without local buffer business media=${resp.imageStoragePath ?? resp.imageUrl}`,
      );
    }
    return client.sendFlowGif(dest, { buffer, mediaUrl, altUrl, caption });
  }

  const attempts: Array<() => Promise<string | undefined>> = [];
  if (local) {
    attempts.push(() =>
      mediaType === "image"
        ? client.sendImageBuffer(dest, local.buffer, local.mimetype, caption)
        : client.sendChatMediaBuffer(dest, local.buffer, local.mimetype, mediaType, caption),
    );
  }
  const url = signedUrl ?? resp.imageUrl;
  attempts.push(() =>
    mediaType === "image"
      ? client.sendImage(dest, url, caption)
      : client.sendChatMedia(dest, url, mediaType, caption),
  );
  if (signedUrl && signedUrl !== resp.imageUrl) {
    attempts.push(() =>
      mediaType === "image"
        ? client.sendImage(dest, resp.imageUrl!, caption)
        : client.sendChatMedia(dest, resp.imageUrl!, mediaType, caption),
    );
  }

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const id = await attempt();
      return id ?? "delivered";
    } catch (err) {
      lastErr = err;
      log.warn(`[whatsapp] lead flow media attempt failed type=${mediaType}:`, err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar mídia do fluxo guiado.");
}

export async function deliverBotResponses(
  businessId: string,
  client: WhatsAppClient,
  dest: string,
  conversationId: string | undefined,
  responses: BotResponse[],
): Promise<void> {
  const ordered = [
    ...responses.filter((r) => r.documentBuffer?.length),
    ...responses.filter((r) => !r.documentBuffer?.length),
  ];
  let documentFailed = false;

  for (const resp of ordered) {
    try {
      let waMessageId: string | undefined;
      const docBuffer = resp.documentBuffer?.length
        ? Buffer.isBuffer(resp.documentBuffer)
          ? resp.documentBuffer
          : Buffer.from(resp.documentBuffer as Uint8Array)
        : undefined;

      if (resp.imageUrl) {
        waMessageId = await deliverLeadFlowMedia(client, dest, resp);
      } else if (docBuffer?.length) {
        const teamPhone = resp.alsoSendDocumentTo?.replace(/\D/g, "");
        const teamOnly = resp.sendDocumentToTeamOnly === true;
        const caption = `Novo ${resp.documentLabel ?? "documento"}: ${resp.documentFilename ?? "documento.pdf"}`;
        if (teamOnly) {
          if (resp.sendDocumentToSelf) {
            try {
              waMessageId = await client.sendDocument(
                "",
                docBuffer,
                resp.documentFilename ?? "documento.pdf",
                resp.documentMimetype ?? "application/pdf",
                caption,
                { self: true },
              );
            } catch (notifyErr) {
              documentFailed = true;
              log.error(`[whatsapp] self document failed business=${businessId}:`, notifyErr);
              try {
                await client.sendText(
                  dest,
                  "⚠️ Seus dados foram salvos, mas não conseguimos enviar o PDF na conversa com você mesmo. Tente reconectar o WhatsApp no painel.",
                );
              } catch {
                /* ignore */
              }
            }
          } else if (!teamPhone) {
            documentFailed = true;
            log.warn(`[whatsapp] team document skipped — no notify phone business=${businessId}`);
            try {
              await client.sendText(
                dest,
                "⚠️ Seus dados foram salvos, mas o WhatsApp da equipe não está configurado no painel.",
              );
            } catch {
              /* ignore */
            }
          } else {
            try {
              waMessageId = await client.sendDocument(
                teamPhone,
                docBuffer,
                resp.documentFilename ?? "documento.pdf",
                resp.documentMimetype ?? "application/pdf",
                caption,
              );
            } catch (notifyErr) {
              documentFailed = true;
              log.error(`[whatsapp] team document failed business=${businessId} phone=${teamPhone}:`, notifyErr);
              try {
                await client.sendText(
                  dest,
                  "⚠️ Seus dados foram salvos, mas não conseguimos enviar o PDF para a equipe. Confira o número no painel ou use *Receber na conversa comigo*.",
                );
              } catch {
                /* ignore */
              }
            }
          }
        } else {
          waMessageId = await client.sendDocument(
            dest,
            docBuffer,
            resp.documentFilename ?? "documento.pdf",
            resp.documentMimetype ?? "application/pdf",
            resp.text?.trim() || undefined,
          );
          if (teamPhone) {
            try {
              await client.sendDocument(
                teamPhone,
                docBuffer,
                resp.documentFilename ?? "documento.pdf",
                resp.documentMimetype ?? "application/pdf",
                caption,
              );
            } catch (notifyErr) {
              log.warn(`[whatsapp] resume notify failed business=${businessId}:`, notifyErr);
            }
          }
        }
      } else if (resp.buttons?.length) {
        waMessageId = await client.sendButtons(dest, resp.text, resp.buttons);
      } else if (resp.text?.trim()) {
        if (documentFailed) continue;
        waMessageId = await client.sendText(dest, resp.text);
      }
      if (conversationId && waMessageId) {
        await persistBotReplies(businessId, conversationId, [resp]);
      }
    } catch (err) {
      log.error(`[whatsapp] deliver response failed business=${businessId}:`, err);
      if (resp.imageUrl) {
        const link = resp.imageUrl.trim();
        const fallback = resp.text?.trim() ? `${resp.text.trim()}\n\n${link}` : link;
        try {
          const waMessageId = await client.sendText(dest, fallback);
          if (conversationId && waMessageId) {
            await persistBotReplies(businessId, conversationId, [{ text: fallback }]);
          }
          continue;
        } catch (fallbackErr) {
          log.error(`[whatsapp] media text fallback failed business=${businessId}:`, fallbackErr);
        }
      } else if (resp.text?.trim()) {
        try {
          const waMessageId = await client.sendText(dest, resp.text);
          if (conversationId && waMessageId) {
            await persistBotReplies(businessId, conversationId, [{ text: resp.text }]);
          }
        } catch (fallbackErr) {
          log.error(`[whatsapp] text fallback failed business=${businessId}:`, fallbackErr);
        }
      }
    }
    await new Promise((r) => setTimeout(r, resp.imageUrl ? 1200 : 800));
  }
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
    persistReplies: false,
  })

  if (responses.length === 0) {
    log.debug(`[whatsapp] no bot reply business=${businessId}`)
    return
  }

  const dest = msg.replyJid || msg.from
  const meta = takeLastProcessMeta()
  await deliverBotResponses(businessId, client, dest, meta?.conversationId, responses)
  log.debug(`[whatsapp] replied business=${businessId} count=${responses.length}`)
}

async function shouldPersistChatMedia(businessId: string): Promise<boolean> {
  const business = await getBusiness(businessId)
  if (!business?.tenantId) return false
  const tenant = await getTenant(business.tenantId)
  return planAllowsChatMediaStorage(tenant?.plan ?? 'STARTER')
}

async function resolveInboundMedia(
  businessId: string,
  client: WhatsAppClient,
  msg: WhatsAppMessage,
  raw: WAMessage
) {
  if (!msg.mediaType) return {}
  if (!(await shouldPersistChatMedia(businessId))) {
    return { mediaType: msg.mediaType }
  }
  const downloaded = await client.downloadMessageMedia(raw)
  if (!downloaded) {
    log.warn(
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
  log.debug(`[whatsapp] media saved business=${businessId} type=${saved.mediaType}`)
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
      let media: { mediaUrl?: string; mediaType?: WhatsAppMessage['mediaType'] } = {}
      try {
        media = await resolveInboundMedia(businessId, client, msg, raw)
      } catch (err) {
        log.error(`[whatsapp] inbound media save failed business=${businessId}:`, err)
      }
      try {
        await enqueueInbound(businessId, msg, media)
        return
      } catch (err) {
        log.warn(`[whatsapp] Firestore queue failed business=${businessId}, direct fallback:`, err)
      }
      try {
        await deliverBotReplies(businessId, client, msg, media)
      } catch (directErr) {
        log.error(`[whatsapp] direct reply failed business=${businessId}:`, directErr)
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
      log.error(`[whatsapp] resolve connect failed for ${businessId}:`, err)
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
      log.error(`[whatsapp] resolve kickPairing failed for ${businessId}:`, err)
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
    log.warn(
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
  const stagger = restoreStaggerMs()
  log.info(`[whatsapp] Restoring ${ids.length} stored session(s) (stagger=${stagger}ms)`)
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const client = ensureWhatsAppClient(id)
    if (!client.isConnected() && !client.isReadyToSend()) {
      try {
        await client.connect()
      } catch (err) {
        log.error(`[whatsapp] restore connect failed for ${id}:`, err)
      }
      const ready = await waitForWhatsAppReady(id, timeoutMs)
      if (!ready) {
        const debug = client.getDebugInfo()
        log.warn(
          `[whatsapp] restore timeout business=${id} status=${debug.status} socketOpen=${debug.socketOpen}`
        )
      }
    }
    if (i < ids.length - 1) {
      await new Promise((r) => setTimeout(r, stagger))
    }
  }
}
