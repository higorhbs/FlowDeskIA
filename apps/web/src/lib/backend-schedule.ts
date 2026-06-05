import type { BusinessSchedule } from "@flowdesk/firebase/client";
import { authFetch } from "./backend-auth";

export type SchedulePayload = Partial<
  Pick<BusinessSchedule, "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg">
>;

export async function backendListSchedules(businessId?: string): Promise<BusinessSchedule[]> {
  const q = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  const data = (await authFetch(`/schedules${q}`, { method: "GET" })) as {
    schedules: BusinessSchedule[];
  };
  return data.schedules ?? [];
}

export async function backendGetSchedule(businessId: string): Promise<BusinessSchedule> {
  const items = await backendListSchedules(businessId);
  const found = items.find((s) => s.businessId === businessId);
  if (found) return found;
  throw new Error("Horários não encontrados.");
}

export async function backendPutSchedule(
  businessId: string,
  data: SchedulePayload,
): Promise<BusinessSchedule> {
  return authFetch(`/businesses/${businessId}/schedule`, {
    method: "PUT",
    body: JSON.stringify(data),
  }) as Promise<BusinessSchedule>;
}
