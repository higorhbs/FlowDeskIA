import { getDb, newId, nowIso } from "./admin.js";

export type PrintJobStatus = "pending" | "done" | "error";

export interface PrintJob {
  id: string;
  status: PrintJobStatus;
  payloadBase64: string;
  printerName?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

function printJobsCol(businessId: string) {
  return getDb().collection("businesses").doc(businessId).collection("printJobs");
}

function parseJob(id: string, data: Record<string, unknown>): PrintJob {
  const job: PrintJob = {
    id,
    status: (data.status as PrintJobStatus) ?? "pending",
    payloadBase64: String(data.payloadBase64 ?? ""),
    createdAt: String(data.createdAt ?? ""),
  };
  if (data.printerName) job.printerName = String(data.printerName);
  if (data.completedAt) job.completedAt = String(data.completedAt);
  if (data.error) job.error = String(data.error);
  return job;
}

export async function createPrintJob(
  businessId: string,
  payloadBase64: string,
  printerName?: string,
): Promise<string> {
  const id = newId();
  const now = nowIso();
  const data: Record<string, unknown> = { status: "pending", payloadBase64, createdAt: now };
  if (printerName) data.printerName = printerName;
  await printJobsCol(businessId).doc(id).set(data);
  return id;
}

export async function listPendingPrintJobs(businessId: string, limit = 10): Promise<PrintJob[]> {
  const snap = await printJobsCol(businessId)
    .where("status", "==", "pending")
    .orderBy("createdAt")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => parseJob(doc.id, doc.data()));
}

export async function ackPrintJob(
  businessId: string,
  jobId: string,
  status: "done" | "error",
  error?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status, completedAt: nowIso() };
  if (error) patch.error = error.slice(0, 500);
  await printJobsCol(businessId).doc(jobId).update(patch).catch(() => undefined);
}
