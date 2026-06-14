import { serve } from '@hono/node-server'
import { hasAdminCredential } from '@flowdesk/firebase'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { log } from './lib/log.js'
import { installProcessGuards } from './process-guards.js'
import { isWhatsAppRuntime } from './whatsapp/wa-manager.js'

installProcessGuards()

const app = createApp()
const firebaseReady = hasAdminCredential()

log.info(
  `[startup] host=${env.host} port=${env.port} workers=${isWhatsAppRuntime()} firebase=${firebaseReady}`,
)

if (!firebaseReady) {
  log.error(
    '[startup] FIREBASE_* ausente — configure PROJECT_ID, CLIENT_EMAIL e PRIVATE_KEY no Dokploy',
  )
}

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

async function bootWaWorkers() {
  const { restoreWhatsAppSessions } = await import('../dist/whatsapp/wa-lifecycle.js')
  const { startMessageWorker } = await import('../dist/whatsapp/workers/message-worker.js')
  const { startStatusScheduler } = await import('../dist/whatsapp/workers/status-scheduler.js')

  await restoreWhatsAppSessions({ timeoutMs: 60_000 })
  startMessageWorker()
  startStatusScheduler()
}

let waWorkersBooted = false

async function startWhatsAppWorkers() {
  if (!isWhatsAppRuntime()) return

  const { acquireWaLeadership, startWaLeadershipRenewal } = await import(
    './whatsapp/wa-leader.js'
  )
  if (!(await acquireWaLeadership())) {
    if (!waWorkersBooted) {
      setTimeout(() => void startWhatsAppWorkers(), 20_000)
    }
    return
  }

  if (waWorkersBooted) return
  waWorkersBooted = true
  startWaLeadershipRenewal()
  await bootWaWorkers()
}

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

try {
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
      setTimeout(() => {
        void startWhatsAppWorkers().catch((err) => {
          log.error('[whatsapp] worker startup failed (API still up):', err)
        })
      }, 2000)
    },
  )
} catch (err) {
  log.error('[startup] failed to bind HTTP port:', err)
  process.exit(1)
}
