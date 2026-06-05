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
    console.warn('[whatsapp] Para fila: docker compose up -d redis')
  }

  startStatusScheduler()
}

void startWhatsAppWorkers()

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
