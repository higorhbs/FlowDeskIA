import {
  createCatalogItem,
  deleteCatalogItem,
  listCatalog,
  updateCatalogItem,
} from "@flowdesk/firebase";
import type { CatalogItem } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

export async function listCatalogForUser(uid: string, businessId: string) {
  await assertBusinessOwned(uid, businessId);
  return listCatalog(businessId);
}

export async function createCatalogItemForUser(
  uid: string,
  businessId: string,
  data: Omit<CatalogItem, "id" | "businessId" | "createdAt">,
) {
  await assertBusinessOwned(uid, businessId);
  return createCatalogItem(businessId, data);
}

export async function updateCatalogItemForUser(
  uid: string,
  businessId: string,
  itemId: string,
  data: Partial<CatalogItem>,
) {
  await assertBusinessOwned(uid, businessId);
  const updated = await updateCatalogItem(businessId, itemId, data);
  if (!updated) throw new ApiError("Item não encontrado.", 404);
  return updated;
}

export async function deleteCatalogItemForUser(
  uid: string,
  businessId: string,
  itemId: string,
) {
  await assertBusinessOwned(uid, businessId);
  await deleteCatalogItem(businessId, itemId);
}
