import type { BusinessSchedule } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";
import type { SchedulePayload } from "@/lib/server/services/schedules";

export type { SchedulePayload };

export async function listSchedules(businessId?: string): Promise<BusinessSchedule[]> {
  const q = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  const data = await apiFetch<{ schedules: BusinessSchedule[] }>(`/api/schedules${q}`);
  return data.schedules ?? [];
}

export async function getSchedule(businessId: string): Promise<BusinessSchedule> {
  return apiFetch<BusinessSchedule>(
    `/api/schedules/${encodeURIComponent(businessId)}`,
  );
}

export async function putSchedule(
  businessId: string,
  data: SchedulePayload,
): Promise<BusinessSchedule> {
  return apiFetch<BusinessSchedule>(
    `/api/schedules/${encodeURIComponent(businessId)}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}
