import { swaggerUI } from '@hono/swagger-ui'
import { Hono } from 'hono'
import { corsMiddleware } from './middleware/cors.js'
import { getOpenApiDocument } from './openapi/index.js'
import { registerRoutes } from './routes/index.js'
import { registerMediaStatic } from './lib/media-static.js'

export function createApp() {
  const app = new Hono()

  app.use('*', corsMiddleware)

  registerMediaStatic(app)
  registerRoutes(app)

  app.get('/doc', (c) => c.json(getOpenApiDocument()))
  app.get('/swagger', swaggerUI({ url: '/doc' }))

  return app
}
