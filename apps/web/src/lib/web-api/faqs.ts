import type { FAQ } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

function base(businessId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/faqs`;
}

export async function listFaqs(businessId: string): Promise<FAQ[]> {
  const data = await apiFetch<{ faqs: FAQ[] }>(base(businessId));
  return data.faqs ?? [];
}

export async function createFaq(
  businessId: string,
  data: Omit<FAQ, "id" | "businessId" | "createdAt">,
): Promise<FAQ> {
  return apiFetch<FAQ>(base(businessId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFaq(
  businessId: string,
  faqId: string,
  data: Partial<Omit<FAQ, "id" | "businessId" | "createdAt">>,
): Promise<void> {
  await apiFetch<{ ok: true }>(`${base(businessId)}/${encodeURIComponent(faqId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteFaq(businessId: string, faqId: string): Promise<void> {
  await apiFetch<{ ok: true }>(`${base(businessId)}/${encodeURIComponent(faqId)}`, {
    method: "DELETE",
  });
}
