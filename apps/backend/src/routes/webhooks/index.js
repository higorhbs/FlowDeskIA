import { mercadopagoWebhookHandler, stripeWebhookHandler } from './handler.js'

export function register(app) {
  app.post('/webhooks/mercadopago', mercadopagoWebhookHandler)
  app.get('/webhooks/mercadopago', mercadopagoWebhookHandler)
  app.post('/webhooks/stripe', stripeWebhookHandler)
}
