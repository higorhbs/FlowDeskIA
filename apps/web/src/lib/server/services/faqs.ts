import { createFaq, deleteFaq, listFaqs, updateFaq } from "@flowdesk/firebase";
import type { FAQ } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

export async function listFaqsForUser(uid: string, businessId: string) {
  await assertBusinessOwned(uid, businessId);
  return listFaqs(businessId);
}

export async function createFaqForUser(
  uid: string,
  businessId: string,
  data: Omit<FAQ, "id" | "businessId" | "createdAt">,
) {
  await assertBusinessOwned(uid, businessId);
  return createFaq(businessId, data);
}

export async function updateFaqForUser(
  uid: string,
  businessId: string,
  faqId: string,
  data: Partial<Omit<FAQ, "id" | "businessId" | "createdAt">>,
) {
  await assertBusinessOwned(uid, businessId);
  const updated = await updateFaq(businessId, faqId, data);
  if (!updated) throw new ApiError("FAQ não encontrada.", 404);
  return updated;
}

export async function deleteFaqForUser(uid: string, businessId: string, faqId: string) {
  await assertBusinessOwned(uid, businessId);
  await deleteFaq(businessId, faqId);
}
