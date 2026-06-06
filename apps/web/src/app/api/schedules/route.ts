import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { listSchedulesForUser } from "@/lib/server/services/schedules";

export async function GET(req: Request) {
  try {
    const { uid } = await requireApiSession();
    const businessId = new URL(req.url).searchParams.get("businessId") ?? undefined;
    const schedules = await listSchedulesForUser(uid, businessId ?? undefined);
    return apiOk({ schedules });
  } catch (err) {
    return apiFail(err);
  }
}
