import { getAnalytics } from "@flowdesk/firebase";
import { assertBusinessOwned } from "./business-access";

export async function getAnalyticsForUser(uid: string, businessId: string) {
  await assertBusinessOwned(uid, businessId);
  return getAnalytics(businessId);
}
