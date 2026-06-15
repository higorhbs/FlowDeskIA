import {
  clearLeadFlowIdleFollowUp,
  hasCustomerMessageSince,
  listDueLeadFlowIdleFollowUps,
  tryClaimLeadFlowIdleFollowUp,
} from "@flowdesk/firebase";
import { log } from "../../lib/log.js";
import { deliverBotResponses, resolveWhatsAppClient } from "../wa-lifecycle.js";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TICK_MS = intEnv("LEAD_FLOW_IDLE_POLL_MS", 60_000);
const FIRST_TICK_DELAY_MS = 30_000;

export function startLeadFlowIdleWorker(): void {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const due = await listDueLeadFlowIdleFollowUps(20);
      for (const item of due) {
        try {
          if (await hasCustomerMessageSince(item.businessId, item.conversationId, item.anchorAt)) {
            await clearLeadFlowIdleFollowUp(item.businessId, item.conversationId);
            continue;
          }

          const client = await resolveWhatsAppClient(item.businessId, { waitMs: 12_000 });
          if (!client) {
            log.warn(
              `[lead-flow-idle] skip business=${item.businessId} conv=${item.conversationId} (wa offline)`,
            );
            continue;
          }

          const claimed = await tryClaimLeadFlowIdleFollowUp(item.businessId, item.conversationId);
          if (!claimed) continue;

          const dest = claimed.replyJid?.trim() || claimed.customerPhone;
          await deliverBotResponses(item.businessId, client, dest, item.conversationId, [
            { text: claimed.message },
          ]);
          log.info(
            `[lead-flow-idle] sent business=${item.businessId} conv=${item.conversationId} visit=${claimed.visitId ?? "-"}`,
          );
        } catch (err) {
          log.error(
            `[lead-flow-idle] failed business=${item.businessId} conv=${item.conversationId}:`,
            err,
          );
        }
      }
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void run().catch((err) => log.error("[lead-flow-idle] tick error:", err));
  }, FIRST_TICK_DELAY_MS);

  setInterval(() => {
    void run().catch((err) => log.error("[lead-flow-idle] tick error:", err));
  }, TICK_MS);

  log.info("[lead-flow-idle] started");
}
