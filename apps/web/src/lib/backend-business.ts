import type { Business, BusinessType } from "@flowdesk/firebase/client";
import { authFetch } from "./backend-auth";

export type CreateBusinessInput = {
  name: string;
  type: BusinessType;
  phone?: string;
  whatsapp?: string;
  description?: string;
  typeLabel?: string;
  address?: string;
  greetingMsg?: string;
  awayMsg?: string;
  workingHours?: Record<string, [string, string] | null>;
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
