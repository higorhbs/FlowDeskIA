import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { log } from './lib/log.js'
import { installProcessGuards } from './process-guards.js'
import { isWhatsAppRuntime } from './whatsapp/wa-manager.js'

if (isWhatsAppRuntime()) installProcessGuards()

const app = createApp()

let shutdownStarted = false

async function shutdownWhatsAppWorkers(signal) {
  if (shutdownStarted) return
  shutdownStarted = true
  log.info(`[backend] ${signal} — stopping WhatsApp workers`)
  try {
    const { releaseWaLeadership } = await import('./whatsapp/wa-leader.js')
    const { waManager } = await import('./whatsapp/wa-manager.js')
    await waManager.shutdownAll()
    await releaseWaLeadership()
  } catch (err) {
    log.debug('[backend] WhatsApp shutdown error:', err)
  }
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    void shutdownWhatsAppWorkers(signal).finally(() => process.exit(0))
  })
}

async function startWhatsAppWorkers() {
  if (!isWhatsAppRuntime()) return

  const { acquireWaLeadership, startWaLeadershipRenewal } = await import(
    './whatsapp/wa-leader.js'
  )
  if (!(await acquireWaLeadership())) return

  startWaLeadershipRenewal()

  const { restoreWhatsAppSessions } = await import('../dist/whatsapp/wa-lifecycle.js')
  const { startMessageWorker } = await import('../dist/whatsapp/workers/message-worker.js')
  const { startStatusScheduler } = await import('../dist/whatsapp/workers/status-scheduler.js')

  await restoreWhatsAppSessions({ timeoutMs: 60_000 })
  startMessageWorker()
  startStatusScheduler()
}

void startWhatsAppWorkers()

const retentionRaw = process.env.PRIVACY_RETENTION_INTERVAL_HOURS?.trim()
const retentionIntervalHours = retentionRaw ? Number(retentionRaw) : 0
if (retentionIntervalHours > 0) {
  const runRetention = async () => {
    try {
      const { runPrivacyRetentionForAllTenants } = await import(
        './services/privacy-compliance.js'
      )
      const result = await runPrivacyRetentionForAllTenants(365)
      log.debug('[privacy] retention run completed', result)
    } catch (err) {
      log.error('[privacy] retention run failed:', err)
    }
  }
  setTimeout(runRetention, 10_000)
  setInterval(runRetention, retentionIntervalHours * 60 * 60 * 1000)
}

serve(
  {
    fetch: app.fetch,
    port: env.port,
    hostname: env.host,
  },
  (info) => {
    log.info(`Backend listening on http://${env.host}:${info.port}`)
    if (!env.isProduction) {
      log.info(`API docs: http://localhost:${info.port}/docs`)
    }
  },
)
