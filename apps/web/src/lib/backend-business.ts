import type { Business, BusinessType } from "@flowdesk/firebase/client";
import { authFetch } from "./backend-auth";

export type CreateBusinessInput = {
  name: string;
  type: BusinessType;
  whatsapp: string;
  description?: string;
};

export async function backendListBusinesses(): Promise<Business[]> {
  const data = (await authFetch("/businesses", { method: "GET" })) as { businesses: Business[] };
  return data.businesses ?? [];
}

export async function backendCreateBusiness(input: CreateBusinessInput): Promise<Business> {
  return authFetch("/business", {
    method: "POST",
    body: JSON.stringify(input),
  }) as Promise<Business>;
}
