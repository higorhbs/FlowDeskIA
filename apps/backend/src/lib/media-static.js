import fs from 'fs'
import path from 'path'
import { chatMediaRoot } from '../whatsapp/chat-media.js'
import { statusMediaRoot } from '../whatsapp/status-media.js'

const CHAT_MIME = {
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const STATUS_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
}

function safeJoin(root, businessId, file) {
  const base = path.resolve(root)
  const target = path.resolve(base, businessId, file)
  if (!target.startsWith(base + path.sep)) return null
  return target
}

export function registerMediaStatic(app) {
  fs.mkdirSync(chatMediaRoot(), { recursive: true })
  fs.mkdirSync(statusMediaRoot(), { recursive: true })

  app.get('/chat-media/:businessId/:file', (c) => {
    const fp = safeJoin(chatMediaRoot(), c.req.param('businessId'), c.req.param('file'))
    if (!fp || !fs.existsSync(fp)) return c.notFound()
    const ext = path.extname(fp).toLowerCase()
    const type = CHAT_MIME[ext] ?? 'application/octet-stream'
    return c.body(fs.readFileSync(fp), 200, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    })
  })

  app.get('/status-media/:businessId/:file', (c) => {
    const fp = safeJoin(statusMediaRoot(), c.req.param('businessId'), c.req.param('file'))
    if (!fp || !fs.existsSync(fp)) return c.notFound()
    const ext = path.extname(fp).toLowerCase()
    const type = STATUS_MIME[ext] ?? 'application/octet-stream'
    return c.body(fs.readFileSync(fp), 200, {
      'Content-Type': type,
      'Access-Control-Allow-Origin': '*',
    })
  })
}
