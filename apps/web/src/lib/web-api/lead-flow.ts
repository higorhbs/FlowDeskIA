import { apiFetch } from "./client";

export async function uploadLeadFlowMedia(
  businessId: string,
  file: File,
  nodeId: string,
): Promise<{ mediaUrl: string; mediaStoragePath: string; mediaType: "image" | "video" | "gif" }> {
  const form = new FormData();
  form.append("file", file);
  form.append("nodeId", nodeId);
  return apiFetch(`/api/businesses/${encodeURIComponent(businessId)}/lead-flow/media`, {
    method: "POST",
    body: form,
  });
}
