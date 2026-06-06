import type { Conversation, ConversationStatus } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

function base(businessId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/conversations`;
}

export async function listConversations(
  businessId: string,
  params?: { status?: ConversationStatus; page?: number },
): Promise<{ conversations: Conversation[]; total: number }> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  const q = search.toString();
  return apiFetch(`${base(businessId)}${q ? `?${q}` : ""}`);
}

export async function getConversation(businessId: string, conversationId: string) {
  return apiFetch(`${base(businessId)}/${encodeURIComponent(conversationId)}`);
}

export async function updateConversationStatus(
  businessId: string,
  conversationId: string,
  status: ConversationStatus,
) {
  return apiFetch(`${base(businessId)}/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteConversation(businessId: string, conversationId: string) {
  await apiFetch<{ ok: true }>(`${base(businessId)}/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
}
