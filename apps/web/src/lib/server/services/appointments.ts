import {
  createAppointment,
  findConflictingAppointment,
  listAppointments,
  updateAppointment,
} from "@flowdesk/firebase";
import type { Appointment, AppointmentStatus } from "@flowdesk/firebase/client";
import { assertBusinessOwned } from "./business-access";
import { ApiError } from "../api-error";

export type CreateAppointmentBody = {
  customerName?: string;
  customerPhone?: string;
  serviceId?: string;
  serviceName?: string;
  scheduledAt?: string;
  durationMins?: number;
  status?: AppointmentStatus;
  notes?: string;
};

export async function listAppointmentsForUser(
  uid: string,
  businessId: string,
  opts?: { from?: string; to?: string; status?: AppointmentStatus },
) {
  await assertBusinessOwned(uid, businessId);
  return listAppointments(businessId, opts);
}

export async function createAppointmentForUser(
  uid: string,
  businessId: string,
  data: CreateAppointmentBody,
) {
  const business = await assertBusinessOwned(uid, businessId);
  const serviceName = String(data.serviceName ?? "").trim();
  if (!serviceName) throw new ApiError("Serviço é obrigatório.", 400);
  const when = new Date(String(data.scheduledAt ?? ""));
  if (Number.isNaN(when.getTime())) throw new ApiError("Data e hora inválidas.", 400);
  const durationMins =
    typeof data.durationMins === "number" && data.durationMins > 0 ? data.durationMins : 60;

  const conflict = await findConflictingAppointment(
    businessId,
    when.toISOString(),
    durationMins,
    business.appointmentBufferMins ?? 0,
  );
  if (conflict) {
    throw new ApiError(
      `Horário indisponível: já existe um agendamento às ${new Date(conflict.scheduledAt).toLocaleTimeString(
        "pt-BR",
        { hour: "2-digit", minute: "2-digit" },
      )}.`,
      409,
    );
  }
  const payload: Parameters<typeof createAppointment>[0] = {
    businessId,
    customerPhone: data.customerPhone?.trim() || "",
    serviceName,
    scheduledAt: when.toISOString(),
    durationMins,
    status: data.status ?? "CONFIRMED",
  };
  const customerName = data.customerName?.trim();
  if (customerName) payload.customerName = customerName;
  const serviceId = data.serviceId?.trim();
  if (serviceId) payload.serviceId = serviceId;
  const notes = data.notes?.trim();
  if (notes) payload.notes = notes;
  return createAppointment(payload);
}

export async function updateAppointmentForUser(
  uid: string,
  businessId: string,
  appointmentId: string,
  data: Partial<Appointment>,
) {
  const business = await assertBusinessOwned(uid, businessId);
  const nextStatus = data.status;
  const isActivating = !nextStatus || nextStatus === "CONFIRMED" || nextStatus === "PENDING" || nextStatus === "COMPLETED";
  if (data.scheduledAt && isActivating) {
    const when = new Date(data.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new ApiError("Data e hora inválidas.", 400);
    const durationMins =
      typeof data.durationMins === "number" && data.durationMins > 0 ? data.durationMins : 60;
    const conflict = await findConflictingAppointment(
      businessId,
      when.toISOString(),
      durationMins,
      business.appointmentBufferMins ?? 0,
    );
    if (conflict && conflict.id !== appointmentId) {
      throw new ApiError(
        `Horário indisponível: já existe um agendamento às ${new Date(conflict.scheduledAt).toLocaleTimeString(
          "pt-BR",
          { hour: "2-digit", minute: "2-digit" },
        )}.`,
        409,
      );
    }
  }
  const updated = await updateAppointment(businessId, appointmentId, data);
  if (!updated) throw new ApiError("Agendamento não encontrado.", 404);
  return updated;
}
