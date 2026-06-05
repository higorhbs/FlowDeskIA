import type { Payment } from "@flowdesk/firebase";
import { forwardPaymentNotify } from "../lib/backend-notify";

export async function notifyPaymentReceived(payment: Payment): Promise<void> {
  await forwardPaymentNotify(payment);
}
