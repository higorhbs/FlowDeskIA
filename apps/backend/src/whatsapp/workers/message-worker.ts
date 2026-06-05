import {
  claimWhatsappInboundJob,
  completeWhatsappJob,
  failWhatsappJob,
  type WhatsappJob,
} from "@flowdesk/firebase";
import { processMessage } from "../services/bot.js";
import { resolveWhatsAppClient } from "../wa-lifecycle.js";

const WORKER_ID = `wa-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const POLL_MS = 800;
const CONCURRENCY = 5;

let running = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function processInboundJob(job: WhatsappJob): Promise<void> {
  const { businessId, payload } = job;
  const dest = payload.replyJid?.trim() || payload.customerPhone;

  const responses = await processMessage({
    businessId,
    customerPhone: payload.customerPhone,
    customerName: payload.customerName,
    messageBody: payload.messageBody,
    replyJid: payload.replyJid,
    mediaUrl: payload.mediaUrl,
    mediaType: payload.mediaType,
  });

  const client = await resolveWhatsAppClient(businessId, { waitMs: 8_000 });
  if (!client) throw new Error("WhatsApp desconectado");

  for (const resp of responses) {
    if (resp.imageUrl) {
      await client.sendImage(dest, resp.imageUrl, resp.text);
    } else if (resp.text) {
      await client.sendText(dest, resp.text);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  console.log(`[worker] replied business=${businessId} to=${dest} count=${responses.length}`);
}

async function runClaimedJob(job: WhatsappJob): Promise<void> {
  running++;
  try {
    await processInboundJob(job);
    await completeWhatsappJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job ${job.id} failed:`, message);
    await failWhatsappJob(job.id, message);
  } finally {
    running--;
  }
}

async function pollJobs(): Promise<void> {
  while (running < CONCURRENCY) {
    const job = await claimWhatsappInboundJob(WORKER_ID);
    if (!job) break;
    void runClaimedJob(job);
  }
}

export function startMessageWorker(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollJobs();
  }, POLL_MS);
  void pollJobs();
  console.log("[whatsapp] Firestore job worker started");
}
