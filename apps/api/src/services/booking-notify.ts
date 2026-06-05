import type { Appointment, Business } from "@flowdesk/firebase";
import { forwardBookingNotify } from "../lib/backend-notify";

export async function notifyBookingAccepted(
  business: Pick<Business, "id" | "name" | "type">,
  apt: Appointment
): Promise<void> {
  await forwardBookingNotify(business, apt);
}
