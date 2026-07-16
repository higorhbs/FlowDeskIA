import type { Appointment, AppointmentStatus } from "@flowdesk/firebase/client";
import { apiFetch } from "./client";

function base(businessId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/appointments`;
}

export async function listAppointments(
  businessId: string,
  params?: { from?: string; to?: string; status?: AppointmentStatus },
): Promise<Appointment[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.status) search.set("status", params.status);
  const q = search.toString();
  const data = await apiFetch<{ appointments: Appointment[] }>(
    `${base(businessId)}${q ? `?${q}` : ""}`,
  );
  return data.appointments ?? [];
}

export type CreateAppointmentInput = {
  customerName?: string;
  customerPhone?: string;
  serviceId?: string;
  serviceName: string;
  scheduledAt: string;
  durationMins?: number;
  status?: AppointmentStatus;
  notes?: string;
};

export async function createAppointment(
  businessId: string,
  data: CreateAppointmentInput,
): Promise<Appointment> {
  return apiFetch<Appointment>(base(businessId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAppointment(
  businessId: string,
  appointmentId: string,
  data: Partial<Appointment>,
): Promise<Appointment> {
  return apiFetch<Appointment>(
    `${base(businessId)}/${encodeURIComponent(appointmentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}
