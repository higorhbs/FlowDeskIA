import type { Tenant } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

export async function getTenant(): Promise<Tenant> {
  return apiFetch<Tenant>("/api/tenants/me");
}

export async function syncTenant(name?: string): Promise<Tenant> {
  return apiFetch<Tenant>("/api/tenants/me", {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
}

export async function completeOnboarding(): Promise<Tenant> {
  return apiFetch<Tenant>("/api/tenants/onboarding", { method: "POST" });
}

export async function acceptLgpd(policyVersion: string): Promise<Tenant> {
  return apiFetch<Tenant>("/api/tenants/lgpd", {
    method: "POST",
    body: JSON.stringify({ policyVersion }),
  });
}

export async function submitCancellationFeedback(data: {
  rating: number;
  text?: string;
}): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/tenants/cancellation-feedback", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getStoriesPublished(): Promise<number> {
  const data = await apiFetch<{ storiesPublished: number }>(
    "/api/tenants/stories-published",
  );
  return data.storiesPublished;
}
