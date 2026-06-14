import { randomUUID } from "crypto";
import { getStorageBucket } from "./admin.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_BYTES = 16 * 1024 * 1024;

export type BusinessMediaType = "image" | "video" | "audio" | "gif";

export type BusinessMediaKind = "chat" | "status" | "flow";

function extFor(mimetype: string, mediaType: BusinessMediaType): string {
  if (mediaType === "gif") return "gif";
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
  if (ext === "gif") return "image/gif";
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

export async function getBusinessMediaReadUrl(
  mediaUrl?: string,
  mediaStoragePath?: string,
): Promise<string | null> {
  const storagePath =
    mediaStoragePath?.trim() || (mediaUrl ? parseFirebaseStoragePath(mediaUrl) : null);
  if (!storagePath) return mediaUrl?.trim() || null;
  try {
    const bucket = getStorageBucket();
    const [signed] = await bucket.file(storagePath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });
    return signed;
  } catch {
    return mediaUrl?.trim() || null;
  }
}

export async function uploadBusinessMedia(
  businessId: string,
  kind: BusinessMediaKind,
  buffer: Buffer,
  mimetype: string,
  mediaTypeHint?: BusinessMediaType
) {
  if (buffer.length > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 16 MB).");

  let mediaType: BusinessMediaType;
  if (mediaTypeHint) {
    mediaType = mediaTypeHint;
  } else if (mimetype === "image/gif") {
    mediaType = "gif";
  } else if (IMAGE_TYPES.has(mimetype)) {
    mediaType = "image";
  } else if (VIDEO_TYPES.has(mimetype)) {
    mediaType = "video";
  } else if (mimetype.startsWith("audio/")) {
    mediaType = "audio";
  } else {
    throw new Error("Use imagem (JPEG, PNG, WebP, GIF), vídeo MP4 ou áudio.");
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

export async function resolveBusinessMediaBuffer(
  mediaUrl?: string,
  mediaStoragePath?: string,
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  const fromAdmin = await downloadBusinessMedia(mediaUrl, mediaStoragePath);
  if (fromAdmin?.buffer?.length) return fromAdmin;

  const path = mediaUrl ? parseFirebaseStoragePath(mediaUrl) : null;
  if (path && path !== mediaStoragePath?.trim()) {
    const retry = await downloadBusinessMedia(mediaUrl, path);
    if (retry?.buffer?.length) return retry;
  }

  if (!mediaUrl?.trim()) return null;

  const fetchUrlBuffer = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(url, { redirect: "follow", signal: controller.signal });
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) return null;
      const hint = `${url} ${mediaStoragePath ?? ""}`.toLowerCase();
      const header = res.headers.get("content-type")?.split(";")[0]?.trim();
      let mimetype = "application/octet-stream";
      if (hint.includes(".gif")) mimetype = "image/gif";
      else if (hint.includes(".mp4") || hint.includes(".mov")) mimetype = "video/mp4";
      else if (hint.includes(".png")) mimetype = "image/png";
      else if (hint.includes(".webp")) mimetype = "image/webp";
      else if (header?.startsWith("image/") || header?.startsWith("video/")) mimetype = header;
      else if (header) mimetype = header;
      return { buffer, mimetype };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const direct = await fetchUrlBuffer(mediaUrl);
  if (direct) return direct;

  const signed = await getBusinessMediaReadUrl(mediaUrl, mediaStoragePath);
  if (signed && signed !== mediaUrl) return fetchUrlBuffer(signed);

  return null;
}
