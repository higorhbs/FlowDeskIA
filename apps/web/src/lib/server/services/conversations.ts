import { getDb, upsertConversation } from "@flowdesk/firebase";
import {
  getConversation,
  listConversations,
  updateConversationStatus,
} from "@flowdesk/firebase";
import type { ConversationStatus } from "@flowdesk/firebase/client";
import { phoneDigits } from "@flowdesk/shared";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

function normalizeCustomerPhone(raw: unknown): string {
  const digits = phoneDigits(String(raw ?? "").trim());
  if (digits.length < 10 || digits.length > 15) {
    throw new ApiError("Número inválido. Use DDI + DDD + número (ex: 5511999999999).", 400);
  }
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export async function listConversationsForUser(
  uid: string,
  businessId: string,
  opts?: { status?: ConversationStatus; page?: number },
) {
  await assertBusinessOwned(uid, businessId);
  return listConversations(businessId, opts);
}

export async function getConversationForUser(
  uid: string,
  businessId: string,
  conversationId: string,
) {
  await assertBusinessOwned(uid, businessId);
  const conversation = await getConversation(businessId, conversationId);
  if (!conversation) throw new ApiError("Conversa não encontrada.", 404);
  return conversation;
}

export async function updateConversationStatusForUser(
  uid: string,
  businessId: string,
  conversationId: string,
  status: ConversationStatus,
) {
  await assertBusinessOwned(uid, businessId);
  const updated = await updateConversationStatus(businessId, conversationId, status);
  if (!updated) throw new ApiError("Conversa não encontrada.", 404);
  return updated;
}

export async function createConversationForUser(
  uid: string,
  businessId: string,
  phone: unknown,
) {
  await assertBusinessOwned(uid, businessId);
  const customerPhone = normalizeCustomerPhone(phone);
  return upsertConversation(businessId, customerPhone);
}

export async function deleteConversationForUser(
  uid: string,
  businessId: string,
  conversationId: string,
) {
  await assertBusinessOwned(uid, businessId);
  const db = getDb();
  const convRef = db
    .collection("businesses")
    .doc(businessId)
    .collection("conversations")
    .doc(conversationId);
  const snap = await convRef.get();
  if (!snap.exists) throw new ApiError("Conversa não encontrada.", 404);

  const msgsSnap = await convRef.collection("messages").get();
  const chunk = 400;
  for (let i = 0; i < msgsSnap.docs.length; i += chunk) {
    const batch = db.batch();
    for (const doc of msgsSnap.docs.slice(i, i + chunk)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
  await convRef.delete();
}
