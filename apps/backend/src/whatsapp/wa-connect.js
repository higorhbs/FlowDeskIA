import { setBusinessConnected } from '@flowdesk/firebase'
import { waManager } from './wa-manager.js'
import {
  ensureWhatsAppClient,
  hasStoredSession,
  teardownWhatsAppSession,
} from './wa-lifecycle.runtime.js'

function waitForQr(client, timeoutMs = 22_000) {
  if (client.isConnected()) {
    return Promise.resolve({ status: 'already_connected' })
  }
  if (client.lastQrDataUrl) {
    return Promise.resolve({ status: 'qr', qr: client.lastQrDataUrl })
  }

  return new Promise((resolve) => {
    const done = (result) => {
      clearTimeout(timer)
      client.off('qr', onQr)
      client.off('connected', onConnected)
      resolve(result)
    }

    const timer = setTimeout(() => {
      if (client.lastQrDataUrl) {
        done({ status: 'qr', qr: client.lastQrDataUrl })
        return
      }
      done({
        status: 'connecting',
        message: 'Gerando QR Code. Aguarde alguns segundos nesta tela.',
      })
    }, timeoutMs)

    const onQr = (qrDataUrl) => done({ status: 'qr', qr: qrDataUrl })
    const onConnected = () => done({ status: 'already_connected' })

    client.once('qr', onQr)
    client.once('connected', onConnected)
  })
}

export async function resetWhatsAppSession(businessId) {
  await teardownWhatsAppSession(businessId)
}

export async function connectForQr(businessId, force) {
  if (force) await resetWhatsAppSession(businessId)

  const client = ensureWhatsAppClient(businessId)

  if (client.isConnected()) {
    await setBusinessConnected(businessId, true)
    return { status: 'already_connected' }
  }

  if (client.lastQrDataUrl && !force) {
    return { status: 'qr', qr: client.lastQrDataUrl }
  }

  try {
    await client.kickPairing()
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Falha ao iniciar sessão WhatsApp',
    }
  }

  const result = await waitForQr(client, 22_000)
  if (result.qr || client.isConnected()) return result
  if (client.lastQrDataUrl) {
    return { status: 'qr', qr: client.lastQrDataUrl }
  }

  if (!force && (await hasStoredSession(businessId))) {
    await resetWhatsAppSession(businessId)
    const fresh = ensureWhatsAppClient(businessId)
    try {
      await fresh.kickPairing()
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Falha ao iniciar sessão WhatsApp',
      }
    }
    const retry = await waitForQr(fresh, 22_000)
    if (retry.qr || fresh.isConnected()) return retry
    if (fresh.lastQrDataUrl) {
      return { status: 'qr', qr: fresh.lastQrDataUrl }
    }
  }

  return {
    status: 'connecting',
    message: 'Gerando QR Code. Aguarde nesta tela — o status atualiza sozinho.',
  }
}

export async function readWhatsAppStatus(businessId, business) {
  let client = waManager.get(businessId)
  if (!client) {
    client = ensureWhatsAppClient(businessId)
  }

  const connected = client.isConnected() || client.isReadyToSend()
  if (connected !== business.isConnected) {
    await setBusinessConnected(businessId, connected)
  }

  return {
    connected,
    status: client.status ?? 'disconnected',
    qr: !connected && client.lastQrDataUrl ? client.lastQrDataUrl : undefined,
  }
}
