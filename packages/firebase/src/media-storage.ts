import { randomUUID } from "crypto";
import { getStorageBucket } from "./admin.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_BYTES = 16 * 1024 * 1024;

export type BusinessMediaKind = "chat";

function extFor(mimetype: string, mediaType: "image" | "video" | "audio"): string {
  if (mediaType === "image") {
    if (mimetype === "image/png") return "png";
    if (mimetype === "image/webp") return "webp";
    return "jpg";
  }
  if (mediaType === "video") return "mp4";
  return "ogg";
}

function storagePathFor(businessId: string, kind: BusinessMediaKind, fileName: string) {
  return `businesses/${businessId}/media/${kind}/${fileName}`;
}

function publicMediaUrl(bucketName: string, storagePath: string) {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${bucketName}/${encoded}`;
}

function mimetypeFromPath(storagePath: string): string {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4" || ext === "mov") return "video/mp4";
  if (ext === "ogg") return "audio/ogg";
  return "image/jpeg";
}

export function parseFirebaseStoragePath(mediaUrl: string): string | null {
  try {
    const u = new URL(mediaUrl);
    if (u.hostname === "storage.googleapis.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      return parts.slice(1).map(decodeURIComponent).join("/");
    }
    if (u.hostname === "firebasestorage.googleapis.com") {
      const m = u.pathname.match(/\/o\/(.+)$/);
      if (!m?.[1]) return null;
      return decodeURIComponent(m[1].split("?")[0] ?? "");
    }
  } catch {
    return null;
  }
  return null;
}

export async function uploadBusinessMedia(
  businessId: string,
  kind: BusinessMediaKind,
  buffer: Buffer,
  mimetype: string,
  mediaTypeHint?: "image" | "video" | "audio"
) {
  if (buffer.length > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 16 MB).");

  let mediaType: "image" | "video" | "audio";
  if (mediaTypeHint) {
    mediaType = mediaTypeHint;
  } else if (IMAGE_TYPES.has(mimetype)) {
    mediaType = "image";
  } else if (VIDEO_TYPES.has(mimetype)) {
    mediaType = "video";
  } else if (mimetype.startsWith("audio/")) {
    mediaType = "audio";
  } else {
    throw new Error("Use imagem (JPEG, PNG, WebP), vídeo MP4 ou áudio.");
  }

  const fileName = `${randomUUID()}.${extFor(mimetype, mediaType)}`;
  const storagePath = storagePathFor(businessId, kind, fileName);
  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);
  await file.save(buffer, { metadata: { contentType: mimetype }, resumable: false });
  await file.makePublic().catch(() => undefined);

  return {
    mediaUrl: publicMediaUrl(bucket.name, storagePath),
    mediaStoragePath: storagePath,
    mediaType,
  };
}

export async function downloadBusinessMedia(
  mediaUrl?: string,
  mediaStoragePath?: string
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  const storagePath =
    mediaStoragePath?.trim() || (mediaUrl ? parseFirebaseStoragePath(mediaUrl) : null);
  if (!storagePath) return null;

  try {
    const bucket = getStorageBucket();
    const [buffer] = await bucket.file(storagePath).download();
    if (!buffer?.length) return null;
    return { buffer, mimetype: mimetypeFromPath(storagePath) };
  } catch {
    return null;
  }
}
