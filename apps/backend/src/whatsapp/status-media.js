import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime'])
const MAX_BYTES = 16 * 1024 * 1024

export function statusMediaRoot() {
  const custom = process.env.WA_STATUS_MEDIA_PATH?.trim()
  if (custom) return path.resolve(custom)
  const sessions = process.env.WA_SESSION_PATH?.trim()
  if (sessions) return path.join(path.dirname(path.resolve(sessions)), 'status-media')
  return path.resolve('./data/status-media')
}

export function publicStatusMediaUrl(businessId, fileName) {
  const base =
    process.env.WA_API_PUBLIC_URL?.trim()?.replace(/\/$/, '') ||
    `http://localhost:${process.env.PORT?.trim() || '3001'}`
  return `${base}/status-media/${businessId}/${fileName}`
}

export async function saveStatusMedia(businessId, buffer, mimetype) {
  const isImage = IMAGE_TYPES.has(mimetype)
  const isVideo = VIDEO_TYPES.has(mimetype)
  if (!isImage && !isVideo) {
    throw new Error('Use imagem (JPEG, PNG, WebP) ou vídeo MP4.')
  }
  if (buffer.length > MAX_BYTES) throw new Error('Arquivo muito grande (máx. 16 MB).')

  const mediaType = isVideo ? 'video' : 'image'
  const dir = path.join(statusMediaRoot(), businessId)
  fs.mkdirSync(dir, { recursive: true })
  let ext = 'mp4'
  if (mediaType === 'image') {
    if (mimetype === 'image/png') ext = 'png'
    else if (mimetype === 'image/webp') ext = 'webp'
    else ext = 'jpg'
  }
  const fileName = `${randomUUID()}.${ext}`
  fs.writeFileSync(path.join(dir, fileName), buffer)
  return { mediaUrl: publicStatusMediaUrl(businessId, fileName), mediaType }
}
