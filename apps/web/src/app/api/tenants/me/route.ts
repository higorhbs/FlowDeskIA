import { requireApiSession } from "@/lib/server/api-auth";
import { ApiError, apiFail, apiOk } from "@/lib/server/api-error";
import { getTenantForUser, syncTenant } from "@/lib/server/services/tenants";

export async function GET() {
  try {
    const { uid } = await requireApiSession();
    const tenant = await getTenantForUser(uid);
    if (!tenant) throw new ApiError("Conta não encontrada", 404);
    return apiOk(tenant);
  } catch (err) {
    return apiFail(err);
  }
}

export async function POST(req: Request) {
  try {
    const { uid, email } = await requireApiSession();
    if (!email) throw new ApiError("E-mail não encontrado na conta.", 400);
    const existing = await getTenantForUser(uid);
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const tenant = await syncTenant(uid, { name, email });
    return apiOk(tenant, existing ? 200 : 201);
  } catch (err) {
    return apiFail(err);
  }
}
