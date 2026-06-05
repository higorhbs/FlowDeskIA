import { asaasDeleteHandler, asaasGetHandler, asaasPutHandler } from './handler.js'

export function register(app) {
  app.get('/businesses/:id/integrations/asaas', asaasGetHandler)
  app.put('/businesses/:id/integrations/asaas', asaasPutHandler)
  app.delete('/businesses/:id/integrations/asaas', asaasDeleteHandler)
}
