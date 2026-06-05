import { uploadBusinessMedia } from '@flowdesk/firebase'

export async function saveChatMedia(businessId, buffer, mimetype, mediaTypeHint) {
  const saved = await uploadBusinessMedia(businessId, 'chat', buffer, mimetype, mediaTypeHint)
  return {
    mediaUrl: saved.mediaUrl,
    mediaStoragePath: saved.mediaStoragePath,
    mediaType: saved.mediaType,
  }
}
