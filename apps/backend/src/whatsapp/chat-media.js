import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime'])
const MAX_BYTES = 16 * 1024 * 1024

export function chatMediaRoot() {
  const custom = process.env.WA_CHAT_MEDIA_PATH?.trim()
  if (custom) return path.resolve(custom)
  const sessions = process.env.WA_SESSION_PATH?.trim()
  if (sessions) return path.join(path.dirname(path.resolve(sessions)), 'chat-media')
  return path.resolve('./data/chat-media')
}

export function publicChatMediaUrl(businessId, fileName) {
  const base =
    process.env.WA_API_PUBLIC_URL?.trim()?.replace(/\/$/, '') ||
    `http://localhost:${process.env.PORT?.trim() || '3001'}`
  return `${base}/chat-media/${businessId}/${fileName}`
}

function validateChatUpload(mimetype, size) {
  if (size > MAX_BYTES) throw new Error('Arquivo muito grande (máx. 16 MB).')
  if (IMAGE_TYPES.has(mimetype)) return 'image'
  if (VIDEO_TYPES.has(mimetype)) return 'video'
  if (mimetype.startsWith('audio/')) return 'audio'
  throw new Error('Use imagem (JPEG, PNG, WebP), vídeo MP4 ou áudio.')
}

function extFor(mimetype, mediaType) {
  if (mediaType === 'image') {
    if (mimetype === 'image/png') return 'png'
    if (mimetype === 'image/webp') return 'webp'
    return 'jpg'
  }
  if (mediaType === 'video') return 'mp4'
  return 'ogg'
}

export async function saveChatMedia(businessId, buffer, mimetype, mediaTypeHint) {
  const mediaType = mediaTypeHint ?? validateChatUpload(mimetype, buffer.length)
  const dir = path.join(chatMediaRoot(), businessId)
  fs.mkdirSync(dir, { recursive: true })
  const fileName = `${randomUUID()}.${extFor(mimetype, mediaType)}`
  fs.writeFileSync(path.join(dir, fileName), buffer)
  return { mediaUrl: publicChatMediaUrl(businessId, fileName), mediaType }
}
