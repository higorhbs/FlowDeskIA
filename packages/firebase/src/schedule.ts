import type { Business, BusinessSchedule, TimeSlot } from "./types.js";
import { getDb, nowIso } from "./admin.js";
import { stripUndefined } from "./business-record.js";

const schedules = () => getDb().collection("businessSchedules");

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function defaultWorkingHours(): Record<string, TimeSlot> {
  const h: Record<string, TimeSlot> = {};
  for (const d of DAY_KEYS) {
    h[d] = d === "sun" ? null : ["09:00", "18:00"];
  }
  return h;
}

export function defaultBusinessSchedule(
  businessId: string,
  tenantId: string
): BusinessSchedule {
  const ts = nowIso();
  return {
    businessId,
    tenantId,
    timezone: "America/Sao_Paulo",
    workingHours: defaultWorkingHours(),
    specialHours: {},
    lunchBreak: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

function normalizeTimeSlot(raw: unknown): TimeSlot {
  if (raw === null) return null;
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === "string" &&
    typeof raw[1] === "string"
  ) {
    return [raw[0], raw[1]];
  }
  return null;
}

function normalizeWorkingHours(raw: unknown): Record<string, TimeSlot> {
  if (!raw || typeof raw !== "object") return defaultWorkingHours();
  const input = raw as Record<string, unknown>;
  const out: Record<string, TimeSlot> = {};
  for (const day of DAY_KEYS) {
    out[day] = normalizeTimeSlot(input[day]);
  }
  return out;
}

function normalizeSpecialHours(raw: unknown): Record<string, TimeSlot> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, TimeSlot> = {};
  for (const [key, slot] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeTimeSlot(slot);
  }
  return out;
}

function normalizeLunchBreak(raw: unknown): [string, string] | null {
  return normalizeTimeSlot(raw) as [string, string] | null;
}

export function normalizeBusinessSchedule(
  businessId: string,
  raw: Record<string, unknown>
): BusinessSchedule {
  return {
    businessId,
    tenantId: String(raw.tenantId ?? ""),
    timezone: typeof raw.timezone === "string" ? raw.timezone : "America/Sao_Paulo",
    workingHours: normalizeWorkingHours(raw.workingHours),
    specialHours: normalizeSpecialHours(raw.specialHours),
    lunchBreak: normalizeLunchBreak(raw.lunchBreak),
    lunchMsg: typeof raw.lunchMsg === "string" ? raw.lunchMsg : undefined,
    createdAt: String(raw.createdAt ?? nowIso()),
    updatedAt: String(raw.updatedAt ?? nowIso()),
  };
}

export function resolveBotOperatingContext(
  business: Pick<
    Business,
    "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg"
  >,
  schedule: BusinessSchedule | null
): Pick<Business, "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg"> {
  const businessHours = normalizeWorkingHours(business.workingHours);
  const hasBusinessHours = Object.values(businessHours).some((slot) => slot !== null);
  const scheduleHours = schedule?.workingHours ?? defaultWorkingHours();

  return {
    timezone: schedule?.timezone ?? business.timezone ?? "America/Sao_Paulo",
    workingHours: schedule ? scheduleHours : hasBusinessHours ? businessHours : defaultWorkingHours(),
    specialHours: schedule
      ? { ...(business.specialHours ?? {}), ...schedule.specialHours }
      : (business.specialHours ?? {}),
    lunchBreak: schedule?.lunchBreak ?? business.lunchBreak ?? null,
    lunchMsg: schedule?.lunchMsg ?? business.lunchMsg,
  };
}

export async function listBusinessSchedules(tenantId: string): Promise<BusinessSchedule[]> {
  const snap = await schedules().where("tenantId", "==", tenantId).get();
  return snap.docs.map((doc) =>
    normalizeBusinessSchedule(doc.id, doc.data() as Record<string, unknown>)
  );
}

export async function getBusinessSchedule(
  businessId: string,
  tenantId?: string
): Promise<BusinessSchedule | null> {
  const snap = await schedules().doc(businessId).get();
  if (!snap.exists) return null;
  const schedule = normalizeBusinessSchedule(businessId, snap.data() as Record<string, unknown>);
  if (tenantId && schedule.tenantId !== tenantId) return null;
  return schedule;
}

export async function upsertBusinessSchedule(
  businessId: string,
  tenantId: string,
  data: Partial<
    Pick<
      BusinessSchedule,
      "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg"
    >
  >
): Promise<BusinessSchedule> {
  const existing = await getBusinessSchedule(businessId);
  const ts = nowIso();
  const base = existing ?? defaultBusinessSchedule(businessId, tenantId);
  const next: BusinessSchedule = {
    ...base,
    businessId,
    tenantId,
    timezone: data.timezone ?? base.timezone,
    workingHours: data.workingHours
      ? normalizeWorkingHours(data.workingHours)
      : base.workingHours,
    specialHours: data.specialHours
      ? normalizeSpecialHours(data.specialHours)
      : base.specialHours,
    lunchBreak:
      data.lunchBreak !== undefined
        ? normalizeLunchBreak(data.lunchBreak)
        : base.lunchBreak,
    lunchMsg: data.lunchMsg !== undefined ? data.lunchMsg : base.lunchMsg,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  const record = stripUndefined(next as unknown as Record<string, unknown>);
  await schedules().doc(businessId).set(record);
  await getDb()
    .collection("businesses")
    .doc(businessId)
    .update(
      stripUndefined({
        timezone: next.timezone,
        workingHours: next.workingHours,
        specialHours: next.specialHours,
        lunchBreak: next.lunchBreak,
        lunchMsg: next.lunchMsg,
        updatedAt: ts,
      })
    )
    .catch(() => undefined);
  return normalizeBusinessSchedule(businessId, record);
}

export async function patchBusinessSchedule(
  businessId: string,
  tenantId: string,
  data: Partial<
    Pick<
      BusinessSchedule,
      "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg"
    >
  >
): Promise<BusinessSchedule | null> {
  const existing = await getBusinessSchedule(businessId, tenantId);
  if (!existing) return null;
  return upsertBusinessSchedule(businessId, tenantId, {
    timezone: data.timezone,
    workingHours: data.workingHours,
    specialHours: data.specialHours,
    lunchBreak: data.lunchBreak,
    lunchMsg: data.lunchMsg,
  });
}

export async function deleteBusinessSchedule(
  businessId: string,
  tenantId?: string
): Promise<boolean> {
  const existing = await getBusinessSchedule(businessId, tenantId);
  if (!existing) return false;
  await schedules().doc(businessId).delete();
  return true;
}

export async function setScheduleException(
  businessId: string,
  tenantId: string,
  date: string,
  slot: TimeSlot
): Promise<BusinessSchedule | null> {
  const existing = await getBusinessSchedule(businessId, tenantId);
  const base = existing ?? defaultBusinessSchedule(businessId, tenantId);
  return upsertBusinessSchedule(businessId, tenantId, {
    specialHours: { ...base.specialHours, [date]: slot },
  });
}

export async function removeScheduleException(
  businessId: string,
  tenantId: string,
  date: string
): Promise<BusinessSchedule | null> {
  const existing = await getBusinessSchedule(businessId, tenantId);
  if (!existing) return null;
  const specialHours = { ...existing.specialHours };
  delete specialHours[date];
  return upsertBusinessSchedule(businessId, tenantId, { specialHours });
}
