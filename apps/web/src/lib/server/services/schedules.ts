import {
  getBusinessSchedule,
  listBusinessSchedules,
  upsertBusinessSchedule,
} from "@flowdesk/firebase";
import type { BusinessSchedule } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

export type SchedulePayload = Partial<
  Pick<BusinessSchedule, "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg">
>;

export async function listSchedulesForUser(
  uid: string,
  businessId?: string,
): Promise<BusinessSchedule[]> {
  const schedules = await listBusinessSchedules(uid);
  if (!businessId) return schedules;
  return schedules.filter((s) => s.businessId === businessId);
}

export async function getScheduleForUser(
  uid: string,
  businessId: string,
): Promise<BusinessSchedule> {
  await assertBusinessOwned(uid, businessId);
  const schedule = await getBusinessSchedule(businessId, uid);
  if (!schedule) throw new ApiError("Horários não encontrados.", 404);
  return schedule;
}

export async function putScheduleForUser(
  uid: string,
  businessId: string,
  data: SchedulePayload,
): Promise<BusinessSchedule> {
  await assertBusinessOwned(uid, businessId);
  return upsertBusinessSchedule(businessId, uid, data);
}
