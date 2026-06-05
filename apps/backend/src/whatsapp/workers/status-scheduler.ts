import {
  claimScheduledStatus,
  finishScheduledStatus,
  listDueScheduledStatuses,
  listStatusAudienceJids,
} from "@flowdesk/firebase";
import { resolveWhatsAppClient } from "../wa-lifecycle.js";
import { waManager } from "../wa-manager.js";

const TICK_MS = 30_000;
const GAP_BETWEEN_POSTS_MS = 8_000;

async function publishOne(post: { businessId: string; id: string }) {
  const claimed = await claimScheduledStatus(post.businessId, post.id);
  if (!claimed) return;

  const sessionsRoot = process.env.WA_SESSION_PATH?.trim();
  if (!sessionsRoot) {
    await finishScheduledStatus(post.businessId, post.id, {
      status: "failed",
      error: "WA_SESSION_PATH não configurado",
    });
    return;
  }

  const client = await resolveWhatsAppClient(sessionsRoot, post.businessId, {
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
    const audience = await listStatusAudienceJids(post.businessId);
    if (!audience.length) {
      await finishScheduledStatus(post.businessId, post.id, {
        status: "failed",
        error:
          "Nenhuma conversa com cliente encontrada. Status só aparece para contatos que já conversaram com você no WhatsApp.",
      });
      return;
    }

    const msgId = await client.publishStatus({
      mediaUrl: claimed.mediaUrl,
      mediaType: claimed.mediaType,
      caption: claimed.caption,
      statusJidList: audience,
    });
    await finishScheduledStatus(post.businessId, post.id, { status: "published" });
    console.log(
      `[status] published business=${post.businessId} id=${post.id} waMsg=${msgId ?? "-"} audienceSeed=${audience.length}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao publicar status";
    await finishScheduledStatus(post.businessId, post.id, { status: "failed", error: message });
    console.error(`[status] failed business=${post.businessId} id=${post.id}:`, message);
  }
}

export function startStatusScheduler() {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
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
  }, 12_000);

  setInterval(() => {
    void run().catch((err) => console.error("[status-scheduler] tick error:", err));
  }, TICK_MS);

  console.log("[status-scheduler] started");
}
