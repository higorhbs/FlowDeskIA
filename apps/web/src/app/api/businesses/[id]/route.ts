import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import {
  getBusinessForUser,
  updateBusinessForUser,
} from "@/lib/server/services/businesses";
import type { Business } from "@flowdesk/firebase/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const business = await getBusinessForUser(uid, id);
    return apiOk(business);
  } catch (err) {
    return apiFail(err);
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<Business>;
    const business = await updateBusinessForUser(uid, id, body);
    return apiOk(business);
  } catch (err) {
    return apiFail(err);
  }
}
