import type { Appointment } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { updateAppointmentForUser } from "@/lib/server/services/appointments";

type RouteParams = { params: Promise<{ id: string; appointmentId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, appointmentId } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<Appointment>;
    const appointment = await updateAppointmentForUser(uid, id, appointmentId, body);
    return apiOk(appointment);
  } catch (err) {
    return apiFail(err);
  }
}
