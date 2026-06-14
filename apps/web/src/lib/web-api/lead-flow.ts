import { getClientAuth } from "@flowdesk/firebase/client";
import { LEAD_FLOW_MAX_MEDIA_BYTES } from "@flowdesk/shared";
import { getClientDirectBackendBaseUrl } from "@/lib/backend-url";
import { WebApiError } from "./client";

export async function uploadLeadFlowMedia(
  businessId: string,
  file: File,
  nodeId: string,
): Promise<{ mediaUrl: string; mediaStoragePath: string; mediaType: "image" | "video" | "gif" }> {
  if (file.size > LEAD_FLOW_MAX_MEDIA_BYTES) {
    throw new WebApiError(`Arquivo muito grande (máx. 16 MB).`, 400);
  }

  const user = getClientAuth().currentUser;
  if (!user) throw new WebApiError("Faça login novamente.", 401);

  const token = await user.getIdToken();
  const form = new FormData();
  form.append("file", file);
  form.append("nodeId", nodeId);

  const res = await fetch(
    `${getClientDirectBackendBaseUrl()}/businesses/${encodeURIComponent(businessId)}/lead-flow/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    mediaUrl?: string;
    mediaStoragePath?: string;
    mediaType?: "image" | "video" | "gif";
  };

  if (!res.ok) {
    const message =
      res.status === 413
        ? "Arquivo grande demais para o servidor. Use até 16 MB ou comprima o GIF."
        : typeof data.error === "string"
          ? data.error
          : `Erro ${res.status}`;
    throw new WebApiError(message, res.status);
  }

  if (!data.mediaUrl || !data.mediaStoragePath || !data.mediaType) {
    throw new WebApiError("Resposta inválida do servidor.", 502);
  }

  return {
    mediaUrl: data.mediaUrl,
    mediaStoragePath: data.mediaStoragePath,
    mediaType: data.mediaType,
  };
}
