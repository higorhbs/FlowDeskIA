import type { FAQ } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { deleteFaqForUser, updateFaqForUser } from "@/lib/server/services/faqs";

type RouteParams = { params: Promise<{ id: string; faqId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, faqId } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<
      Omit<FAQ, "id" | "businessId" | "createdAt">
    >;
    const faq = await updateFaqForUser(uid, id, faqId, body);
    return apiOk(faq);
  } catch (err) {
    return apiFail(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, faqId } = await params;
    await deleteFaqForUser(uid, id, faqId);
    return apiOk({ ok: true });
  } catch (err) {
    return apiFail(err);
  }
}
