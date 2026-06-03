import { swaggerUI } from '@hono/swagger-ui'
import { Hono } from 'hono'
import { getOpenApiDocument } from './openapi/index.js'
import { registerRoutes } from './routes/index.js'

export function createApp() {
  const app = new Hono()

  registerRoutes(app)

  app.get('/doc', (c) => c.json(getOpenApiDocument()))
  app.get('/swagger', swaggerUI({ url: '/doc' }))

  return app
}
