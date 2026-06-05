import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import type { Plan } from "./types.js";
import type { ScheduledStatus, ScheduledStatusMediaType } from "./types.js";
import { resolveStoryScheduledAts } from "./schedule-status-dates.js";
import {
  assertScheduledStoriesQuota,
  storiesQuotaUsed,
  type PlanTier,
} from "@flowdesk/shared";
import { getClientTenantStoriesPublished } from "./client-tenant.js";
import { getClientDb } from "./client.js";

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T;
}

function businessRef(businessId: string) {
  return doc(getClientDb(), "businesses", businessId);
}

function scheduledStatusesCol(businessId: string) {
  return collection(getClientDb(), "businesses", businessId, "scheduledStatuses");
}

function tenantRef(tenantId: string) {
  return doc(getClientDb(), "tenants", tenantId);
}

async function getTenantPlan(tenantId: string): Promise<PlanTier> {
  const snap = await getDoc(tenantRef(tenantId));
  const plan = snap.data()?.plan as Plan | undefined;
  return (plan ?? "STARTER") as PlanTier;
}

async function assertStoriesQuotaForCreate(
  businessId: string,
  tenantId: string,
  adding: number
) {
  const plan = await getTenantPlan(tenantId);
  const [published, snap] = await Promise.all([
    getClientTenantStoriesPublished(tenantId),
    getDocs(scheduledStatusesCol(businessId)),
  ]);
  const rows = snap.docs.map((d) => d.data() as ScheduledStatus);
  const used = storiesQuotaUsed(published, rows);
  assertScheduledStoriesQuota(plan, used, adding);
}

async function assertBusinessOwned(businessId: string, tenantId: string) {
  const snap = await getDoc(businessRef(businessId));
  if (!snap.exists() || snap.data().tenantId !== tenantId) {
    throw new Error("Negócio não encontrado ou sem acesso.");
  }
}

export async function listClientScheduledStatuses(
  businessId: string,
  tenantId: string
): Promise<ScheduledStatus[]> {
  await assertBusinessOwned(businessId, tenantId);
  const snap = await getDocs(query(scheduledStatusesCol(businessId), orderBy("scheduledAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as ScheduledStatus);
}

const DUPLICATE_WINDOW_MS = 120_000;

function captionKey(caption?: string) {
  return caption?.trim() || "";
}

function isRecentDuplicate(
  rows: ScheduledStatus[],
  candidate: { caption?: string; scheduledAt: string; mediaType: ScheduledStatusMediaType }
) {
  const cap = captionKey(candidate.caption);
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
  return rows.some(
    (r) =>
      r.status === "scheduled" &&
      r.scheduledAt === candidate.scheduledAt &&
      r.mediaType === candidate.mediaType &&
      captionKey(r.caption) === cap &&
      new Date(r.createdAt).getTime() >= cutoff
  );
}

export type CreateScheduledStatusInput = {
  mediaUrl: string;
  mediaType: ScheduledStatusMediaType;
  caption?: string;
  scheduledDays: string[];
  hour: number;
  minute: number;
  publishNow?: boolean;
};

export async function createClientScheduledStatuses(
  businessId: string,
  tenantId: string,
  data: {
    mediaUrl: string;
    mediaType: ScheduledStatusMediaType;
    caption?: string;
    scheduledAts: string[];
    sourceStatusId?: string;
    seriesId?: string;
    publishNow?: boolean;
  }
): Promise<ScheduledStatus[]> {
  await assertBusinessOwned(businessId, tenantId);
  if (!data.scheduledAts.length) throw new Error("Informe pelo menos um horário.");
  await assertStoriesQuotaForCreate(businessId, tenantId, data.scheduledAts.length);

  const existingSnap = await getDocs(scheduledStatusesCol(businessId));
  const existingRows = existingSnap.docs.map(
    (d) => ({ id: d.id, businessId, ...d.data() }) as ScheduledStatus
  );

  const seriesId = data.seriesId ?? (data.scheduledAts.length > 1 ? newId() : undefined);
  const ts = nowIso();
  const batch = writeBatch(getClientDb());
  const rows: ScheduledStatus[] = [];

  for (const scheduledAt of data.scheduledAts) {
    const atIso = data.publishNow ? nowIso() : scheduledAt;
    const at = new Date(atIso).getTime();
    if (!Number.isFinite(at)) {
      throw new Error("Horário de agendamento inválido.");
    }
    if (!data.publishNow && at <= Date.now() + 60_000) {
      throw new Error("Todos os horários devem ser pelo menos 1 minuto no futuro.");
    }
    const iso = new Date(atIso).toISOString();
    if (
      isRecentDuplicate(existingRows, {
        caption: data.caption,
        scheduledAt: iso,
        mediaType: data.mediaType,
      })
    ) {
      continue;
    }
    const id = newId();
    const row = removeUndefined({
      id,
      businessId,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      caption: data.caption?.trim() || undefined,
      scheduledAt: iso,
      status: "scheduled",
      seriesId,
      sourceStatusId: data.sourceStatusId,
      createdAt: ts,
      updatedAt: ts,
    }) as ScheduledStatus;
    batch.set(doc(scheduledStatusesCol(businessId), id), row);
    rows.push(row);
  }

  if (!rows.length) {
    const dupes = existingRows.filter(
      (r) =>
        r.status === "scheduled" &&
        data.scheduledAts.some((scheduledAt) => {
          const iso = new Date(scheduledAt).toISOString();
          return (
            r.scheduledAt === iso &&
            r.mediaType === data.mediaType &&
            captionKey(r.caption) === captionKey(data.caption)
          );
        })
    );
    if (dupes.length) {
      return dupes.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    }
    throw new Error("Nenhum horário novo para agendar.");
  }

  await batch.commit();
  return rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function createClientScheduledStatus(
  businessId: string,
  tenantId: string,
  input: CreateScheduledStatusInput
): Promise<ScheduledStatus[]> {
  const scheduledAts = resolveStoryScheduledAts(input);

  return createClientScheduledStatuses(businessId, tenantId, {
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaType,
    caption: input.caption,
    scheduledAts,
    publishNow: input.publishNow,
  });
}

const REPOSTABLE: ScheduledStatus["status"][] = ["published", "failed", "cancelled"];

export async function repostClientScheduledStatus(
  businessId: string,
  tenantId: string,
  sourceStatusId: string,
  input: { scheduledDays: string[]; hour: number; minute: number; publishNow?: boolean }
): Promise<ScheduledStatus[]> {
  await assertBusinessOwned(businessId, tenantId);
  const ref = doc(scheduledStatusesCol(businessId), sourceStatusId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Status não encontrado.");
  const source = { id: snap.id, businessId, ...snap.data() } as ScheduledStatus;
  if (!REPOSTABLE.includes(source.status)) {
    throw new Error("Só é possível reagendar status já publicados, cancelados ou com falha.");
  }
  if (!source.mediaUrl) throw new Error("Arte original indisponível para reagendar.");

  const scheduledAts = resolveStoryScheduledAts(input);

  return createClientScheduledStatuses(businessId, tenantId, {
    mediaUrl: source.mediaUrl,
    mediaType: source.mediaType,
    caption: source.caption,
    scheduledAts,
    sourceStatusId: source.id,
    publishNow: input.publishNow,
  });
}

export async function cancelClientScheduledStatus(
  businessId: string,
  tenantId: string,
  statusId: string
) {
  await assertBusinessOwned(businessId, tenantId);
  const ref = doc(scheduledStatusesCol(businessId), statusId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Agendamento não encontrado.");
  const row = snap.data() as ScheduledStatus;
  if (row.status !== "scheduled") {
    throw new Error("Só é possível cancelar publicações ainda não enviadas.");
  }
  await updateDoc(ref, { status: "cancelled", updatedAt: nowIso() });
}

export async function cancelClientScheduledStatusSeries(
  businessId: string,
  tenantId: string,
  seriesId: string
) {
  await assertBusinessOwned(businessId, tenantId);
  const snap = await getDocs(query(scheduledStatusesCol(businessId), orderBy("scheduledAt", "asc")));
  const pending = snap.docs.filter((d) => {
    const row = d.data() as ScheduledStatus;
    return row.seriesId === seriesId && row.status === "scheduled";
  });
  if (!pending.length) throw new Error("Nenhum agendamento pendente nesta série.");
  const batch = writeBatch(getClientDb());
  const ts = nowIso();
  for (const d of pending) {
    batch.update(d.ref, { status: "cancelled", updatedAt: ts });
  }
  await batch.commit();
}
