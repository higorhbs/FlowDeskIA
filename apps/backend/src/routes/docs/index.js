import { swaggerUI } from '@hono/swagger-ui'
import { getOpenApiDocument } from '../../openapi/index.js'

export function registerDocs(app) {
  app.get('/docs/openapi.json', (c) => c.json(getOpenApiDocument()))
  app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }))
}
