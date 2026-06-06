import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { listPaymentsForUser } from "@/lib/server/services/payments";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const payments = await listPaymentsForUser(uid, id);
    return apiOk({ payments });
  } catch (err) {
    return apiFail(err);
  }
}
