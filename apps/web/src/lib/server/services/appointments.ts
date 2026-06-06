import { listAppointments, updateAppointment } from "@flowdesk/firebase";
import type { Appointment, AppointmentStatus } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

export async function listAppointmentsForUser(
  uid: string,
  businessId: string,
  opts?: { from?: string; to?: string; status?: AppointmentStatus },
) {
  await assertBusinessOwned(uid, businessId);
  return listAppointments(businessId, opts);
}

export async function updateAppointmentForUser(
  uid: string,
  businessId: string,
  appointmentId: string,
  data: Partial<Appointment>,
) {
  await assertBusinessOwned(uid, businessId);
  const updated = await updateAppointment(businessId, appointmentId, data);
  if (!updated) throw new ApiError("Agendamento não encontrado.", 404);
  return updated;
}
