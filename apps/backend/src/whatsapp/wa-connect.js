import fs from 'fs'
import path from 'path'
import { setBusinessConnected } from '@flowdesk/firebase'
import { waManager } from './wa-manager.js'
import {
  ensureWhatsAppClient,
  hasStoredSession,
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

export async function resetWhatsAppSession(sessionsRoot, businessId) {
  const existing = waManager.get(businessId)
  if (existing) {
    try {
      await existing.logout()
    } catch {
      const sessionDir = path.join(sessionsRoot, businessId)
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true })
    }
    waManager.remove(businessId)
    return
  }
  const sessionDir = path.join(sessionsRoot, businessId)
  if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true })
}

export async function connectForQr(sessionsRoot, businessId, force) {
  if (force) await resetWhatsAppSession(sessionsRoot, businessId)

  const client = ensureWhatsAppClient(sessionsRoot, businessId)

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

  if (!force && hasStoredSession(sessionsRoot, businessId)) {
    await resetWhatsAppSession(sessionsRoot, businessId)
    const fresh = ensureWhatsAppClient(sessionsRoot, businessId)
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

export async function readWhatsAppStatus(sessionsRoot, businessId, business) {
  let client = waManager.get(businessId)
  if (!client) {
    client = ensureWhatsAppClient(sessionsRoot, businessId)
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
