import { createBusinessHandler, listBusinessesHandler } from './handler.js'

export function register(app) {
  app.post('/business', createBusinessHandler)
  app.get('/businesses', listBusinessesHandler)
}
