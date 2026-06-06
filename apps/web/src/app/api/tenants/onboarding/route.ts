import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { completeOnboarding } from "@/lib/server/services/tenants";

export async function POST() {
  try {
    const { uid } = await requireApiSession();
    const tenant = await completeOnboarding(uid);
    return apiOk(tenant);
  } catch (err) {
    return apiFail(err);
  }
}
