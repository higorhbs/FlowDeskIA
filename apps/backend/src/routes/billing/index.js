import {
  billingCheckoutHandler,
  billingPortalHandler,
  billingSyncHandler,
} from './handler.js'

export function register(app) {
  app.post('/billing/sync', billingSyncHandler)
  app.post('/billing/checkout', billingCheckoutHandler)
  app.post('/billing/portal', billingPortalHandler)
}
