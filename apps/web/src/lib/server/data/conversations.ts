import { cache } from "react";
import type { Appointment, Business, Conversation, Message, Payment } from "@flowdesk/firebase/client";
import { requireServerSession } from "@/lib/server/auth";
import { getBusinessForUser } from "@/lib/server/services/businesses";
import {
  getConversationForUser,
  listConversationsForUser,
} from "@/lib/server/services/conversations";

export type ConversationDetail = Conversation & {
  messages: Message[];
  appointments: Appointment[];
  payments: Payment[];
};

export type ConversationsPageData = {
  businessId: string;
  business: Business;
  list: { conversations: Conversation[]; total: number };
  selected: ConversationDetail | null;
  selectedError: boolean;
};

export async function loadConversationsData(
  uid: string,
  businessId: string,
  selectedId?: string,
): Promise<ConversationsPageData> {
  const [business, list] = await Promise.all([
    getBusinessForUser(uid, businessId),
    listConversationsForUser(uid, businessId, { page: 1 }),
  ]);

  if (!selectedId) {
    return { businessId, business, list, selected: null, selectedError: false };
  }

  try {
    const selected = await getConversationForUser(uid, businessId, selectedId);
    return { businessId, business, list, selected, selectedError: false };
  } catch (err) {
    console.error("[conversations] detail prefetch failed:", err);
    return { businessId, business, list, selected: null, selectedError: true };
  }
}

export const getCachedConversationsData = cache(
  async (businessId: string, selectedId?: string): Promise<ConversationsPageData> => {
    const uid = await requireServerSession();
    return loadConversationsData(uid, businessId, selectedId);
  },
);
