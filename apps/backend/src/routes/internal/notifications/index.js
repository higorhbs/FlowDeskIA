import { postBookingNotifyHandler, postPaymentNotifyHandler } from './handler.js'

export function register(app) {
  app.post('/internal/notifications/payment', postPaymentNotifyHandler)
  app.post('/internal/notifications/booking', postBookingNotifyHandler)
}
