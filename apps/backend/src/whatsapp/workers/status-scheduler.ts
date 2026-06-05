import {
  claimScheduledStatus,
  finishScheduledStatus,
  listDueScheduledStatuses,
  reclaimStuckPublishingStatuses,
} from "@flowdesk/firebase";
import { readStatusMediaBuffer } from "../status-media.js";
import { resolveWhatsAppClient, waitForWhatsAppReady } from "../wa-lifecycle.js";
import { waManager } from "../wa-manager.js";

const TICK_MS = 10_000;
const GAP_BETWEEN_POSTS_MS = 8_000;
const IMMEDIATE_PUBLISH_DELAY_MS = 2_000;
const FIRST_TICK_DELAY_MS = 15_000;
const READY_WAIT_MS = 30_000;

async function publishOne(post: { businessId: string; id: string }) {
  const claimed = await claimScheduledStatus(post.businessId, post.id);
  if (!claimed) return;

  const client = await resolveWhatsAppClient(post.businessId, {
    waitMs: 45_000,
  });
  if (!client) {
    const live = waManager.get(post.businessId);
    const debug = live?.getDebugInfo();
    const liveHint =
      debug?.status === "open" || debug?.socketOpen
        ? "Sessão ativa no servidor; tente Reagendar em alguns segundos."
        : `Sessão no servidor: ${debug?.status ?? "offline"}. Abra WhatsApp no menu e reconecte se precisar.`;
    await finishScheduledStatus(post.businessId, post.id, {
      status: "failed",
      error: `WhatsApp não ficou pronto a tempo para publicar. ${liveHint}`,
    });
    return;
  }

  try {
    const debug = client.getDebugInfo();
    console.log(
      `[status] attempt business=${post.businessId} id=${post.id} status=${debug.status} socketOpen=${debug.socketOpen}`
    );

    const storedMedia = await readStatusMediaBuffer(claimed.mediaUrl, claimed.mediaStoragePath);
    const msgId = await client.publishStatus({
      mediaUrl: storedMedia ? undefined : claimed.mediaUrl,
      mediaBuffer: storedMedia?.buffer,
      mediaMimetype: storedMedia?.mimetype,
      mediaType: claimed.mediaType,
      caption: claimed.caption,
    });
    await finishScheduledStatus(post.businessId, post.id, { status: "published" });
    console.log(
      `[status] published business=${post.businessId} id=${post.id} waMsg=${msgId ?? "-"} ack=server`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao publicar status";
    await finishScheduledStatus(post.businessId, post.id, { status: "failed", error: message });
    console.error(`[status] failed business=${post.businessId} id=${post.id}:`, message);
  }
}

export function enqueueImmediateStatusPublish(post: { businessId: string; id: string }) {
  setTimeout(() => {
    void (async () => {
      await waitForWhatsAppReady(post.businessId, READY_WAIT_MS);
      await publishOne(post);
    })().catch((err) => console.error("[status-scheduler] immediate publish error:", err));
  }, IMMEDIATE_PUBLISH_DELAY_MS);
}

export function startStatusScheduler() {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      try {
        const reclaimed = await reclaimStuckPublishingStatuses();
        if (reclaimed > 0) {
          console.log(`[status-scheduler] reclaimed ${reclaimed} stuck publishing job(s)`);
        }
      } catch (err) {
        console.error("[status-scheduler] reclaim error:", err);
      }

      const due = await listDueScheduledStatuses();
      for (const post of due) {
        await publishOne({ businessId: post.businessId, id: post.id });
        await new Promise((r) => setTimeout(r, GAP_BETWEEN_POSTS_MS));
      }
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void run().catch((err) => console.error("[status-scheduler] tick error:", err));
  }, FIRST_TICK_DELAY_MS);

  setInterval(() => {
    void run().catch((err) => console.error("[status-scheduler] tick error:", err));
  }, TICK_MS);

  console.log("[status-scheduler] started");
}
