import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { assertBusinessOwned } from "@/lib/server/services/business-access";
import { proxyBackendForm, proxyBackendJson } from "@/lib/server/backend-proxy";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ id: string; conversationId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, conversationId } = await params;
    await assertBusinessOwned(uid, id);

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const incoming = await req.formData();
      const form = new FormData();
      form.append("conversationId", conversationId);
      const file = incoming.get("file");
      if (file instanceof File) form.append("file", file);
      const text = incoming.get("text");
      if (typeof text === "string" && text.trim()) form.append("text", text.trim());
      const result = await proxyBackendForm(`/chat/whatsapp/messages/${id}/media`, form);
      return apiOk(result);
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      text?: string;
    };
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!to || !text) {
      return apiOk({ error: "Destino e mensagem são obrigatórios." }, 400);
    }
    const result = await proxyBackendJson(`/chat/whatsapp/messages/${id}`, {
      method: "POST",
      body: JSON.stringify({ to, text, conversationId }),
    });
    return apiOk(result);
  } catch (err) {
    return apiFail(err);
  }
}
