import { getBusiness } from "@flowdesk/firebase";
import type { Business } from "@flowdesk/firebase/client";
import { ApiError } from "../api-error";

export async function assertBusinessOwned(
  uid: string,
  businessId: string,
): Promise<Business> {
  const business = await getBusiness(businessId, uid);
  if (!business) throw new ApiError("Negócio não encontrado ou sem acesso.", 404);
  return business;
}
