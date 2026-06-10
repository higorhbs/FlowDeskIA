import './load-env.js'

function intEnv(name, fallback) {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const isProduction = process.env.NODE_ENV === 'production'

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  firebaseWebApiKey:
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    '',
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '',
  webOrigin: process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL?.trim() || (isProduction ? 'warn' : 'info'),
  waLogLevel: process.env.WA_LOG_LEVEL?.trim() || (isProduction ? 'error' : 'warn'),
  waWorkerConcurrency: intEnv('WA_WORKER_CONCURRENCY', 2),
  waWorkerPollMs: intEnv('WA_WORKER_POLL_MS', 1500),
  waRestoreStaggerMs: intEnv('WA_RESTORE_STAGGER_MS', 3000),
}
