import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk, ApiError } from "@/lib/server/api-error";
import { getBusinessForUser } from "@/lib/server/services/businesses";
import { uploadBusinessMedia } from "@flowdesk/firebase";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    await getBusinessForUser(uid, id);

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new ApiError("Envie uma imagem.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimetype = file.type || "image/jpeg";
    const saved = await uploadBusinessMedia(id, "flow", buffer, mimetype, "image");
    return apiOk(saved);
  } catch (err) {
    return apiFail(err);
  }
}
