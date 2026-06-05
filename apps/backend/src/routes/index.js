import { register as registerAuth } from './auth/index.js'
import { register as registerHealth } from './health/index.js'
import { register as registerBusiness } from './business/index.js'
import { register as registerSchedule } from './schedule/index.js'
import { register as registerChatWhatsapp } from './chat/whatsapp/index.js'
import { register as registerInternalNotifications } from './internal/notifications/index.js'
import { register as registerWebhooks } from './webhooks/index.js'
import { register as registerBilling } from './billing/index.js'
import { register as registerPrivacy } from './privacy/index.js'
import { register as registerAsaas } from './asaas/index.js'

const routeModules = [
  registerHealth,
  registerWebhooks,
  registerAuth,
  registerBusiness,
  registerSchedule,
  registerChatWhatsapp,
  registerBilling,
  registerPrivacy,
  registerAsaas,
  registerInternalNotifications,
]

export function registerRoutes(app) {
  for (const register of routeModules) {
    register(app)
  }
}
