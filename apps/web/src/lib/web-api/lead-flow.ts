import { apiFetch } from "./client";

export async function uploadLeadFlowMedia(
  businessId: string,
  file: File,
): Promise<{ mediaUrl: string; mediaStoragePath: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/api/businesses/${encodeURIComponent(businessId)}/lead-flow/media`, {
    method: "POST",
    body: form,
  });
}
