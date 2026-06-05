import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function resolveUnderBackend(raw, fallback) {
  const rel = raw?.trim() || fallback
  return rel.startsWith('/') ? rel : resolve(backendRoot, rel)
}

export function applyWaPathDefaults() {
  if (!process.env.WA_SESSION_PATH?.trim()) {
    process.env.WA_SESSION_PATH = './data/wa-sessions'
  }
  if (!process.env.WA_CHAT_MEDIA_PATH?.trim()) {
    process.env.WA_CHAT_MEDIA_PATH = './data/chat-media'
  }
  if (!process.env.WA_STATUS_MEDIA_PATH?.trim()) {
    process.env.WA_STATUS_MEDIA_PATH = './data/status-media'
  }
}

const WA_DIR_KEYS = [
  ['WA_SESSION_PATH', './data/wa-sessions'],
  ['WA_CHAT_MEDIA_PATH', './data/chat-media'],
  ['WA_STATUS_MEDIA_PATH', './data/status-media'],
]

export function ensureWaDataDirs() {
  applyWaPathDefaults()
  for (const [key, fallback] of WA_DIR_KEYS) {
    const dir = resolveUnderBackend(process.env[key], fallback)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    process.env[key] = dir
  }
  return process.env.WA_SESSION_PATH
}

export function resolveSessionsRoot() {
  ensureWaDataDirs()
  return process.env.WA_SESSION_PATH
}
