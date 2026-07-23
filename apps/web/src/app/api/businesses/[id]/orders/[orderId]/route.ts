import type { Order } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { updateOrderForUser } from "@/lib/server/services/orders";

type RouteParams = { params: Promise<{ id: string; orderId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, orderId } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<Order>;
    const order = await updateOrderForUser(uid, id, orderId, body);
    return apiOk(order);
  } catch (err) {
    return apiFail(err);
  }
}
