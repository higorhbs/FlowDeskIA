import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { installProcessGuards } from './process-guards.js'
import { resolveSessionsRoot } from './config/wa-paths.js'
import { isWhatsAppRuntime } from './whatsapp/wa-manager.js'

const app = createApp()

async function startWhatsAppWorkers() {
  if (!isWhatsAppRuntime()) return

  const sessionsRoot = resolveSessionsRoot()

  installProcessGuards()

  const { restoreWhatsAppSessions } = await import('../dist/whatsapp/wa-lifecycle.js')
  const { probeRedis } = await import('../dist/whatsapp/redis-health.js')
  const { startMessageWorker, startReminderWorker } = await import(
    '../dist/whatsapp/workers/message-worker.js'
  )
  const { startStatusScheduler } = await import('../dist/whatsapp/workers/status-scheduler.js')

  void restoreWhatsAppSessions(sessionsRoot)

  const redisOk = await probeRedis()
  if (redisOk) {
    startMessageWorker()
    startReminderWorker()
    console.log('[whatsapp] BullMQ workers started (Redis ok)')
  } else {
    console.warn(
      '[whatsapp] Redis offline — inbound sem fila; mensagens processadas no handler Baileys.'
    )
    console.warn('[whatsapp] Para fila: suba Redis local (REDIS_URL)')
  }

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
      console.log('[privacy] retention run completed', result)
    } catch (err) {
      console.error('[privacy] retention run failed:', err)
    }
  }
  setTimeout(runRetention, 10_000)
  setInterval(runRetention, retentionIntervalHours * 60 * 60 * 1000)
}

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`Backend listening on http://localhost:${info.port}`)
    console.log(`OpenAPI: http://localhost:${info.port}/doc`)
    console.log(`Swagger UI: http://localhost:${info.port}/swagger`)
  },
)
