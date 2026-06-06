import { apiFetch } from "./client";

export async function getAnalytics(businessId: string) {
  return apiFetch(`/api/businesses/${encodeURIComponent(businessId)}/analytics`);
}
