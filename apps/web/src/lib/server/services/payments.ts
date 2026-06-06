import { listPayments } from "@flowdesk/firebase";
import { assertBusinessOwned } from "./business-access";

export async function listPaymentsForUser(uid: string, businessId: string) {
  await assertBusinessOwned(uid, businessId);
  return listPayments(businessId);
}
