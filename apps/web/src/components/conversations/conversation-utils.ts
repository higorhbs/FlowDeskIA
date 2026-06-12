const MEDIA_PLACEHOLDERS = new Set(["[imagem]", "[video]", "[audio]", "[documento]", "[sticker]"]);

export function shouldShowMessageText(content: string, hasMedia: boolean) {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (hasMedia && MEDIA_PLACEHOLDERS.has(trimmed)) return false;
  return true;
}

export function isMediaPlaceholderOnly(content: string) {
  return MEDIA_PLACEHOLDERS.has(content.trim());
}

export function buildManualMessage(raw: string, attendantName?: string, enabled = true) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!enabled) return trimmed;
  const prefixName = attendantName?.trim();
  if (!prefixName) return trimmed;
  const alreadyPrefixed =
    trimmed.startsWith(`${prefixName}:\n`) || trimmed.startsWith(`${prefixName}: `);
  if (alreadyPrefixed) return trimmed;
  return `${prefixName}:\n${trimmed}`;
}

export function sendDest(conv: { replyJid?: string; customerPhone: string }) {
  return conv.replyJid?.trim() || conv.customerPhone;
}
