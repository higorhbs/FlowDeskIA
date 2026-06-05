import { healthAdminHandler, healthHandler, healthPaymentsHandler } from './handler.js'

export function register(app) {
  app.get('/health', healthHandler)
  app.get('/health/admin', healthAdminHandler)
  app.get('/health/payments', healthPaymentsHandler)
}
