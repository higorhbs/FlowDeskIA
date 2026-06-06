import { cache } from "react";
import type { Business } from "@flowdesk/firebase/client";
import { getBusinessForUser, getPrimaryBusiness } from "@/lib/server/services/businesses";
import { listConversationsForUser } from "@/lib/server/services/conversations";

export const loadSidebarBusiness = cache(
  async (uid: string, businessId: string): Promise<Business> => {
    return getBusinessForUser(uid, businessId);
  },
);

export const loadSidebarOpenConversationsCount = cache(
  async (uid: string, businessId: string): Promise<number> => {
    const { total } = await listConversationsForUser(uid, businessId, { status: "OPEN" });
    return total;
  },
);

export const loadSidebarContext = cache(async (uid: string) => {
  const business = await getPrimaryBusiness(uid);
  return { business };
});
