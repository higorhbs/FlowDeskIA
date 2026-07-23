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

export async function acceptLgpd(
  uid: string,
  policyVersion: string,
  identity?: { email?: string | null; name?: string | null },
): Promise<Tenant> {
  const version = policyVersion.trim();
  if (!version) throw new ApiError("Versão da política obrigatória.", 400);

  const acceptedAt = new Date().toISOString();
  const ref = getDb().collection("tenants").doc(uid);

  try {
    let existing = await getTenant(uid);
    if (!existing) {
      const email = identity?.email?.trim();
      if (!email) {
        throw new ApiError("Conta não encontrada. Faça login novamente.", 404);
      }
      existing = await createTenant(uid, {
        name: identity?.name?.trim() || email.split("@")[0] || "Usuário",
        email,
      });
    }

    await ref.set(
      {
        lgpdAcceptedAt: acceptedAt,
        lgpdPolicyVersion: version,
        updatedAt: acceptedAt,
      },
      { merge: true },
    );

    await ref.collection("privacy_audit").add({
      type: "CONSENT_ACCEPTED",
      policyVersion: version,
      acceptedAt,
    });

    return {
      ...existing,
      lgpdAcceptedAt: acceptedAt,
      lgpdPolicyVersion: version,
      updatedAt: acceptedAt,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[lgpd] accept failed:", err);
    throw new ApiError(
      err instanceof Error ? err.message : "Não foi possível salvar o aceite LGPD.",
      500,
    );
  }
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
