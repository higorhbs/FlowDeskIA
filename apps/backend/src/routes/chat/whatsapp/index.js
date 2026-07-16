import {
  deleteConnectionHandler,
  getQrCodeHandler,
  postAppointmentConfirmationHandler,
  postMessageHandler,
  postMessageMediaHandler,
  postQrCodeHandler,
  postReportHandler,
} from './handler.js'

export function register(app) {
  app.get('/chat/whatsapp/qr-code/:businessId', getQrCodeHandler)
  app.post('/chat/whatsapp/qr-code/:businessId', postQrCodeHandler)
  app.delete('/chat/whatsapp/connection/:businessId', deleteConnectionHandler)
  app.post('/chat/whatsapp/messages/:businessId', postMessageHandler)
  app.post('/chat/whatsapp/messages/:businessId/media', postMessageMediaHandler)
  app.post('/chat/whatsapp/report/:businessId', postReportHandler)
  app.post('/chat/whatsapp/appointment-confirmation/:businessId', postAppointmentConfirmationHandler)
}
