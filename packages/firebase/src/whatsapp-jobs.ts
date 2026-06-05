import { FieldValue } from "firebase-admin/firestore";
import { getDb, newId, nowIso } from "./admin.js";

export type WhatsappJobStatus = "pending" | "processing" | "done" | "failed";

export interface WhatsappInboundPayload {
  customerPhone: string;
  customerName?: string;
  messageBody: string;
  replyJid: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
}

export interface WhatsappJob {
  id: string;
  businessId: string;
  type: "inbound";
  status: WhatsappJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  lockedUntil?: string;
  lockedBy?: string;
  lastError?: string;
  payload: WhatsappInboundPayload;
}

const COLLECTION = "whatsappJobs";
const LEASE_MS = 60_000;
const BASE_BACKOFF_MS = 1_500;

function jobsCol() {
  return getDb().collection(COLLECTION);
}

function parseJob(id: string, data: Record<string, unknown>): WhatsappJob {
  return {
    id,
    businessId: String(data.businessId ?? ""),
    type: "inbound",
    status: data.status as WhatsappJobStatus,
    attempts: Number(data.attempts ?? 0),
    maxAttempts: Number(data.maxAttempts ?? 3),
    nextRunAt: String(data.nextRunAt ?? ""),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    lockedUntil: data.lockedUntil ? String(data.lockedUntil) : undefined,
    lockedBy: data.lockedBy ? String(data.lockedBy) : undefined,
    lastError: data.lastError ? String(data.lastError) : undefined,
    payload: data.payload as WhatsappInboundPayload,
  };
}

function backoffMs(attempts: number): number {
  return BASE_BACKOFF_MS * 2 ** attempts;
}

function isAlreadyExists(err: unknown): boolean {
  const code = (err as { code?: number | string }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

async function releaseStaleJobs(): Promise<void> {
  const now = nowIso();
  const snap = await jobsCol()
    .where("status", "==", "processing")
    .where("lockedUntil", "<", now)
    .limit(20)
    .get();
  if (snap.empty) return;

  const batch = getDb().batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      status: "pending",
      lockedBy: FieldValue.delete(),
      lockedUntil: FieldValue.delete(),
      updatedAt: now,
    });
  }
  await batch.commit();
}

export async function enqueueWhatsappInboundJob(
  businessId: string,
  payload: WhatsappInboundPayload,
  jobId?: string
): Promise<string> {
  const id = jobId?.trim() || newId();
  const ref = jobsCol().doc(id);
  const now = nowIso();

  try {
    await ref.create({
      businessId,
      type: "inbound",
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      nextRunAt: now,
      createdAt: now,
      updatedAt: now,
      payload,
    });
  } catch (err) {
    if (isAlreadyExists(err)) return id;
    throw err;
  }
  return id;
}

export async function claimWhatsappInboundJob(workerId: string): Promise<WhatsappJob | null> {
  await releaseStaleJobs();
  const now = nowIso();
  const snap = await jobsCol()
    .where("status", "==", "pending")
    .where("nextRunAt", "<=", now)
    .orderBy("nextRunAt")
    .limit(5)
    .get();

  for (const doc of snap.docs) {
    const claimed = await getDb().runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists) return null;
      const data = fresh.data() as Record<string, unknown>;
      if (data.status !== "pending") return null;
      if (String(data.nextRunAt ?? "") > now) return null;

      const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
      tx.update(doc.ref, {
        status: "processing",
        lockedBy: workerId,
        lockedUntil: leaseUntil,
        updatedAt: now,
      });
      return parseJob(doc.id, {
        ...data,
        status: "processing",
        lockedBy: workerId,
        lockedUntil: leaseUntil,
      });
    });
    if (claimed) return claimed;
  }
  return null;
}

export async function completeWhatsappJob(jobId: string): Promise<void> {
  await jobsCol().doc(jobId).delete().catch(() => undefined);
}

export async function failWhatsappJob(jobId: string, error: string): Promise<void> {
  const ref = jobsCol().doc(jobId);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() as Record<string, unknown>;
    const attempts = Number(data.attempts ?? 0) + 1;
    const maxAttempts = Number(data.maxAttempts ?? 3);
    const now = nowIso();
    const patch: Record<string, unknown> = {
      attempts,
      lastError: error.slice(0, 500),
      lockedBy: FieldValue.delete(),
      lockedUntil: FieldValue.delete(),
      updatedAt: now,
    };

    if (attempts >= maxAttempts) {
      patch.status = "failed";
    } else {
      patch.status = "pending";
      patch.nextRunAt = new Date(Date.now() + backoffMs(attempts)).toISOString();
    }
    tx.update(ref, patch);
  });
}
