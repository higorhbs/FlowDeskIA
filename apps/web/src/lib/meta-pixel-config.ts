export const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

export function hasMetaPixel() {
  return Boolean(metaPixelId);
}
