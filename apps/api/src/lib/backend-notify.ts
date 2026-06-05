import { optionalEnv } from "../env";

async function postInternal(path: string, body: unknown) {
  const base = optionalEnv("BACKEND_NOTIFY_URL");
  const secret = optionalEnv("INTERNAL_NOTIFY_SECRET");
  if (!base || !secret) return;

  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    console.warn(`[backend-notify] ${path} failed:`, data.error ?? res.status);
  }
}

export async function forwardPaymentNotify(payment: unknown) {
  await postInternal("/internal/notifications/payment", payment);
}

export async function forwardBookingNotify(business: unknown, appointment: unknown) {
  await postInternal("/internal/notifications/booking", { business, appointment });
}
