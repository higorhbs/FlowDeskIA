import {
  createBusinessHandler,
  listBusinessesHandler,
  postLeadFlowMediaHandler,
} from './handler.js'

export function register(app) {
  app.post('/business', createBusinessHandler)
  app.get('/businesses', listBusinessesHandler)
  app.post('/businesses/:businessId/lead-flow/media', postLeadFlowMediaHandler)
}
