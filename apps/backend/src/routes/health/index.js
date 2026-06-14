import { healthHandler, authHealthHandler, billingHealthHandler } from './handler.js'

export function register(app) {
  app.get('/health', healthHandler)
  app.get('/health/auth', authHealthHandler)
  app.get('/health/billing', billingHealthHandler)
}
