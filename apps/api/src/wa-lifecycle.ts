import fs from "fs";
import path from "path";
import type { WhatsAppClient, WhatsAppManager } from "@zapflow/whatsapp-client";
import { setBusinessConnected } from "@zapflow/firebase";
import { processMessage } from "./services/bot.js";

const lifecycleAttached = new WeakSet<WhatsAppClient>();

export function hasStoredSession(sessionsRoot: string, businessId: string): boolean {
  return fs.existsSync(path.join(sessionsRoot, businessId, "creds.json"));
}

export function listStoredSessionBusinessIds(sessionsRoot: string): string[] {
  if (!fs.existsSync(sessionsRoot)) return [];
  return fs
    .readdirSync(sessionsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && hasStoredSession(sessionsRoot, d.name))
    .map((d) => d.name);
}

export function attachWhatsAppLifecycle(businessId: string, client: WhatsAppClient) {
  if (lifecycleAttached.has(client)) return;
  lifecycleAttached.add(client);

  client.on("connected", async () => {
    try {
      await setBusinessConnected(businessId, true);
    } catch (err) {
      console.error(`[whatsapp] failed to mark connected for ${businessId}:`, err);
    }
  });

  client.on("disconnected", async () => {
    try {
      await setBusinessConnected(businessId, false);
    } catch (err) {
      console.error(`[whatsapp] failed to mark disconnected for ${businessId}:`, err);
    }
  });
}

export function attachWhatsAppMessageHandler(businessId: string, client: WhatsAppClient) {
  if (client.listenerCount("message") > 0) return;

  client.on("message", async (msg) => {
    try {
      const responses = await processMessage({
        businessId,
        customerPhone: msg.from,
        customerName: msg.pushName,
        messageBody: msg.body,
      });

      for (const resp of responses) {
        if (resp.imageUrl) {
          await client.sendImage(msg.replyJid, resp.imageUrl, resp.text);
        } else if (resp.text) {
          await client.sendText(msg.replyJid, resp.text);
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (err) {
      console.error(`[whatsapp] Failed to process inbound message for business ${businessId}:`, err);
    }
  });
}

export function ensureWhatsAppClient(
  waManager: WhatsAppManager,
  sessionsRoot: string,
  businessId: string
): WhatsAppClient {
  const client = waManager.getOrCreate(businessId, sessionsRoot);
  attachWhatsAppLifecycle(businessId, client);
  attachWhatsAppMessageHandler(businessId, client);
  return client;
}

export async function restoreWhatsAppSessions(
  waManager: WhatsAppManager,
  sessionsRoot: string
): Promise<void> {
  const ids = listStoredSessionBusinessIds(sessionsRoot);
  if (ids.length === 0) return;
  console.log(`[whatsapp] Restoring ${ids.length} stored session(s)...`);
  for (const id of ids) {
    const client = ensureWhatsAppClient(waManager, sessionsRoot, id);
    if (client.isConnected()) continue;
    void client.connect().catch((err) => {
      console.error(`[whatsapp] restore connect failed for ${id}:`, err);
    });
  }
}
