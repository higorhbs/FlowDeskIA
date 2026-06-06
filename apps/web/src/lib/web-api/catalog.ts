import type { CatalogItem } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

function base(businessId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/catalog`;
}

export async function listCatalog(businessId: string): Promise<CatalogItem[]> {
  const data = await apiFetch<{ items: CatalogItem[] }>(base(businessId));
  return data.items ?? [];
}

export async function createCatalogItem(
  businessId: string,
  data: Omit<CatalogItem, "id" | "businessId" | "createdAt">,
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(base(businessId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCatalogItem(
  businessId: string,
  itemId: string,
  data: Partial<CatalogItem>,
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`${base(businessId)}/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCatalogItem(businessId: string, itemId: string): Promise<void> {
  await apiFetch<{ ok: true }>(`${base(businessId)}/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}
