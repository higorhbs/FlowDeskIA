import type { Order, OrderStatus } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

function base(businessId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/orders`;
}

export async function listOrders(
  businessId: string,
  params?: { from?: string; to?: string; status?: OrderStatus },
): Promise<Order[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.status) search.set("status", params.status);
  const q = search.toString();
  const data = await apiFetch<{ orders: Order[] }>(`${base(businessId)}${q ? `?${q}` : ""}`);
  return data.orders ?? [];
}

export async function updateOrder(
  businessId: string,
  orderId: string,
  data: Partial<Order>,
): Promise<Order> {
  return apiFetch<Order>(`${base(businessId)}/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
