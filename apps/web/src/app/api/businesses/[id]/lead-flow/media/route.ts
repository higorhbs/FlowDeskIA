import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { assertBusinessOwned } from "@/lib/server/services/business-access";
import { proxyBackendForm } from "@/lib/server/backend-proxy";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    await assertBusinessOwned(uid, id);

    const incoming = await req.formData();
    const form = new FormData();
    const file = incoming.get("file");
    if (file instanceof File) form.append("file", file);

    const saved = await proxyBackendForm(
      `/businesses/${encodeURIComponent(id)}/lead-flow/media`,
      form,
    );
    return apiOk(saved);
  } catch (err) {
    return apiFail(err);
  }
}
