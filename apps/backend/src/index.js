import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { env } from './config/env.js'

const app = createApp()

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`Backend listening on http://localhost:${info.port}`)
    console.log(`OpenAPI: http://localhost:${info.port}/doc`)
    console.log(`Swagger UI: http://localhost:${info.port}/swagger`)
  },
)
