import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { getStoriesPublished } from "@/lib/server/services/tenants";

export async function GET() {
  try {
    const { uid } = await requireApiSession();
    const storiesPublished = await getStoriesPublished(uid);
    return apiOk({ storiesPublished });
  } catch (err) {
    return apiFail(err);
  }
}
