import {
  claimScheduledStatus,
  deferScheduledStatus,
  finishScheduledStatus,
  getBusiness,
  getTenant,
  getTenantStoriesPublished,
  hasWhatsAppAuth,
  listDueScheduledStatuses,
  listStatusAudienceJids,
  reclaimStuckPublishingStatuses,
} from "@flowdesk/firebase";
import { assertStoriesPublishQuota, type PlanTier } from "@flowdesk/shared";
import { readStatusMediaBuffer } from "../status-media.js";
import { resolveWhatsAppClient, waitForWhatsAppReady } from "../wa-lifecycle.js";
import { waManager } from "../wa-manager.js";

const TICK_MS = 10_000;
const GAP_BETWEEN_POSTS_MS = 8_000;
const IMMEDIATE_PUBLISH_DELAY_MS = 25_000;
const FIRST_TICK_DELAY_MS = 20_000;
const READY_WAIT_MS = 90_000;

const publishInFlight = new Map<string, Promise<void>>();

function isSignalSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  return name === "SessionError" || /no matching sessions|no sessions|bad mac/i.test(msg);
}

function isBaileysTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { output?: { statusCode?: number } })?.output?.statusCode;
  return msg === "Timed Out" || code === 408 || /time-out|timed out/i.test(msg);
}

function shouldDeferPublish(err: unknown): boolean {
  return isSignalSessionError(err) || isBaileysTimeout(err);
}

function storyPublishError(err: unknown): string {
  if (isSignalSessionError(err)) {
    return "Sessão WhatsApp ainda sincronizando. Aguarde ~1 min após conectar e use Reagendar.";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/timed out|time-out|408/i.test(msg)) {
    return "WhatsApp lento para responder. Aguarde 1 min com celular online e use Reagendar.";
  }
  if (/socket not connected|desconectado/i.test(msg)) {
    return "WhatsApp desconectado. Abra o menu WhatsApp e reconecte.";
  }
  if (/audiência|Nenhum contato/i.test(msg)) {
    return msg;
  }
  return msg || "Falha ao publicar status";
}

async function checkPublishQuota(businessId: string): Promise<string | null> {
  const business = await getBusiness(businessId);
  if (!business?.tenantId) return null;
  const tenant = await getTenant(business.tenantId);
  const plan = (tenant?.plan ?? "STARTER") as PlanTier;
  const published = await getTenantStoriesPublished(business.tenantId);
  try {
    assertStoriesPublishQuota(plan, published);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Limite mensal atingido.";
  }
}

async function publishOne(post: { businessId: string; id: string }) {
  const prev = publishInFlight.get(post.businessId);
  if (prev) await prev.catch(() => undefined);

  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  publishInFlight.set(post.businessId, gate);

  try {
    await publishOneInner(post);
  } finally {
    release();
    if (publishInFlight.get(post.businessId) === gate) {
      publishInFlight.delete(post.businessId);
    }
  }
}

async function publishOneInner(post: { businessId: string; id: string }) {
  const claimed = await claimScheduledStatus(post.businessId, post.id);
  if (!claimed) return;

  const quotaErr = await checkPublishQuota(post.businessId);
  if (quotaErr) {
    await finishScheduledStatus(post.businessId, post.id, { status: "failed", error: quotaErr });
    return;
  }

  if (!(await hasWhatsAppAuth(post.businessId))) {
    await finishScheduledStatus(post.businessId, post.id, {
      status: "failed",
      error: "WhatsApp não conectado. Abra o menu WhatsApp e escaneie o QR.",
    });
    return;
  }

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

    const readyClient = await waitForWhatsAppReady(post.businessId, READY_WAIT_MS, {
      forPublish: true,
    });
    if (!readyClient?.isPublishReady()) {
      throw new Error("Sessão WhatsApp ainda sincronizando. Aguarde e tente Reagendar.");
    }

    const storedMedia = await readStatusMediaBuffer(claimed.mediaUrl, claimed.mediaStoragePath);
    const audience = await listStatusAudienceJids(post.businessId);

    const msgId = await readyClient.publishStatus({
      mediaUrl: storedMedia ? undefined : claimed.mediaUrl,
      mediaBuffer: storedMedia?.buffer,
      mediaMimetype: storedMedia?.mimetype,
      mediaType: claimed.mediaType,
      caption: claimed.caption,
      statusJidList: audience,
    });
    await finishScheduledStatus(post.businessId, post.id, { status: "published" });
    console.log(
      `[status] published business=${post.businessId} id=${post.id} waMsg=${msgId ?? "-"} audience=${audience.length}`
    );
  } catch (err) {
    if (shouldDeferPublish(err)) {
      const delayMs = isBaileysTimeout(err) ? 180_000 : 120_000;
      const deferred = await deferScheduledStatus(post.businessId, post.id, delayMs);
      if (deferred) {
        console.warn(
          `[status] deferred business=${post.businessId} id=${post.id} (+${delayMs / 1000}s)`
        );
        return;
      }
    }
    const message = storyPublishError(err);
    await finishScheduledStatus(post.businessId, post.id, { status: "failed", error: message });
    console.error(`[status] failed business=${post.businessId} id=${post.id}:`, message, err);
  }
}

export function enqueueImmediateStatusPublish(post: { businessId: string; id: string }) {
  setTimeout(() => {
    void (async () => {
      await waitForWhatsAppReady(post.businessId, READY_WAIT_MS, { forPublish: true });
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
