import { register as registerAuth } from './auth/index.js'
import { register as registerHealth } from './health/index.js'
import { register as registerBusiness } from './business/index.js'
import { register as registerSchedule } from './schedule/index.js'
import { register as registerChatWhatsapp } from './chat/whatsapp/index.js'
import { register as registerInternalNotifications } from './internal/notifications/index.js'
import { register as registerStoriesWhatsapp } from './stories/whatsapp/index.js'

const routeModules = [
  registerHealth,
  registerAuth,
  registerBusiness,
  registerSchedule,
  registerChatWhatsapp,
  registerStoriesWhatsapp,
  registerInternalNotifications,
]

export function registerRoutes(app) {
  for (const register of routeModules) {
    register(app)
  }
}
