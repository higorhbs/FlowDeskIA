import { addDoc, collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { Tenant } from "./types.js";
import { getClientDb } from "./client.js";

function nowIso() {
  return new Date().toISOString();
}

export async function ensureClientTenant(
  id: string,
  data: { name: string; email: string }
): Promise<Tenant> {
  const ref = doc(getClientDb(), "tenants", id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Tenant;
  }
  const ts = nowIso();
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);
  const tenant: Tenant = {
    id,
    name: data.name,
    email: data.email,
    plan: "STARTER",
    planStatus: "TRIALING",
    trialEndsAt: trialEnds.toISOString(),
    createdAt: ts,
    updatedAt: ts,
  };
  await setDoc(ref, tenant);
  return tenant;
}

export async function getClientTenant(id: string): Promise<Tenant | null> {
  const snap = await getDoc(doc(getClientDb(), "tenants", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Tenant) : null;
}

export async function updateClientTenantProfile(
  id: string,
  data: { name?: string; email?: string }
): Promise<Tenant> {
  const ref = doc(getClientDb(), "tenants", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Conta não encontrada");
  const current = { id: snap.id, ...snap.data() } as Tenant;
  const patch = { ...data, updatedAt: nowIso() };
  await updateDoc(ref, patch);
  return { ...current, ...patch };
}

export async function completeClientOnboarding(id: string): Promise<Tenant> {
  const ref = doc(getClientDb(), "tenants", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Conta não encontrada");
  const current = { id: snap.id, ...snap.data() } as Tenant;
  const patch = { onboardingCompletedAt: nowIso(), updatedAt: nowIso() };
  await updateDoc(ref, patch);
  return { ...current, ...patch };
}

export async function acceptClientLgpd(
  id: string,
  policyVersion: string
): Promise<Tenant> {
  const ref = doc(getClientDb(), "tenants", id);
  const snap = await getDoc(ref);
  const current = { id: snap.id, ...snap.data() } as Tenant;
  const patch = {
    lgpdAcceptedAt: nowIso(),
    lgpdPolicyVersion: policyVersion,
    updatedAt: nowIso(),
  };
  await setDoc(ref, patch, { merge: true });
  return snap.exists() ? { ...current, ...patch } : ({ id, ...patch } as Tenant);
}

export async function submitClientCancellationFeedback(
  id: string,
  data: { rating: number; text?: string }
): Promise<{ ok: true }> {
  const tenantRef = doc(getClientDb(), "tenants", id);
  const tenantSnap = await getDoc(tenantRef);
  if (!tenantSnap.exists()) throw new Error("Conta não encontrada");
  const rating = Math.max(1, Math.min(5, Math.round(data.rating)));
  await addDoc(collection(getClientDb(), "tenantCancellationFeedback"), {
    tenantId: id,
    rating,
    text: data.text?.trim() || null,
    createdAt: nowIso(),
  });
  return { ok: true };
}
