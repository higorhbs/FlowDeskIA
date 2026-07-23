import {
  mercadoPagoConnectHandler,
  mercadoPagoDeleteHandler,
  mercadoPagoGetHandler,
  mercadoPagoOAuthCallbackHandler,
} from './handler.js'

export function register(app) {
  app.get('/businesses/:id/integrations/mercadopago', mercadoPagoGetHandler)
  app.get('/businesses/:id/integrations/mercadopago/connect', mercadoPagoConnectHandler)
  app.delete('/businesses/:id/integrations/mercadopago', mercadoPagoDeleteHandler)
  app.get('/mercadopago/oauth/callback', mercadoPagoOAuthCallbackHandler)
}
