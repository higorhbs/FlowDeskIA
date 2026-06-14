import { healthHandler, authHealthHandler } from './handler.js'

export function register(app) {
  app.get('/health', healthHandler)
  app.get('/health/auth', authHealthHandler)
}
