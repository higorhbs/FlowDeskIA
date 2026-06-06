import type { CatalogItem } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import {
  createCatalogItemForUser,
  listCatalogForUser,
} from "@/lib/server/services/catalog";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const items = await listCatalogForUser(uid, id);
    return apiOk({ items });
  } catch (err) {
    return apiFail(err);
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Omit<
      CatalogItem,
      "id" | "businessId" | "createdAt"
    >;
    const item = await createCatalogItemForUser(uid, id, body);
    return apiOk(item, 201);
  } catch (err) {
    return apiFail(err);
  }
}
