import { Hono } from 'hono'
import { env } from './config/env.js'
import { corsMiddleware } from './middleware/cors.js'
import { registerDocs } from './routes/docs/index.js'
import { registerRoutes } from './routes/index.js'

export function createApp() {
  const app = new Hono()

  app.use('*', corsMiddleware)

  registerRoutes(app)

  if (!env.isProduction) {
    registerDocs(app)
  }

  return app
}
