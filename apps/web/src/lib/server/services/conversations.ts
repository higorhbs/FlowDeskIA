import { getDb } from "@flowdesk/firebase";
import {
  getConversation,
  listConversations,
  updateConversationStatus,
} from "@flowdesk/firebase";
import type { ConversationStatus } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

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
