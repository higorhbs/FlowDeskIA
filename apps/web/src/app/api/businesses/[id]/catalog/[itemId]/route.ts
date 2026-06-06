import type { CatalogItem } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import {
  deleteCatalogItemForUser,
  updateCatalogItemForUser,
} from "@/lib/server/services/catalog";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, itemId } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<CatalogItem>;
    const item = await updateCatalogItemForUser(uid, id, itemId, body);
    return apiOk(item);
  } catch (err) {
    return apiFail(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, itemId } = await params;
    await deleteCatalogItemForUser(uid, id, itemId);
    return apiOk({ ok: true });
  } catch (err) {
    return apiFail(err);
  }
}
