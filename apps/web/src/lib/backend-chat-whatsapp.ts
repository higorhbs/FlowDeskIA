import { authFetch } from "./backend-auth";

export type WhatsAppStatus = {
  connected: boolean;
  status: string;
  qr?: string;
  message?: string;
};

export type WhatsAppConnectResult = {
  status: string;
  qr?: string;
  message?: string;
};

export async function backendGetWhatsAppQr(businessId: string): Promise<WhatsAppStatus> {
  return authFetch(`/chat/whatsapp/qr-code/${businessId}`, { method: "GET" }) as Promise<WhatsAppStatus>;
}

export async function backendPostWhatsAppQr(
  businessId: string,
  force = false,
): Promise<WhatsAppConnectResult> {
  const q = force ? "?force=1" : "";
  return authFetch(`/chat/whatsapp/qr-code/${businessId}${q}`, {
    method: "POST",
    timeoutMs: 50_000,
  }) as Promise<WhatsAppConnectResult>;
}

export async function backendDeleteWhatsAppConnection(
  businessId: string,
): Promise<{ status: string }> {
  return authFetch(`/chat/whatsapp/connection/${businessId}`, {
    method: "DELETE",
  }) as Promise<{ status: string }>;
}

export type WhatsAppChatMessage = {
  id: string;
  role: "CUSTOMER" | "IA" | "HUMAN" | "BOT";
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  createdAt: string;
};

export type WhatsAppSendResult = {
  messageId: string;
  message?: WhatsAppChatMessage;
};

export async function backendSendWhatsAppMessage(
  businessId: string,
  body: { to: string; text: string; conversationId?: string },
): Promise<WhatsAppSendResult> {
  return authFetch(`/chat/whatsapp/messages/${businessId}`, {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<WhatsAppSendResult>;
}

export async function backendSendWhatsAppMedia(
  businessId: string,
  conversationId: string,
  file: File,
  caption?: string,
): Promise<WhatsAppSendResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("conversationId", conversationId);
  if (caption?.trim()) form.append("text", caption.trim());
  return authFetch(`/chat/whatsapp/messages/${businessId}/media`, {
    method: "POST",
    body: form,
    timeoutMs: 120_000,
  }) as Promise<WhatsAppSendResult>;
}
