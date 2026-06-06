import { healthHandler } from './handler.js'

export function register(app) {
  app.get('/health', healthHandler)
}
