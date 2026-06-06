import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import {
  createBusinessForUser,
  listBusinessesForUser,
  type CreateBusinessBody,
} from "@/lib/server/services/businesses";

export async function GET() {
  try {
    const { uid } = await requireApiSession();
    const businesses = await listBusinessesForUser(uid);
    return apiOk({ businesses });
  } catch (err) {
    return apiFail(err);
  }
}

export async function POST(req: Request) {
  try {
    const { uid } = await requireApiSession();
    const body = (await req.json().catch(() => ({}))) as CreateBusinessBody;
    const business = await createBusinessForUser(uid, body);
    return apiOk(business, 201);
  } catch (err) {
    return apiFail(err);
  }
}
