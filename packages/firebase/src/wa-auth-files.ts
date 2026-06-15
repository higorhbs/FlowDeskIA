import { getDb, getStorageBucket, nowIso } from "./admin.js";

function waAuthFilesCol(businessId: string) {
  return getDb().collection("businesses").doc(businessId).collection("whatsappAuthFiles");
}

function waAuthFileRef(businessId: string, fileName: string) {
  return waAuthFilesCol(businessId).doc(sanitizeWaAuthFileName(fileName));
}

function businessRef(businessId: string) {
  return getDb().collection("businesses").doc(businessId);
}

function waAuthStoragePath(businessId: string, fileName: string) {
  return `wa-auth/${businessId}/${sanitizeWaAuthFileName(fileName)}`;
}

export function sanitizeWaAuthFileName(file: string): string {
  return file.replace(/\//g, "__").replace(/:/g, "-");
}

async function setWaAuthMarker(businessId: string, stored: boolean): Promise<void> {
  const ref = businessRef(businessId);
  if (stored) {
    await ref.set({ waAuthStored: true, updatedAt: nowIso() }, { merge: true });
    return;
  }
  await ref.set({ waAuthStored: false, updatedAt: nowIso() }, { merge: true });
}

async function readLegacyWhatsAppAuthFile(
  businessId: string,
  fileName: string,
): Promise<string | null> {
  const snap = await waAuthFileRef(businessId, fileName).get();
  if (!snap.exists) return null;
  const payload = snap.data()?.payload;
  return typeof payload === "string" ? payload : null;
}

async function migrateLegacyWhatsAppAuthFile(
  businessId: string,
  fileName: string,
  payload: string,
): Promise<void> {
  const bucket = getStorageBucket();
  const storagePath = waAuthStoragePath(businessId, fileName);
  await bucket.file(storagePath).save(payload, {
    metadata: { contentType: "application/json" },
    resumable: false,
  });
  await waAuthFileRef(businessId, fileName).delete().catch(() => undefined);
  if (sanitizeWaAuthFileName(fileName) === sanitizeWaAuthFileName("creds.json")) {
    await setWaAuthMarker(businessId, true);
  }
}

export async function readWhatsAppAuthFile(
  businessId: string,
  fileName: string
): Promise<string | null> {
  const bucket = getStorageBucket();
  const storagePath = waAuthStoragePath(businessId, fileName);
  try {
    const [buf] = await bucket.file(storagePath).download();
    const payload = buf.toString("utf8");
    if (payload) return payload;
  } catch {
    /* try legacy */
  }

  const legacy = await readLegacyWhatsAppAuthFile(businessId, fileName);
  if (!legacy) return null;
  await migrateLegacyWhatsAppAuthFile(businessId, fileName, legacy).catch(() => undefined);
  return legacy;
}

export async function writeWhatsAppAuthFile(
  businessId: string,
  fileName: string,
  payload: string
): Promise<void> {
  const bucket = getStorageBucket();
  const storagePath = waAuthStoragePath(businessId, fileName);
  await bucket.file(storagePath).save(payload, {
    metadata: { contentType: "application/json" },
    resumable: false,
  });
  await waAuthFileRef(businessId, fileName).delete().catch(() => undefined);
  if (sanitizeWaAuthFileName(fileName) === sanitizeWaAuthFileName("creds.json")) {
    await setWaAuthMarker(businessId, true);
  }
}

export async function removeWhatsAppAuthFile(
  businessId: string,
  fileName: string
): Promise<void> {
  const bucket = getStorageBucket();
  await bucket.file(waAuthStoragePath(businessId, fileName)).delete().catch(() => undefined);
  await waAuthFileRef(businessId, fileName).delete().catch(() => undefined);
}

export async function hasWhatsAppAuth(businessId: string): Promise<boolean> {
  const businessSnap = await businessRef(businessId).get();
  if (businessSnap.data()?.waAuthStored === true) return true;

  try {
    const [exists] = await getStorageBucket()
      .file(waAuthStoragePath(businessId, "creds.json"))
      .exists();
    if (exists) {
      await setWaAuthMarker(businessId, true).catch(() => undefined);
      return true;
    }
  } catch {
    /* ignore */
  }

  const legacy = await waAuthFileRef(businessId, "creds.json").get();
  return legacy.exists;
}

export async function listBusinessIdsWithWhatsAppAuth(): Promise<string[]> {
  const marked = await getDb().collection("businesses").where("waAuthStored", "==", true).get();
  if (!marked.empty) return marked.docs.map((d) => d.id);

  const legacy = await getDb().collectionGroup("whatsappAuthFiles").get();
  const ids = new Set<string>();
  for (const doc of legacy.docs) {
    if (doc.id !== sanitizeWaAuthFileName("creds.json")) continue;
    const businessId = doc.ref.parent.parent?.id;
    if (businessId) ids.add(businessId);
  }
  return [...ids];
}

export async function clearWhatsAppAuth(businessId: string): Promise<void> {
  const bucket = getStorageBucket();
  const [files] = await bucket.getFiles({ prefix: `wa-auth/${businessId}/` });
  await Promise.all(files.map((f) => f.delete().catch(() => undefined)));

  const snap = await waAuthFilesCol(businessId).get();
  if (!snap.empty) {
    const batch = getDb().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  }

  await setWaAuthMarker(businessId, false).catch(() => undefined);
}

export async function purgeLegacyWhatsAppAuthFirestore(): Promise<number> {
  const snap = await getDb().collectionGroup("whatsappAuthFiles").limit(500).get();
  if (snap.empty) return 0;

  let migrated = 0;
  for (const doc of snap.docs) {
    const businessId = doc.ref.parent.parent?.id;
    if (!businessId) continue;
    const payload = doc.data()?.payload;
    if (typeof payload !== "string" || !payload) {
      await doc.ref.delete().catch(() => undefined);
      continue;
    }
    const fileName = doc.id.replace(/__/g, "/").replace(/-/g, ":");
    await migrateLegacyWhatsAppAuthFile(businessId, fileName, payload).catch(() => undefined);
    migrated += 1;
  }
  return migrated;
}
