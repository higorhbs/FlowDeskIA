import { getDb, nowIso } from "./admin.js";

function waAuthFilesCol(businessId: string) {
  return getDb().collection("businesses").doc(businessId).collection("whatsappAuthFiles");
}

function waAuthFileRef(businessId: string, fileName: string) {
  return waAuthFilesCol(businessId).doc(sanitizeWaAuthFileName(fileName));
}

export function sanitizeWaAuthFileName(file: string): string {
  return file.replace(/\//g, "__").replace(/:/g, "-");
}

export async function readWhatsAppAuthFile(
  businessId: string,
  fileName: string
): Promise<string | null> {
  const snap = await waAuthFileRef(businessId, fileName).get();
  if (!snap.exists) return null;
  const payload = snap.data()?.payload;
  return typeof payload === "string" ? payload : null;
}

export async function writeWhatsAppAuthFile(
  businessId: string,
  fileName: string,
  payload: string
): Promise<void> {
  await waAuthFileRef(businessId, fileName).set({ payload, updatedAt: nowIso() });
}

export async function removeWhatsAppAuthFile(
  businessId: string,
  fileName: string
): Promise<void> {
  await waAuthFileRef(businessId, fileName).delete().catch(() => undefined);
}

export async function hasWhatsAppAuth(businessId: string): Promise<boolean> {
  const snap = await waAuthFileRef(businessId, "creds.json").get();
  return snap.exists;
}

export async function listBusinessIdsWithWhatsAppAuth(): Promise<string[]> {
  const snap = await getDb().collectionGroup("whatsappAuthFiles").get();
  const ids = new Set<string>();
  for (const doc of snap.docs) {
    if (doc.id !== sanitizeWaAuthFileName("creds.json")) continue;
    const businessId = doc.ref.parent.parent?.id;
    if (businessId) ids.add(businessId);
  }
  return [...ids];
}

export async function clearWhatsAppAuth(businessId: string): Promise<void> {
  const snap = await waAuthFilesCol(businessId).get();
  if (snap.empty) return;
  const batch = getDb().batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
}
