import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk, requireJsonField } from "@/lib/server/api-error";
import { acceptLgpd } from "@/lib/server/services/tenants";

export async function POST(req: Request) {
  try {
    const { uid, email } = await requireApiSession();
    const body = (await req.json().catch(() => ({}))) as { policyVersion?: string };
    const policyVersion = requireJsonField(
      body.policyVersion,
      "Versão da política obrigatória.",
    );
    const tenant = await acceptLgpd(uid, policyVersion, { email });
    return apiOk(tenant);
  } catch (err) {
    return apiFail(err);
  }
}
