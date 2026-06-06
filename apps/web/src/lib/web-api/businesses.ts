import type { Business } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";
import type { CreateBusinessBody } from "@/lib/server/services/businesses";

export type CreateBusinessInput = CreateBusinessBody;

export async function listBusinesses(): Promise<Business[]> {
  const data = await apiFetch<{ businesses: Business[] }>("/api/businesses");
  return data.businesses ?? [];
}

export async function getBusiness(id: string): Promise<Business> {
  return apiFetch<Business>(`/api/businesses/${encodeURIComponent(id)}`);
}

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  return apiFetch<Business>("/api/businesses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBusiness(
  id: string,
  data: Partial<Business>,
): Promise<Business> {
  return apiFetch<Business>(`/api/businesses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
