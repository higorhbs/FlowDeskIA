import {
  createTenant,
  getDb,
  getTenant,
  getTenantStoriesPublished,
  nowIso,
  updateTenant,
} from "@flowdesk/firebase";
import type { Tenant } from "@flowdesk/firebase/client";
import { ApiError } from "../api-error";

export async function getTenantForUser(uid: string): Promise<Tenant | null> {
  return getTenant(uid);
}

export async function syncTenant(
  uid: string,
  data: { name?: string; email: string },
): Promise<Tenant> {
  const existing = await getTenant(uid);
  if (existing) return existing;

  const displayName = data.name?.trim() || data.email.split("@")[0] || "Usuário";
  return createTenant(uid, { name: displayName, email: data.email });
}

export async function completeOnboarding(uid: string): Promise<Tenant> {
  const tenant = await updateTenant(uid, {
    onboardingCompletedAt: new Date().toISOString(),
  });
  if (!tenant) throw new ApiError("Conta não encontrada", 404);
  return tenant;
}

export async function acceptLgpd(uid: string, policyVersion: string): Promise<Tenant> {
  const version = policyVersion.trim();
  if (!version) throw new ApiError("Versão da política obrigatória.", 400);

  const existing = await getTenant(uid);
  const acceptedAt = new Date().toISOString();
  const patch = {
    lgpdAcceptedAt: acceptedAt,
    lgpdPolicyVersion: version,
    updatedAt: acceptedAt,
  };

  if (existing) {
    const updated = await updateTenant(uid, patch);
    if (!updated) throw new ApiError("Conta não encontrada", 404);
    return updated;
  }

  throw new ApiError("Conta não encontrada", 404);
}

export async function submitCancellationFeedback(
  uid: string,
  data: { rating: number; text?: string },
): Promise<{ ok: true }> {
  const tenant = await getTenant(uid);
  if (!tenant) throw new ApiError("Conta não encontrada", 404);

  const rating = Math.max(1, Math.min(5, Math.round(data.rating)));
  await getDb()
    .collection("tenantCancellationFeedback")
    .add({
      tenantId: uid,
      rating,
      text: data.text?.trim() || null,
      createdAt: nowIso(),
    });

  return { ok: true };
}

export async function getStoriesPublished(uid: string): Promise<number> {
  return getTenantStoriesPublished(uid);
}
