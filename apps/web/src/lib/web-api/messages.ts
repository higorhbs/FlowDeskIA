import type { Message } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

export type SendMessageResult = {
  messageId: string;
  message?: Message;
};

function base(businessId: string, conversationId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/conversations/${encodeURIComponent(conversationId)}/messages`;
}

export async function sendMessage(
  businessId: string,
  conversationId: string,
  body: { to: string; text: string },
): Promise<SendMessageResult> {
  return apiFetch(base(businessId, conversationId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sendMedia(
  businessId: string,
  conversationId: string,
  file: File,
  caption?: string,
): Promise<SendMessageResult> {
  const form = new FormData();
  form.append("file", file);
  if (caption?.trim()) form.append("text", caption.trim());
  return apiFetch(base(businessId, conversationId), {
    method: "POST",
    body: form,
  });
}
