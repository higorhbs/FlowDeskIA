import type { AppointmentStatus } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { listAppointmentsForUser } from "@/lib/server/services/appointments";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const status = url.searchParams.get("status") as AppointmentStatus | null;
    const appointments = await listAppointmentsForUser(uid, id, {
      from,
      to,
      status: status ?? undefined,
    });
    return apiOk({ appointments });
  } catch (err) {
    return apiFail(err);
  }
}
