import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { getAnalyticsForUser } from "@/lib/server/services/analytics";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const analytics = await getAnalyticsForUser(uid, id);
    return apiOk(analytics);
  } catch (err) {
    return apiFail(err);
  }
}
