import { cors } from 'hono/cors'
import { env } from '../config/env.js'

function parseOrigins(raw) {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.startsWith('http'))
  )
}

const allowed = parseOrigins(env.corsOrigin)
const webOrigins = parseOrigins(env.webOrigin)

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (env.corsOrigin === '*') return origin
    if (allowed.has(origin) || webOrigins.has(origin)) return origin
    if (
      !env.corsOrigin &&
      (/^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.(web\.app|firebaseapp\.com|vercel\.app)$/.test(origin))
    ) {
      return origin
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
