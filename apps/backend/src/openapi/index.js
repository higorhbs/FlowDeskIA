import { openApiInfo } from './document.js'
import { authPath } from '../routes/auth/openapi.js'
import { healthPath } from '../routes/health/openapi.js'
import { businessPath } from '../routes/business/openapi.js'
import { schedulePath } from '../routes/schedule/openapi.js'
import { chatWhatsappPath } from '../routes/chat/whatsapp/openapi.js'
import { storiesWhatsappPaths } from '../routes/stories/whatsapp/openapi.js'
import { internalNotificationsPaths } from '../routes/internal/notifications/openapi.js'

const pathModules = [
  healthPath,
  authPath,
  businessPath,
  schedulePath,
  chatWhatsappPath,
  storiesWhatsappPaths,
  internalNotificationsPaths,
]

export function getOpenApiDocument() {
  return {
    ...openApiInfo,
    paths: Object.assign({}, ...pathModules),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token',
        },
        internalSecret: {
          type: 'apiKey',
          in: 'header',
          name: 'x-internal-secret',
        },
      },
    },
  }
}
