import { Worker, Queue, type ConnectionOptions } from "bullmq";
import { processMessage, BotContext } from "../services/bot.js";
import { requireEnv } from "../env.js";
import { probeRedis } from "../redis-health.js";
import { resolveWhatsAppClient } from "../wa-lifecycle.js";

export interface MessageJob {
  businessId: string;
  customerPhone: string;
  customerName?: string;
  messageBody: string;
  replyJid: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
}

export interface ReminderJob {
  appointmentId: string;
  businessId: string;
  customerPhone: string;
  replyJid?: string;
  message: string;
}

let messageQueue: Queue | null = null;
let reminderQueue: Queue | null = null;
let connection: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!connection) {
    connection = {
      url: requireEnv("REDIS_URL"),
      maxRetriesPerRequest: 1,
      connectTimeout: 3_000,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    };
  }
  return connection;
}

export async function getMessageQueue(): Promise<Queue | null> {
  if (!(await probeRedis())) return null;
  if (!messageQueue) {
    messageQueue = new Queue("messages", { connection: getRedisConnection() });
  }
  return messageQueue;
}

export function getReminderQueue(): Queue {
  if (!reminderQueue) {
    reminderQueue = new Queue("reminders", { connection: getRedisConnection() });
  }
  return reminderQueue;
}

export function startMessageWorker() {
  const worker = new Worker<MessageJob>(
    "messages",
    async (job) => {
      const { businessId, customerPhone, customerName, messageBody, replyJid, mediaUrl, mediaType } =
        job.data;
      const dest = replyJid?.trim() || customerPhone;

      const ctx: BotContext = {
        businessId,
        customerPhone,
        customerName,
        messageBody,
        replyJid,
        mediaUrl,
        mediaType,
      };
      const responses = await processMessage(ctx);

      const client = await resolveWhatsAppClient(businessId, {
        waitMs: 8_000,
      });
      if (!client) {
        console.warn(`[worker] WhatsApp not connected for business ${businessId}`);
        throw new Error("WhatsApp desconectado");
      }

      for (const resp of responses) {
        if (resp.imageUrl) {
          await client.sendImage(dest, resp.imageUrl, resp.text);
        } else if (resp.text) {
          await client.sendText(dest, resp.text);
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      console.log(`[worker] replied business=${businessId} to=${dest} count=${responses.length}`);
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export function startReminderWorker() {
  const worker = new Worker<ReminderJob>(
    "reminders",
    async (job) => {
      const { businessId, customerPhone, replyJid, message } = job.data;
      const client = await resolveWhatsAppClient(businessId, {
        waitMs: 5_000,
      });
      if (!client) return;
      const dest = replyJid?.trim() || customerPhone;
      await client.sendText(dest, message);
    },
    { connection: getRedisConnection() }
  );

  return worker;
}
