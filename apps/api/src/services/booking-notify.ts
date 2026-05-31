import type { Appointment, Business } from "@flowdesk/firebase";

export async function notifyBookingAccepted(
  _business: Pick<Business, "id" | "name" | "type">,
  _apt: Appointment
): Promise<void> {
  return;
}
