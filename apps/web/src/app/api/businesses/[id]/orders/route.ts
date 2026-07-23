import type { OrderStatus } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { listOrdersForUser } from "@/lib/server/services/orders";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const status = url.searchParams.get("status") as OrderStatus | null;
    const orders = await listOrdersForUser(uid, id, {
      from,
      to,
      status: status ?? undefined,
    });
    return apiOk({ orders });
  } catch (err) {
    return apiFail(err);
  }
}
