import { listOrders, updateOrder } from "@flowdesk/firebase";
import type { Order, OrderStatus } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

export async function listOrdersForUser(
  uid: string,
  businessId: string,
  opts?: { from?: string; to?: string; status?: OrderStatus },
) {
  await assertBusinessOwned(uid, businessId);
  return listOrders(businessId, opts);
}

export async function updateOrderForUser(
  uid: string,
  businessId: string,
  orderId: string,
  data: Partial<Order>,
) {
  await assertBusinessOwned(uid, businessId);
  const updated = await updateOrder(businessId, orderId, data);
  if (!updated) throw new ApiError("Pedido não encontrado.", 404);
  return updated;
}
