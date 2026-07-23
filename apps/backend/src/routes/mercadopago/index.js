import {
  mercadoPagoDeleteHandler,
  mercadoPagoGetHandler,
  mercadoPagoPutHandler,
} from './handler.js'

export function register(app) {
  app.get('/businesses/:id/integrations/mercadopago', mercadoPagoGetHandler)
  app.put('/businesses/:id/integrations/mercadopago', mercadoPagoPutHandler)
  app.delete('/businesses/:id/integrations/mercadopago', mercadoPagoDeleteHandler)
}
