import { downloadBusinessMedia, uploadBusinessMedia } from "@flowdesk/firebase";

export async function saveStatusMedia(businessId: string, buffer: Buffer, mimetype: string) {
  const saved = await uploadBusinessMedia(businessId, "status", buffer, mimetype);
  return {
    mediaUrl: saved.mediaUrl,
    mediaStoragePath: saved.mediaStoragePath,
    mediaType: saved.mediaType as "image" | "video",
  };
}

export async function readStatusMediaBuffer(
  mediaUrl: string,
  mediaStoragePath?: string
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  return downloadBusinessMedia(mediaUrl, mediaStoragePath);
}
