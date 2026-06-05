import { asaasWebhookHandler, stripeWebhookHandler } from './handler.js'

export function register(app) {
  app.post('/webhooks/asaas', asaasWebhookHandler)
  app.post('/webhooks/stripe', stripeWebhookHandler)
}
