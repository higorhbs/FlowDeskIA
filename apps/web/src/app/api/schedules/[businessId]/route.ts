import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import {
  getScheduleForUser,
  putScheduleForUser,
} from "@/lib/server/services/schedules";
import type { BusinessSchedule } from "@flowdesk/firebase/client";

type RouteParams = { params: Promise<{ businessId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { businessId } = await params;
    const schedule = await getScheduleForUser(uid, businessId);
    return apiOk(schedule);
  } catch (err) {
    return apiFail(err);
  }
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { businessId } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<
      Pick<
        BusinessSchedule,
        "timezone" | "workingHours" | "specialHours" | "lunchBreak" | "lunchMsg"
      >
    >;
    const schedule = await putScheduleForUser(uid, businessId, body);
    return apiOk(schedule);
  } catch (err) {
    return apiFail(err);
  }
}
