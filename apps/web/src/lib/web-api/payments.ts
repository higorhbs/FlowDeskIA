import type { Payment } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

export async function listPayments(businessId: string): Promise<Payment[]> {
  const data = await apiFetch<{ payments: Payment[] }>(
    `/api/businesses/${encodeURIComponent(businessId)}/payments`,
  );
  return data.payments ?? [];
}
