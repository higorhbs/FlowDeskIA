import { authFetch } from "./backend-auth";
import { getWaApiBaseUrl } from "./backend-url";
import type { ScheduledStatus, ScheduledStatusMediaType } from "@flowdesk/firebase/client";

export type { ScheduledStatus, ScheduledStatusMediaType };

const waBase = () => ({ baseUrl: getWaApiBaseUrl() });

export async function backendListStories(businessId: string): Promise<ScheduledStatus[]> {
  return authFetch(`/stories/whatsapp/${businessId}`, { method: "GET", ...waBase() }) as Promise<
    ScheduledStatus[]
  >;
}

export async function backendCreateStories(
  businessId: string,
  data: {
    file: File;
    caption?: string;
    scheduledDays: string[];
    hour: number;
    minute: number;
    publishNow?: boolean;
  },
): Promise<ScheduledStatus[]> {
  const form = new FormData();
  form.append("file", data.file);
  if (data.publishNow) {
    form.append("publishNow", "true");
  } else {
    form.append("scheduledDays", JSON.stringify(data.scheduledDays));
    form.append("hour", String(data.hour));
    form.append("minute", String(data.minute));
  }
  if (data.caption?.trim()) form.append("caption", data.caption.trim());

  return authFetch(`/stories/whatsapp/${businessId}`, {
    method: "POST",
    body: form,
    timeoutMs: 120_000,
    ...waBase(),
  }) as Promise<ScheduledStatus[]>;
}

export async function backendRepostStory(
  businessId: string,
  statusId: string,
  data: { scheduledDays: string[]; hour: number; minute: number; publishNow?: boolean },
): Promise<ScheduledStatus[]> {
  return authFetch(`/stories/whatsapp/${businessId}/${statusId}/repost`, {
    method: "POST",
    body: JSON.stringify(data),
    ...waBase(),
  }) as Promise<ScheduledStatus[]>;
}

export async function backendCancelStory(
  businessId: string,
  statusId: string,
): Promise<{ ok: boolean }> {
  return authFetch(`/stories/whatsapp/${businessId}/${statusId}`, {
    method: "DELETE",
    ...waBase(),
  }) as Promise<{ ok: boolean }>;
}

export async function backendCancelStorySeries(
  businessId: string,
  seriesId: string,
): Promise<{ ok: boolean }> {
  return authFetch(`/stories/whatsapp/${businessId}/series/${seriesId}`, {
    method: "DELETE",
    ...waBase(),
  }) as Promise<{ ok: boolean }>;
}
