import {
  createBusinessHandler,
  listBusinessesHandler,
  postLeadFlowMediaHandler,
  postPrinterTestHandler,
} from './handler.js'

export function register(app) {
  app.post('/business', createBusinessHandler)
  app.get('/businesses', listBusinessesHandler)
  app.post('/businesses/:businessId/lead-flow/media', postLeadFlowMediaHandler)
  app.post('/businesses/:id/printer/test', postPrinterTestHandler)
}
