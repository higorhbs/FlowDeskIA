import {
  claimWhatsappInboundJob,
  completeWhatsappJob,
  failWhatsappJob,
  type WhatsappJob,
} from "@flowdesk/firebase";
import { log } from "../../lib/log.js";
import { processMessage, takeLastProcessMeta } from "../services/bot.js";
import { deliverBotResponses, resolveWhatsAppClient } from "../wa-lifecycle.js";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const WORKER_ID = `wa-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const POLL_MS = intEnv("WA_WORKER_POLL_MS", 1500);
const CONCURRENCY = intEnv("WA_WORKER_CONCURRENCY", 2);

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
    persistReplies: false,
  });

  if (responses.length === 0) return;

  const client = await resolveWhatsAppClient(businessId, { waitMs: 8_000 });
  if (!client) throw new Error("WhatsApp desconectado");

  const meta = takeLastProcessMeta();
  await deliverBotResponses(businessId, client, dest, meta?.conversationId, responses);

  log.info(`[worker] replied business=${businessId} count=${responses.length}`);
}

async function runClaimedJob(job: WhatsappJob): Promise<void> {
  running++;
  try {
    await processInboundJob(job);
    await completeWhatsappJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`[worker] job ${job.id} failed:`, message);
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
  log.info("[whatsapp] Firestore job worker started");
}
