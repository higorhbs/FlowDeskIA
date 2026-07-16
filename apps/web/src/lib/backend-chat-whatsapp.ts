import { authFetch } from "./backend-auth";
import { getBackendBaseUrl } from "./backend-url";
import type { Message } from "@flowdesk/firebase/client";

const waBase = () => ({ baseUrl: getBackendBaseUrl() });

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
  return authFetch(`/chat/whatsapp/qr-code/${businessId}`, { method: "GET", ...waBase() }) as Promise<WhatsAppStatus>;
}

export async function backendPostWhatsAppQr(
  businessId: string,
  force = false,
): Promise<WhatsAppConnectResult> {
  const q = force ? "?force=1" : "";
  return authFetch(`/chat/whatsapp/qr-code/${businessId}${q}`, {
    method: "POST",
    timeoutMs: 50_000,
    ...waBase(),
  }) as Promise<WhatsAppConnectResult>;
}

export async function backendDeleteWhatsAppConnection(
  businessId: string,
): Promise<{ status: string }> {
  return authFetch(`/chat/whatsapp/connection/${businessId}`, {
    method: "DELETE",
    ...waBase(),
  }) as Promise<{ status: string }>;
}

export type WhatsAppSendResult = {
  messageId: string;
  message?: Message;
};

export async function backendSendWhatsAppMessage(
  businessId: string,
  body: { to: string; text: string; conversationId?: string },
): Promise<WhatsAppSendResult> {
  return authFetch(`/chat/whatsapp/messages/${businessId}`, {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 35_000,
    ...waBase(),
  }) as Promise<WhatsAppSendResult>;
}

export async function backendSendWhatsAppReport(
  businessId: string,
  period: "day" | "week" | "month",
): Promise<{ messageId?: string; count: number }> {
  return authFetch(`/chat/whatsapp/report/${businessId}`, {
    method: "POST",
    body: JSON.stringify({ period }),
    timeoutMs: 60_000,
    ...waBase(),
  }) as Promise<{ messageId?: string; count: number }>;
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
    ...waBase(),
  }) as Promise<WhatsAppSendResult>;
}
