import {
  createBusinessHandler,
  listBusinessesHandler,
  postLeadFlowMediaHandler,
  postPrinterTestHandler,
} from './handler.js'
import {
  postPrinterAgentPairHandler,
  getPrinterAgentPollHandler,
  postPrinterAgentAckHandler,
} from './printer-agent.js'

export function register(app) {
  app.post('/business', createBusinessHandler)
  app.get('/businesses', listBusinessesHandler)
  app.post('/businesses/:businessId/lead-flow/media', postLeadFlowMediaHandler)
  app.post('/businesses/:id/printer/test', postPrinterTestHandler)
  app.post('/businesses/:id/printer/agent/pair', postPrinterAgentPairHandler)
  app.get('/businesses/:id/printer/agent/poll', getPrinterAgentPollHandler)
  app.post('/businesses/:id/printer/agent/ack', postPrinterAgentAckHandler)
}
