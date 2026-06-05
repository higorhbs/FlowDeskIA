import { json } from '../../../lib/auth-guard.js'
import { notifyBookingAccepted } from '../../../../dist/whatsapp/services/booking-notify.js'
import { notifyPaymentReceived } from '../../../../dist/whatsapp/services/payment-notify.js'

function checkInternalSecret(c) {
  const expected = process.env.INTERNAL_NOTIFY_SECRET?.trim()
  if (!expected) {
    return json(c, 503, { error: 'INTERNAL_NOTIFY_SECRET não configurado no backend.' })
  }
  const header = c.req.header('x-internal-secret')?.trim()
  if (header !== expected) {
    return json(c, 401, { error: 'Não autorizado.' })
  }
  return null
}

export async function postPaymentNotifyHandler(c) {
  const blocked = checkInternalSecret(c)
  if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  if (!body?.businessId || !body?.customerPhone) {
    return json(c, 400, { error: 'businessId e customerPhone são obrigatórios.' })
  }

  await notifyPaymentReceived(body)
  return json(c, 200, { ok: true })
}

export async function postBookingNotifyHandler(c) {
  const blocked = checkInternalSecret(c)
  if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  if (!body?.business || !body?.appointment) {
    return json(c, 400, { error: 'business e appointment são obrigatórios.' })
  }

  await notifyBookingAccepted(body.business, body.appointment)
  return json(c, 200, { ok: true })
}
