import type { FAQ } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { createFaqForUser, listFaqsForUser } from "@/lib/server/services/faqs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const faqs = await listFaqsForUser(uid, id);
    return apiOk({ faqs });
  } catch (err) {
    return apiFail(err);
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Omit<
      FAQ,
      "id" | "businessId" | "createdAt"
    >;
    const faq = await createFaqForUser(uid, id, body);
    return apiOk(faq, 201);
  } catch (err) {
    return apiFail(err);
  }
}
